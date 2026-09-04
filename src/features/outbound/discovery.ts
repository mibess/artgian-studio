import { and, eq, gte, inArray, sql } from "drizzle-orm";
import {
  auditLogs,
  campaigns,
  discoveryRuns,
  jobs,
  leads,
  outboundEvents,
  outboundProspects,
  timelineEvents,
} from "../../../db/schema";
import { getBusinessConfig } from "../../config/business";
import { getCommercialDb, getSystemSettings } from "../../db/commercial";
import { canonicalInstagramUsername } from "../leads/domain";
import {
  buildDiscoveryQualificationReason,
  buildDiscoverySeeds,
  nextDiscoveryAt,
  parseStoredDiscoveryTerms,
  type PublicInstagramCandidate,
} from "./discovery-domain";
import { scorePublicProfile, type OutboundFunnel } from "./domain";

type BrowserDiscoveryResult = {
  candidates: PublicInstagramCandidate[];
  queriesScanned: number;
  profilesInspected: number;
};

type DiscoveryBrowser = (input: {
  jobId: string;
  seeds: ReturnType<typeof buildDiscoverySeeds>;
  maximumProfiles: number;
  knownLocations: string[];
  ownUsername?: string;
}) => Promise<BrowserDiscoveryResult>;

function discoveryJobPayload(campaignId: string) {
  return JSON.stringify({ campaignId });
}

export async function enqueueCampaignDiscovery(input: {
  campaignId: string;
  scheduledAt?: string;
  excludeJobId?: string;
}) {
  const db = await getCommercialDb();
  const openJobs = await db
    .select({ id: jobs.id, payload: jobs.payload })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, "discover_prospects"),
        inArray(jobs.status, ["pending", "running"]),
      ),
    );
  const existing = openJobs.find((job) => {
    if (job.id === input.excludeJobId) return false;
    try {
      return (JSON.parse(job.payload) as { campaignId?: string }).campaignId === input.campaignId;
    } catch {
      return false;
    }
  });
  if (existing) return { created: false as const, jobId: existing.id };

  const scheduledAt = input.scheduledAt || new Date().toISOString();
  const jobId = crypto.randomUUID();
  await db.insert(jobs).values({
    id: jobId,
    type: "discover_prospects",
    payload: discoveryJobPayload(input.campaignId),
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    scheduledAt,
    idempotencyKey: `discovery:${input.campaignId}:${scheduledAt}`,
    createdAt: new Date().toISOString(),
  });
  return { created: true as const, jobId };
}

export async function cancelPendingCampaignDiscovery(campaignId: string) {
  const db = await getCommercialDb();
  const pending = await db
    .select({ id: jobs.id, payload: jobs.payload })
    .from(jobs)
    .where(and(eq(jobs.type, "discover_prospects"), eq(jobs.status, "pending")));
  const ids = pending.flatMap((job) => {
    try {
      return (JSON.parse(job.payload) as { campaignId?: string }).campaignId === campaignId
        ? [job.id]
        : [];
    } catch {
      return [];
    }
  });
  if (!ids.length) return 0;
  await db
    .update(jobs)
    .set({
      status: "completed",
      finishedAt: new Date().toISOString(),
      lastError: "Descoberta desativada pela operadora.",
    })
    .where(inArray(jobs.id, ids));
  return ids.length;
}

