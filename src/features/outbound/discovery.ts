import { and, eq, gt, gte, inArray, sql } from "drizzle-orm";
import {
  auditLogs,
  campaigns,
  discoveryCandidates,
  discoveryQueryStats,
  discoveryRuns,
  jobs,
  leads,
  localBusinessOpportunities,
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
  discoverySeedKey,
  isLikelyCommercialInstagramProfile,
  isMassAudienceInstagramProfile,
  nextDiscoveryAt,
  normalizeDiscoveryStrategy,
  parseInstagramBaseProfiles,
  parseStoredDiscoveryTerms,
  selectDiscoverySeedsForRun,
  type DiscoverySeed,
  type PublicInstagramCandidate,
  type PublicLocalBusinessOpportunity,
} from "./discovery-domain";
import { scorePublicProfile, type OutboundFunnel } from "./domain";
import type {
  ProspectCampaignFitInput,
  ProspectCampaignFitResult,
} from "../../integrations/openai/prospect-qualification";

type BrowserDiscoveryResult = {
  candidates: PublicInstagramCandidate[];
  queriesScanned: number;
  profilesInspected: number;
  scannedSeeds?: DiscoverySeed[];
  localOpportunities?: PublicLocalBusinessOpportunity[];
};

type DiscoveryBrowser = (input: {
  jobId: string;
  strategy: ReturnType<typeof normalizeDiscoveryStrategy>;
  seeds: DiscoverySeed[];
  maximumProfiles: number;
  knownLocations: string[];
  minimumBaseFollowers: number;
  localNiche?: string;
  localLocation?: string;
  ownUsername?: string;
  excludedUsernames?: string[];
  excludedLocalBusinessUrls?: string[];
}) => Promise<BrowserDiscoveryResult>;

type ProspectQualifier = (input: ProspectCampaignFitInput) => Promise<ProspectCampaignFitResult>;

type CandidateOutcome = "created" | "duplicate" | "blocked" | "low_score" | "ai_rejected";

type QueryRunMetrics = {
  seed: DiscoverySeed;
  searches: number;
  inspected: number;
  qualified: number;
  created: number;
  duplicates: number;
  blocked: number;
  lowScore: number;
};

function discoveryJobPayload(campaignId: string) {
  return JSON.stringify({ campaignId });
}