export async function scheduleNextCampaignDiscovery(input: {
  campaignId: string;
  currentJobId: string;
  from?: Date;
}) {
  const db = await getCommercialDb();
  const [campaign] = await db
    .select({
      discoveryEnabled: campaigns.discoveryEnabled,
      discoveryIntervalHours: campaigns.discoveryIntervalHours,
    })
    .from(campaigns)
    .where(eq(campaigns.id, input.campaignId))
    .limit(1);
  if (!campaign?.discoveryEnabled) return { created: false as const };
  return enqueueCampaignDiscovery({
    campaignId: input.campaignId,
    excludeJobId: input.currentJobId,
    scheduledAt: nextDiscoveryAt(input.from || new Date(), campaign.discoveryIntervalHours),
  });
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

export async function executeCampaignDiscovery(
  input: { jobId: string; campaignId: string },
  dependencies: { discover: DiscoveryBrowser },
) {
  if (process.env.INSTAGRAM_DISCOVERY_ENABLED !== "true") {
    throw new Error("Descoberta bloqueada por INSTAGRAM_DISCOVERY_ENABLED.");
  }
  const db = await getCommercialDb();
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, input.campaignId))
    .limit(1);
  if (!campaign || !campaign.discoveryEnabled) {
    return { status: "disabled" as const, created: 0 };
  }
  const settings = await getSystemSettings();
  if (settings.discovery_paused === "true") {
    return { status: "paused" as const, reason: "Descoberta pausada no painel." };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const [today] = await db
    .select({ count: sql<number>`count(*)` })
    .from(outboundProspects)
    .where(
      and(
        eq(outboundProspects.campaignId, campaign.id),
        eq(outboundProspects.discoverySource, "instagram_browser"),
        gte(outboundProspects.createdAt, startOfUtcDay(now)),
      ),
    );
  const remaining = Math.max(0, campaign.discoveryDailyLimit - Number(today?.count || 0));
  if (!remaining) {
    await db.update(campaigns).set({ lastDiscoveryAt: nowIso, updatedAt: nowIso }).where(eq(campaigns.id, campaign.id));
    await scheduleNextCampaignDiscovery({ campaignId: campaign.id, currentJobId: input.jobId, from: now });
    return { status: "completed" as const, created: 0, dailyLimitReached: true };
  }

  const business = await getBusinessConfig();
  const keywords = parseStoredDiscoveryTerms(campaign.discoveryKeywords);
  const hashtags = parseStoredDiscoveryTerms(campaign.discoveryHashtags);
  const locations = parseStoredDiscoveryTerms(campaign.discoveryLocations);
  const seeds = buildDiscoverySeeds({
    funnelType: campaign.funnelType as OutboundFunnel,
    segment: campaign.segment,
    keywords,
    hashtags,
    locations,
    business,
  });
  if (!seeds.length) throw new Error("A campanha não possui critérios de descoberta.");

  const runId = crypto.randomUUID();
  await db.insert(discoveryRuns).values({
    id: runId,
    campaignId: campaign.id,
    jobId: input.jobId,
    status: "running",
    startedAt: nowIso,
  });

  try {
    const configuredRunLimit = Number(process.env.MAX_DISCOVERY_PROFILES_PER_RUN || 10);
    const maximumProfiles = Number.isFinite(configuredRunLimit)
      ? Math.min(remaining, Math.max(1, Math.trunc(configuredRunLimit)))
      : Math.min(remaining, 10);
    const browserResult = await dependencies.discover({
      jobId: input.jobId,
      seeds,
      maximumProfiles,
      knownLocations: locations.length ? locations : [business.targetGeography],
      ownUsername: business.company.instagramHandle,
    });
    let profilesQualified = 0;
    let profilesCreated = 0;
    let skippedDuplicates = 0;
    let skippedBlocked = 0;
    let skippedLowScore = 0;

    for (const candidate of browserResult.candidates) {
      const instagramUsername = canonicalInstagramUsername(candidate.instagramUsername);
      if (!/^[a-z0-9._]{1,30}$/.test(instagramUsername)) continue;
      const [existingProspect] = await db
        .select({ id: outboundProspects.id })
        .from(outboundProspects)
        .where(eq(outboundProspects.instagramUsername, instagramUsername))
        .limit(1);
      if (existingProspect) {
        skippedDuplicates += 1;
        continue;
      }
      let [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.instagramUsername, instagramUsername))
        .limit(1);
      if (lead?.doNotContact) {
        skippedBlocked += 1;
        continue;
      }
      const score = scorePublicProfile(
        {
          category: candidate.profileCategory,
          bio: candidate.profileBio,
          location: candidate.profileLocation,
          publicSignal: candidate.publicSignal,
          funnelType: campaign.funnelType as OutboundFunnel,
        },
        business,
      );
      if (score.score < campaign.discoveryMinimumScore) {
        skippedLowScore += 1;
        continue;
      }
      profilesQualified += 1;
      const prospectId = crypto.randomUUID();
      const qualificationReason = buildDiscoveryQualificationReason({
        query: candidate.discoveryQuery,
        score: score.score,
        matches: score.matches,
      });
      const inserted = await db.transaction(async (tx) => {
        if (!lead) {
          const leadId = crypto.randomUUID();
          await tx.insert(leads).values({
            id: leadId,
            instagramUsername,
            name: candidate.name || null,
            leadType: campaign.funnelType === "partner" ? "partner" : "consumer",
            source: `Descoberta Instagram · ${campaign.name}`,
            segment: campaign.segment,
            score: score.score,
            icpScore: score.score,
            pipelineStage: score.score >= 40 ? "qualified" : "discovered",
            channelState: "human_review_required",
            createdAt: nowIso,
            updatedAt: nowIso,
          }).onConflictDoNothing();
          [lead] = await tx
            .select()
            .from(leads)
            .where(eq(leads.instagramUsername, instagramUsername))
            .limit(1);
        }
        if (!lead || lead.doNotContact) return false;
        const created = await tx.insert(outboundProspects).values({
          id: prospectId,
          campaignId: campaign.id,
          leadId: lead.id,
          instagramUsername,
          name: candidate.name || null,
          sourceUrl: candidate.sourceUrl,
          profileCategory: candidate.profileCategory || null,
          profileBio: candidate.profileBio || null,
          profileLocation: candidate.profileLocation || null,
          publicSignal: candidate.publicSignal || null,
          discoverySource: "instagram_browser",
          discoveryQuery: candidate.discoveryQuery,
          qualificationReason,
          funnelType: campaign.funnelType,
          pipelineStage: score.score >= 40 ? "qualified" : "discovered",
          icpScore: score.score,
          priority: score.priority,
          contactPolicy: "manual_only",
          status: "identified",
          createdAt: nowIso,
          updatedAt: nowIso,
        }).onConflictDoNothing().returning({ id: outboundProspects.id });
        if (!created.length) return false;
        await tx.insert(outboundEvents).values({
          id: crypto.randomUUID(),
          prospectId,
          campaignId: campaign.id,
          leadId: lead.id,
          type: "prospect_discovered_automatically",
          metadata: JSON.stringify({
            query: candidate.discoveryQuery,
            sourceUrl: candidate.sourceUrl,
            score: score.score,
            matches: score.matches,
            sent: false,
          }),
          occurredAt: nowIso,
        });
        await tx.insert(timelineEvents).values({
          id: crypto.randomUUID(),
          leadId: lead.id,
          type: "discovered",
          title: "Perfil descoberto automaticamente",
          description: qualificationReason,
          metadata: JSON.stringify({ campaignId: campaign.id, prospectId, sent: false }),
          createdAt: nowIso,
        });
        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actor: "system",
          action: "outbound_prospect_discovered_automatically",
          entityType: "outbound_prospect",
          entityId: prospectId,
          metadata: JSON.stringify({ campaignId: campaign.id, query: candidate.discoveryQuery, sent: false }),
          createdAt: nowIso,
        });
        return true;
      });
      if (inserted) profilesCreated += 1;
      else skippedDuplicates += 1;
    }

    const finishedAt = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.update(discoveryRuns).set({
        status: "completed",
        queriesScanned: browserResult.queriesScanned,
        profilesInspected: browserResult.profilesInspected,
        profilesQualified,
        profilesCreated,
        skippedDuplicates,
        skippedBlocked,
        skippedLowScore,
        finishedAt,
      }).where(eq(discoveryRuns.id, runId));
      await tx.update(campaigns).set({ lastDiscoveryAt: finishedAt, updatedAt: finishedAt }).where(eq(campaigns.id, campaign.id));
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "system",
        action: "campaign_discovery_completed",
        entityType: "campaign",
        entityId: campaign.id,
        metadata: JSON.stringify({ runId, profilesCreated, sent: false }),
        createdAt: finishedAt,
      });
    });
    await scheduleNextCampaignDiscovery({ campaignId: campaign.id, currentJobId: input.jobId, from: new Date(finishedAt) });
    return {
      status: "completed" as const,
      created: profilesCreated,
      qualified: profilesQualified,
      inspected: browserResult.profilesInspected,
    };
  } catch (error) {
    await db.update(discoveryRuns).set({
      status: "failed",
      error: error instanceof Error ? error.message : "Falha desconhecida",
      finishedAt: new Date().toISOString(),
    }).where(eq(discoveryRuns.id, runId));
    throw error;
  }
}