export async function enqueueCampaignDiscovery(input: {
  campaignId: string;
  scheduledAt?: string;
  excludeJobId?: string;
  rescheduleExisting?: boolean;
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
  if (existing) {
    if (input.rescheduleExisting && input.scheduledAt) {
      await db.update(jobs).set({
        scheduledAt: input.scheduledAt,
        lastError: null,
      }).where(and(eq(jobs.id, existing.id), eq(jobs.status, "pending")));
    }
    return { created: false as const, jobId: existing.id };
  }

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
  dependencies: { discover: DiscoveryBrowser; qualify: ProspectQualifier },
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
  const [todayProfiles, todayLocalOpportunities] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(outboundProspects)
      .where(and(
        eq(outboundProspects.campaignId, campaign.id),
        inArray(outboundProspects.discoverySource, ["instagram_browser", "instagram_followers", "google_maps"]),
        gte(outboundProspects.createdAt, startOfUtcDay(now)),
      )),
    db
      .select({ count: sql<number>`count(*)` })
      .from(localBusinessOpportunities)
      .where(and(
        eq(localBusinessOpportunities.campaignId, campaign.id),
        gte(localBusinessOpportunities.createdAt, startOfUtcDay(now)),
      )),
  ]);
  const alreadyCreatedToday = Number(todayProfiles[0]?.count || 0) +
    Number(todayLocalOpportunities[0]?.count || 0);
  const remaining = Math.max(0, campaign.discoveryDailyLimit - alreadyCreatedToday);
  if (!remaining) {
    await db.update(campaigns).set({ lastDiscoveryAt: nowIso, updatedAt: nowIso }).where(eq(campaigns.id, campaign.id));
    await scheduleNextCampaignDiscovery({ campaignId: campaign.id, currentJobId: input.jobId, from: now });
    return { status: "completed" as const, created: 0, dailyLimitReached: true };
  }

  const business = await getBusinessConfig();
  const keywords = parseStoredDiscoveryTerms(campaign.discoveryKeywords);
  const hashtags = parseStoredDiscoveryTerms(campaign.discoveryHashtags);
  const locations = parseStoredDiscoveryTerms(campaign.discoveryLocations);
  const strategy = normalizeDiscoveryStrategy(campaign.discoveryStrategy);
  const baseProfiles = parseInstagramBaseProfiles(
    parseStoredDiscoveryTerms(campaign.discoveryBaseProfiles).join("\n"),
  );
  const localNiche = campaign.discoveryLocalNiche?.trim() || undefined;
  const localLocation = campaign.discoveryLocalLocation?.trim() || undefined;
  const allSeeds: DiscoverySeed[] = strategy === "instagram_followers"
    ? baseProfiles.map((value) => ({ kind: "base_profile", value }))
    : strategy === "local_business"
      ? localNiche && localLocation
        ? [{ kind: "local_business", value: `${localNiche} em ${localLocation}` }]
        : []
      : buildDiscoverySeeds({
          funnelType: campaign.funnelType as OutboundFunnel,
          segment: campaign.segment,
          keywords,
          hashtags,
          locations,
          business,
        });
  if (!allSeeds.length) throw new Error("A campanha não possui critérios de descoberta.");
  const previousPerformance = await db
    .select()
    .from(discoveryQueryStats)
    .where(eq(discoveryQueryStats.campaignId, campaign.id));
  const seeds = selectDiscoverySeedsForRun({
    seeds: allSeeds,
    cursor: campaign.discoveryCursor,
    maximum: 10,
    performance: previousPerformance.map((item) => ({
      kind: item.queryKind as DiscoverySeed["kind"],
      value: item.query,
      profilesInspected: item.profilesInspected,
      profilesQualified: item.profilesQualified,
      profilesCreated: item.profilesCreated,
      lastSearchedAt: item.lastSearchedAt,
    })),
    explorationPercent: 30,
  });

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
    const rememberedCandidates = await db
      .select({ instagramUsername: discoveryCandidates.instagramUsername })
      .from(discoveryCandidates)
      .where(and(
        eq(discoveryCandidates.campaignId, campaign.id),
        gt(discoveryCandidates.revisitAfter, nowIso),
      ));
    const existingProspects = await db
      .select({ instagramUsername: outboundProspects.instagramUsername })
      .from(outboundProspects);
    const blockedLeads = await db
      .select({ instagramUsername: leads.instagramUsername })
      .from(leads)
      .where(eq(leads.doNotContact, true));
    const knownLocalBusinesses = strategy === "local_business"
      ? await db
          .select({ googleMapsUrl: localBusinessOpportunities.googleMapsUrl })
          .from(localBusinessOpportunities)
          .where(eq(localBusinessOpportunities.campaignId, campaign.id))
      : [];
    const browserResult = await dependencies.discover({
      jobId: input.jobId,
      strategy,
      seeds,
      maximumProfiles,
      knownLocations: locations.length ? locations : [business.targetGeography],
      minimumBaseFollowers: campaign.discoveryMinimumBaseFollowers,
      localNiche,
      localLocation,
      ownUsername: business.company.instagramHandle,
      excludedUsernames: [
        ...rememberedCandidates,
        ...existingProspects,
        ...blockedLeads,
      ].map((item) => item.instagramUsername),
      excludedLocalBusinessUrls: knownLocalBusinesses.map((item) => item.googleMapsUrl),
    });
    let profilesQualified = 0;
    let profilesCreated = 0;
    let skippedDuplicates = 0;
    let skippedBlocked = 0;
    let skippedLowScore = 0;
    let websiteOpportunitiesCreated = 0;

    for (const opportunity of browserResult.localOpportunities || []) {
      const created = await db.insert(localBusinessOpportunities).values({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        businessName: opportunity.businessName,
        niche: opportunity.niche,
        location: opportunity.location,
        address: opportunity.address || null,
        phone: opportunity.phone || null,
        googleMapsUrl: opportunity.googleMapsUrl,
        websiteUrl: opportunity.websiteUrl || null,
        instagramUsername: opportunity.instagramUsername || null,
        status: opportunity.status,
        notes: opportunity.notes || null,
        createdAt: nowIso,
        updatedAt: nowIso,
      }).onConflictDoNothing().returning({ id: localBusinessOpportunities.id });
      if (created.length && opportunity.status === "website_opportunity") {
        websiteOpportunitiesCreated += 1;
      }
      if (created.length) {
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actor: "system",
          action: opportunity.status === "website_opportunity"
            ? "local_website_opportunity_discovered"
            : "local_business_without_instagram_discovered",
          entityType: "local_business_opportunity",
          entityId: created[0].id,
          metadata: JSON.stringify({
            campaignId: campaign.id,
            googleMapsUrl: opportunity.googleMapsUrl,
            sendsMessages: false,
          }),
          createdAt: nowIso,
        });
      }
    }

    const scannedSeeds = browserResult.scannedSeeds || seeds.slice(0, browserResult.queriesScanned);
    const queryMetrics = new Map<string, QueryRunMetrics>();
    for (const seed of scannedSeeds) {
      const key = discoverySeedKey(seed);
      const current = queryMetrics.get(key);
      if (current) current.searches += 1;
      else queryMetrics.set(key, {
        seed,
        searches: 1,
        inspected: 0,
        qualified: 0,
        created: 0,
        duplicates: 0,
        blocked: 0,
        lowScore: 0,
      });
    }
    const revisitDaysValue = Number(process.env.DISCOVERY_REVISIT_DAYS || 45);
    const revisitDays = Number.isFinite(revisitDaysValue)
      ? Math.min(365, Math.max(7, Math.trunc(revisitDaysValue)))
      : 45;
    const rememberCandidate = async (
      candidate: PublicInstagramCandidate,
      instagramUsername: string,
      outcome: CandidateOutcome,
    ) => {
      const matchingSeed = seeds.find((seed) =>
        seed.value.toLocaleLowerCase("pt-BR") === candidate.discoveryQuery.toLocaleLowerCase("pt-BR") &&
        (!candidate.discoveryKind || candidate.discoveryKind === seed.kind));
      const seed = matchingSeed || {
        kind: candidate.discoveryKind || "keyword",
        value: candidate.discoveryQuery,
      } satisfies DiscoverySeed;
      const key = discoverySeedKey(seed);
      let metrics = queryMetrics.get(key);
      if (!metrics) {
        metrics = { seed, searches: 0, inspected: 0, qualified: 0, created: 0, duplicates: 0, blocked: 0, lowScore: 0 };
        queryMetrics.set(key, metrics);
      }
      metrics.inspected += 1;
      if (outcome === "created") {
        metrics.qualified += 1;
        metrics.created += 1;
      } else if (outcome === "duplicate") metrics.duplicates += 1;
      else if (outcome === "blocked") metrics.blocked += 1;
      else metrics.lowScore += 1;
      const permanentOutcome = outcome === "created" || outcome === "duplicate" || outcome === "blocked";
      const revisitAfter = new Date(
        now.getTime() + (permanentOutcome ? 3650 : revisitDays) * 24 * 60 * 60 * 1_000,
      ).toISOString();
      await db.insert(discoveryCandidates).values({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        instagramUsername,
        lastQueryKind: seed.kind,
        lastQuery: seed.value,
        lastOutcome: outcome,
        inspectionCount: 1,
        lastInspectedAt: nowIso,
        revisitAfter,
        createdAt: nowIso,
        updatedAt: nowIso,
      }).onConflictDoUpdate({
        target: [discoveryCandidates.campaignId, discoveryCandidates.instagramUsername],
        set: {
          lastQueryKind: seed.kind,
          lastQuery: seed.value,
          lastOutcome: outcome,
          inspectionCount: sql`${discoveryCandidates.inspectionCount} + 1`,
          lastInspectedAt: nowIso,
          revisitAfter,
          updatedAt: nowIso,
        },
      });
    };

    const effectiveFunnel: OutboundFunnel = strategy === "local_business"
      ? "partner"
      : campaign.funnelType as OutboundFunnel;
    const configuredMaximumConsumerFollowers = Number(
      process.env.MAX_CONSUMER_DISCOVERY_FOLLOWERS || 100_000,
    );
    const maximumConsumerFollowers = Number.isFinite(configuredMaximumConsumerFollowers)
      ? Math.max(1_000, Math.trunc(configuredMaximumConsumerFollowers))
      : 100_000;
    const preparedCandidates: Array<{
      candidate: PublicInstagramCandidate;
      instagramUsername: string;
      lead: typeof leads.$inferSelect | undefined;
      score: ReturnType<typeof scorePublicProfile>;
    }> = [];

    for (const candidate of browserResult.candidates) {
      const instagramUsername = canonicalInstagramUsername(candidate.instagramUsername);
      if (!/^[a-z0-9._]{1,30}$/.test(instagramUsername)) continue;
      if (
        strategy !== "local_business" &&
        campaign.funnelType === "consumer" &&
        (
          isLikelyCommercialInstagramProfile(candidate) ||
          isMassAudienceInstagramProfile(candidate, maximumConsumerFollowers)
        )
      ) {
        skippedLowScore += 1;
        await rememberCandidate(candidate, instagramUsername, "low_score");
        continue;
      }
      const [existingProspect] = await db
        .select({ id: outboundProspects.id })
        .from(outboundProspects)
        .where(eq(outboundProspects.instagramUsername, instagramUsername))
        .limit(1);
      if (existingProspect) {
        skippedDuplicates += 1;
        await rememberCandidate(candidate, instagramUsername, "duplicate");
        continue;
      }
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.instagramUsername, instagramUsername))
        .limit(1);
      if (lead?.doNotContact) {
        skippedBlocked += 1;
        await rememberCandidate(candidate, instagramUsername, "blocked");
        continue;
      }
      const score = scorePublicProfile(
        {
          category: candidate.profileCategory,
          bio: candidate.profileBio,
          location: candidate.profileLocation,
          publicSignal: candidate.publicSignal,
          funnelType: effectiveFunnel,
        },
        business,
      );
      if (score.score < campaign.discoveryMinimumScore) {
        skippedLowScore += 1;
        await rememberCandidate(candidate, instagramUsername, "low_score");
        continue;
      }
      preparedCandidates.push({ candidate, instagramUsername, lead, score });
    }

    const aiValidation = await dependencies.qualify({
      campaign: {
        name: campaign.name,
        funnelType: effectiveFunnel,
        segment: campaign.segment,
        strategy,
        keywords,
        hashtags,
        locations,
        localNiche,
        localLocation,
      },
      candidates: preparedCandidates.map((item) => item.candidate),
    });
    if (!aiValidation.available) {
      throw new Error(`Qualificação pela IA rápida indisponível: ${aiValidation.reason}`);
    }
    const aiDecisions = new Map(
      aiValidation.decisions.map((decision) => [decision.index, decision]),
    );

    for (const [candidateIndex, prepared] of preparedCandidates.entries()) {
      const { candidate, instagramUsername, score } = prepared;
      let lead = prepared.lead;
      const aiDecision = aiDecisions.get(candidateIndex);
      if (!aiDecision || !aiDecision.fits || aiDecision.confidence === "low") {
        skippedLowScore += 1;
        await rememberCandidate(candidate, instagramUsername, "ai_rejected");
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actor: "system",
          action: "campaign_candidate_rejected_by_fast_ai",
          entityType: "instagram_profile",
          entityId: instagramUsername,
          metadata: JSON.stringify({
            campaignId: campaign.id,
            reason: aiDecision?.reason || "Decisão ausente",
            classification: aiDecision?.classification || "unknown",
            confidence: aiDecision?.confidence || "low",
            sendsMessages: false,
          }),
          createdAt: nowIso,
        });
        continue;
      }
      profilesQualified += 1;
      const prospectId = crypto.randomUUID();
      const qualificationReason = buildDiscoveryQualificationReason({
        query: candidate.discoveryQuery,
        score: score.score,
        matches: score.matches,
        aiReason: aiDecision.reason,
        aiConfidence: aiDecision.confidence,
      });
      const inserted = await db.transaction(async (tx) => {
        if (!lead) {
          const leadId = crypto.randomUUID();
          await tx.insert(leads).values({
            id: leadId,
            instagramUsername,
            name: candidate.name || null,
            leadType: effectiveFunnel === "partner" ? "partner" : "consumer",
            source: strategy === "local_business"
              ? `Google Maps · ${campaign.name}`
              : `Descoberta Instagram · ${campaign.name}`,
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
          discoverySource: strategy === "instagram_followers"
            ? "instagram_followers"
            : strategy === "local_business"
              ? "google_maps"
              : "instagram_browser",
          discoveryQuery: candidate.discoveryQuery,
          qualificationReason,
          funnelType: effectiveFunnel,
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
            aiValidation: aiDecision,
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
          metadata: JSON.stringify({ campaignId: campaign.id, query: candidate.discoveryQuery, aiValidation: aiDecision, sent: false }),
          createdAt: nowIso,
        });
        return true;
      });
      if (inserted) {
        profilesCreated += 1;
        await rememberCandidate(candidate, instagramUsername, "created");
      } else {
        skippedDuplicates += 1;
        await rememberCandidate(candidate, instagramUsername, "duplicate");
      }
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
        websiteOpportunitiesCreated,
        finishedAt,
      }).where(eq(discoveryRuns.id, runId));
      await tx.update(campaigns).set({
        discoveryCursor: campaign.discoveryCursor + 1,
        lastDiscoveryAt: finishedAt,
        updatedAt: finishedAt,
      }).where(eq(campaigns.id, campaign.id));
      for (const metrics of queryMetrics.values()) {
        await tx.insert(discoveryQueryStats).values({
          id: crypto.randomUUID(),
          campaignId: campaign.id,
          queryKind: metrics.seed.kind,
          query: metrics.seed.value,
          searches: metrics.searches,
          profilesInspected: metrics.inspected,
          profilesQualified: metrics.qualified,
          profilesCreated: metrics.created,
          skippedDuplicates: metrics.duplicates,
          skippedBlocked: metrics.blocked,
          skippedLowScore: metrics.lowScore,
          lastSearchedAt: finishedAt,
          createdAt: finishedAt,
          updatedAt: finishedAt,
        }).onConflictDoUpdate({
          target: [
            discoveryQueryStats.campaignId,
            discoveryQueryStats.queryKind,
            discoveryQueryStats.query,
          ],
          set: {
            searches: sql`${discoveryQueryStats.searches} + ${metrics.searches}`,
            profilesInspected: sql`${discoveryQueryStats.profilesInspected} + ${metrics.inspected}`,
            profilesQualified: sql`${discoveryQueryStats.profilesQualified} + ${metrics.qualified}`,
            profilesCreated: sql`${discoveryQueryStats.profilesCreated} + ${metrics.created}`,
            skippedDuplicates: sql`${discoveryQueryStats.skippedDuplicates} + ${metrics.duplicates}`,
            skippedBlocked: sql`${discoveryQueryStats.skippedBlocked} + ${metrics.blocked}`,
            skippedLowScore: sql`${discoveryQueryStats.skippedLowScore} + ${metrics.lowScore}`,
            lastSearchedAt: finishedAt,
            updatedAt: finishedAt,
          },
        });
      }
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "system",
        action: "campaign_discovery_completed",
        entityType: "campaign",
        entityId: campaign.id,
        metadata: JSON.stringify({
          runId,
          profilesCreated,
          websiteOpportunitiesCreated,
          strategy,
          cursor: campaign.discoveryCursor,
          nextCursor: campaign.discoveryCursor + 1,
          seeds: scannedSeeds,
          sent: false,
        }),
        createdAt: finishedAt,
      });
    });
    await scheduleNextCampaignDiscovery({ campaignId: campaign.id, currentJobId: input.jobId, from: new Date(finishedAt) });
    return {
      status: "completed" as const,
      created: profilesCreated,
      qualified: profilesQualified,
      inspected: browserResult.profilesInspected,
      websiteOpportunitiesCreated,
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
