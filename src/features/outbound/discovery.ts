import { and, asc, eq, gt, gte, inArray, ne, sql } from "drizzle-orm";
import {
  auditLogs,
  campaigns,
  discoveryCandidates,
  discoveryQueryStats,
  discoveryRuns,
  jobs,
  leads,
  localBusinessOpportunities,
  localDiscoveryQueue,
  outboundProspects,
} from "../../../db/schema";
import { getBusinessConfig } from "../../config/business";
import { getCommercialDb, getSystemSettings } from "../../db/commercial";
import {
  buildDiscoverySeeds,
  discoverySeedKey,
  LOCAL_WEB_RESULTS_VERIFIED_MARKER,
  nextDiscoveryAt,
  normalizeLocalDiscoveryTerm,
  normalizeDiscoveryStrategy,
  parseInstagramBaseProfiles,
  parseStoredDiscoveryTerms,
  selectDiscoverySeedsForRun,
  type DiscoverySeed,
  type PublicInstagramCandidate,
  type PublicLocalBusinessOpportunity,
} from "./discovery-domain";
import type { OutboundFunnel } from "./domain";
import {
  qualifyAndStoreCandidates,
  type CandidateOutcome,
  type ProspectQualifier,
} from "./candidate-qualification";
import {
  boundedDiscoverySetting,
  localDiscoveryQueryKey,
  mapsBusinessKey,
  type LocalDiscoveryOptions,
  type LocalDiscoveryProgress,
} from "./local-discovery-domain";

type BrowserDiscoveryResult = {
  candidates: PublicInstagramCandidate[];
  queriesScanned: number;
  profilesInspected: number;
  scannedSeeds?: DiscoverySeed[];
  localOpportunities?: PublicLocalBusinessOpportunity[];
  localProgress?: LocalDiscoveryProgress;
};

type DiscoveryBrowser = (
  input: LocalDiscoveryOptions & {
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
  },
) => Promise<BrowserDiscoveryResult>;

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
      return (
        (JSON.parse(job.payload) as { campaignId?: string }).campaignId ===
        input.campaignId
      );
    } catch {
      return false;
    }
  });
  if (existing) {
    if (input.rescheduleExisting && input.scheduledAt) {
      await db
        .update(jobs)
        .set({
          scheduledAt: input.scheduledAt,
          lastError: null,
        })
        .where(and(eq(jobs.id, existing.id), eq(jobs.status, "pending")));
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
    .where(
      and(eq(jobs.type, "discover_prospects"), eq(jobs.status, "pending")),
    );
  const ids = pending.flatMap((job) => {
    try {
      return (JSON.parse(job.payload) as { campaignId?: string }).campaignId ===
        campaignId
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
    scheduledAt: nextDiscoveryAt(
      input.from || new Date(),
      campaign.discoveryIntervalHours,
    ),
  });
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
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
    return {
      status: "paused" as const,
      reason: "Descoberta pausada no painel.",
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const [todayProfiles, todayLocalOpportunities] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(outboundProspects)
      .where(
        and(
          eq(outboundProspects.campaignId, campaign.id),
          inArray(outboundProspects.discoverySource, [
            "instagram_browser",
            "instagram_followers",
            "google_maps",
          ]),
          gte(outboundProspects.createdAt, startOfUtcDay(now)),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(localBusinessOpportunities)
      .where(
        and(
          eq(localBusinessOpportunities.campaignId, campaign.id),
          inArray(localBusinessOpportunities.status, [
            "website_opportunity",
            "instagram_not_found",
          ]),
          gte(localBusinessOpportunities.createdAt, startOfUtcDay(now)),
        ),
      ),
  ]);
  const alreadyCreatedToday =
    Number(todayProfiles[0]?.count || 0) +
    Number(todayLocalOpportunities[0]?.count || 0);
  const remaining = Math.max(
    0,
    campaign.discoveryDailyLimit - alreadyCreatedToday,
  );
  if (!remaining) {
    await db
      .insert(discoveryRuns)
      .values({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        jobId: input.jobId,
        status: "completed",
        stopReason: "daily_limit",
        startedAt: nowIso,
        finishedAt: nowIso,
      });
    await db
      .update(campaigns)
      .set({ lastDiscoveryAt: nowIso, updatedAt: nowIso })
      .where(eq(campaigns.id, campaign.id));
    await scheduleNextCampaignDiscovery({
      campaignId: campaign.id,
      currentJobId: input.jobId,
      from: now,
    });
    return {
      status: "completed" as const,
      created: 0,
      dailyLimitReached: true,
    };
  }

  const business = await getBusinessConfig();
  const keywords = parseStoredDiscoveryTerms(campaign.discoveryKeywords);
  const hashtags = parseStoredDiscoveryTerms(campaign.discoveryHashtags);
  const locations = parseStoredDiscoveryTerms(campaign.discoveryLocations);
  const strategy = normalizeDiscoveryStrategy(campaign.discoveryStrategy);
  const baseProfiles = parseInstagramBaseProfiles(
    parseStoredDiscoveryTerms(campaign.discoveryBaseProfiles).join("\n"),
  );
  const localNiche = campaign.discoveryLocalNiche
    ? normalizeLocalDiscoveryTerm(campaign.discoveryLocalNiche) || undefined
    : undefined;
  const localLocation = campaign.discoveryLocalLocation
    ? normalizeLocalDiscoveryTerm(campaign.discoveryLocalLocation) || undefined
    : undefined;
  const allSeeds: DiscoverySeed[] =
    strategy === "instagram_followers"
      ? baseProfiles.map((value) => ({ kind: "base_profile", value }))
      : strategy === "local_business"
        ? localNiche && localLocation
          ? [
              {
                kind: "local_business",
                value: `${localNiche} em ${localLocation}`,
              },
            ]
          : []
        : buildDiscoverySeeds({
            funnelType: campaign.funnelType as OutboundFunnel,
            segment: campaign.segment,
            keywords,
            hashtags,
            locations,
            business,
          });
  if (!allSeeds.length)
    throw new Error("A campanha não possui critérios de descoberta.");
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
    const configuredRunLimit = boundedDiscoverySetting(
      process.env.MAX_DISCOVERY_PROFILES_PER_RUN,
      10,
      30,
    );
    const maximumProfiles =
      strategy === "local_business"
        ? configuredRunLimit
        : Math.min(remaining, configuredRunLimit);
    const rememberedCandidates = await db
      .select({
        instagramUsername: discoveryCandidates.instagramUsername,
        lastQueryKind: discoveryCandidates.lastQueryKind,
        lastOutcome: discoveryCandidates.lastOutcome,
      })
      .from(discoveryCandidates)
      .where(
        and(
          eq(discoveryCandidates.campaignId, campaign.id),
          gt(discoveryCandidates.revisitAfter, nowIso),
        ),
      );
    const existingProspects = await db
      .select({ instagramUsername: outboundProspects.instagramUsername })
      .from(outboundProspects);
    const blockedLeads = await db
      .select({ instagramUsername: leads.instagramUsername })
      .from(leads)
      .where(eq(leads.doNotContact, true));
    const knownLocalBusinesses =
      strategy === "local_business"
        ? await db
            .select({
              googleMapsUrl: localBusinessOpportunities.googleMapsUrl,
              status: localBusinessOpportunities.status,
              notes: localBusinessOpportunities.notes,
            })
            .from(localBusinessOpportunities)
            .where(eq(localBusinessOpportunities.campaignId, campaign.id))
        : [];
    let websiteOpportunitiesCreated = 0;
    let pendingOpportunitiesCreated = 0;
    const knownByKey = new Map(
      knownLocalBusinesses.map((item) => [
        mapsBusinessKey(item.googleMapsUrl),
        item,
      ]),
    );
    async function persistOpportunities(
      opportunities: PublicLocalBusinessOpportunity[],
    ) {
      for (const rawOpportunity of opportunities) {
        const key = mapsBusinessKey(rawOpportunity.googleMapsUrl);
        const opportunity = {
          ...rawOpportunity,
          googleMapsUrl:
            knownByKey.get(key)?.googleMapsUrl || rawOpportunity.googleMapsUrl,
        };
        const [existingOpportunity] = await db
          .select({ id: localBusinessOpportunities.id })
          .from(localBusinessOpportunities)
          .where(
            and(
              eq(localBusinessOpportunities.campaignId, campaign.id),
              eq(
                localBusinessOpportunities.googleMapsUrl,
                opportunity.googleMapsUrl,
              ),
            ),
          )
          .limit(1);
        const opportunityId = existingOpportunity?.id || crypto.randomUUID();
        await db
          .insert(localBusinessOpportunities)
          .values({
            id: opportunityId,
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
          })
          .onConflictDoUpdate({
            target: [
              localBusinessOpportunities.campaignId,
              localBusinessOpportunities.googleMapsUrl,
            ],
            set: {
              businessName: opportunity.businessName,
              niche: opportunity.niche,
              location: opportunity.location,
              address: opportunity.address || null,
              phone: opportunity.phone || null,
              websiteUrl: opportunity.websiteUrl || null,
              instagramUsername: opportunity.instagramUsername || null,
              status: opportunity.status,
              notes: opportunity.notes || null,
              updatedAt: nowIso,
            },
            // Um resultado antigo de busca não pode reabrir uma empresa já conciliada.
            setWhere: ne(localBusinessOpportunities.status, "instagram_found"),
          });
        knownByKey.set(key, {
          googleMapsUrl: opportunity.googleMapsUrl,
          status: opportunity.status,
          notes: opportunity.notes || null,
        });
        const wasCreated = !existingOpportunity;
        if (wasCreated && opportunity.status !== "instagram_found")
          pendingOpportunitiesCreated += 1;
        if (wasCreated && opportunity.status === "website_opportunity") {
          websiteOpportunitiesCreated += 1;
        }
        if (wasCreated || opportunity.status === "instagram_found") {
          await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actor: "system",
            action:
              opportunity.status === "instagram_found"
                ? "local_business_instagram_reconciled"
                : opportunity.status === "website_opportunity"
                  ? "local_website_opportunity_discovered"
                  : "local_business_without_instagram_discovered",
            entityType: "local_business_opportunity",
            entityId: opportunityId,
            metadata: JSON.stringify({
              campaignId: campaign.id,
              googleMapsUrl: opportunity.googleMapsUrl,
              sendsMessages: false,
            }),
            createdAt: nowIso,
          });
        }
      }
    }
    const queryMetrics = new Map<string, QueryRunMetrics>();
    const revisitDaysValue = Number(process.env.DISCOVERY_REVISIT_DAYS || 45);
    const revisitDays = Number.isFinite(revisitDaysValue)
      ? Math.min(365, Math.max(7, Math.trunc(revisitDaysValue)))
      : 45;
    const rememberCandidate = async (
      candidate: PublicInstagramCandidate,
      instagramUsername: string,
      outcome: CandidateOutcome,
    ) => {
      const matchingSeed = seeds.find(
        (seed) =>
          seed.value.toLocaleLowerCase("pt-BR") ===
            candidate.discoveryQuery.toLocaleLowerCase("pt-BR") &&
          (!candidate.discoveryKind || candidate.discoveryKind === seed.kind),
      );
      const seed =
        matchingSeed ||
        ({
          kind: candidate.discoveryKind || "keyword",
          value: candidate.discoveryQuery,
        } satisfies DiscoverySeed);
      const key = discoverySeedKey(seed);
      let metrics = queryMetrics.get(key);
      if (!metrics) {
        metrics = {
          seed,
          searches: 0,
          inspected: 0,
          qualified: 0,
          created: 0,
          duplicates: 0,
          blocked: 0,
          lowScore: 0,
        };
        queryMetrics.set(key, metrics);
      }
      metrics.inspected += 1;
      if (outcome === "created") {
        metrics.qualified += 1;
        metrics.created += 1;
      } else if (outcome === "duplicate") metrics.duplicates += 1;
      else if (outcome === "blocked") metrics.blocked += 1;
      else metrics.lowScore += 1;
      const permanentOutcome =
        outcome === "created" ||
        outcome === "duplicate" ||
        outcome === "blocked";
      const revisitAfter = new Date(
        now.getTime() +
          (permanentOutcome ? 3650 : revisitDays) * 24 * 60 * 60 * 1_000,
      ).toISOString();
      await db
        .insert(discoveryCandidates)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [
            discoveryCandidates.campaignId,
            discoveryCandidates.instagramUsername,
          ],
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

    const queryKey = localDiscoveryQueryKey(
      localNiche || "",
      localLocation || "",
    );
    const queued =
      strategy === "local_business"
        ? await db
            .select()
            .from(localDiscoveryQueue)
            .where(
              and(
                eq(localDiscoveryQueue.campaignId, campaign.id),
                eq(localDiscoveryQueue.queryKey, queryKey),
              ),
            )
            .orderBy(
              asc(localDiscoveryQueue.createdAt),
              asc(localDiscoveryQueue.businessKey),
            )
        : [];
    let profilesQualified = 0,
      profilesCreated = 0,
      skippedDuplicates = 0,
      skippedBlocked = 0,
      skippedLowScore = 0;
    async function qualifyBatch(candidates: PublicInstagramCandidate[]) {
      if (!candidates.length) return;
      const result = await qualifyAndStoreCandidates({
        campaign,
        candidates,
        business,
        qualify: dependencies.qualify,
        rememberCandidate,
      });
      profilesQualified += result.profilesQualified;
      profilesCreated += result.profilesCreated;
      skippedDuplicates += result.skippedDuplicates;
      skippedBlocked += result.skippedBlocked;
      skippedLowScore += result.skippedLowScore;
    }
    const browserResult = await dependencies.discover({
      jobId: input.jobId,
      strategy,
      seeds,
      maximumProfiles,
      maximumNewResults: remaining,
      pendingLocalBusinessUrls: queued
        .filter((row) => row.status === "pending")
        .map((row) => row.googleMapsUrl),
      onLocalLinks:
        strategy === "local_business"
          ? async (urls) => {
              for (const url of urls) {
                const businessKey = mapsBusinessKey(url);
                if (!businessKey) continue;
                await db
                  .insert(localDiscoveryQueue)
                  .values({
                    campaignId: campaign.id,
                    queryKey,
                    businessKey,
                    googleMapsUrl: url,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  })
                  .onConflictDoNothing();
              }
            }
          : undefined,
      onLocalBatch:
        strategy === "local_business"
          ? async (batch) => {
              const before = profilesCreated + pendingOpportunitiesCreated;
              // Persist qualification first. On AI/read failure the queue stays pending.
              await qualifyBatch(batch.candidates);
              await persistOpportunities(batch.localOpportunities);
              const keys = batch.processedUrls.flatMap(
                (url) => mapsBusinessKey(url) || [],
              );
              if (keys.length)
                await db
                  .update(localDiscoveryQueue)
                  .set({
                    status: "completed",
                    updatedAt: new Date().toISOString(),
                  })
                  .where(
                    and(
                      eq(localDiscoveryQueue.campaignId, campaign.id),
                      eq(localDiscoveryQueue.queryKey, queryKey),
                      inArray(localDiscoveryQueue.businessKey, keys),
                    ),
                  );
              // Keep completed batch counts even if a later page or AI call fails.
              await db
                .update(discoveryRuns)
                .set({
                  queriesScanned: 1,
                  profilesInspected: sql`${discoveryRuns.profilesInspected} + ${batch.processedUrls.length}`,
                  profilesQualified,
                  profilesCreated,
                  skippedDuplicates,
                  skippedBlocked,
                  skippedLowScore,
                  websiteOpportunitiesCreated,
                })
                .where(eq(discoveryRuns.id, runId));
              return profilesCreated + pendingOpportunitiesCreated - before;
            }
          : undefined,
      knownLocations:
        strategy === "local_business" && localLocation
          ? [
              ...new Set([
                localLocation,
                ...locations,
                business.targetGeography,
              ]),
            ]
          : locations.length
            ? locations
            : [business.targetGeography],
      minimumBaseFollowers: campaign.discoveryMinimumBaseFollowers,
      localNiche,
      localLocation,
      ownUsername: business.company.instagramHandle,
      excludedUsernames: [
        ...rememberedCandidates.filter(
          (item) =>
            !(
              strategy === "local_business" &&
              item.lastQueryKind === "local_business" &&
              item.lastOutcome === "low_score"
            ),
        ),
        ...existingProspects,
        ...blockedLeads,
      ].map((item) => item.instagramUsername),
      excludedLocalBusinessUrls: [
        ...queued
          .filter((row) => row.status === "completed")
          .map((row) => row.googleMapsUrl),
        ...knownLocalBusinesses
          .filter(
            (item) =>
              item.status === "instagram_found" ||
              item.notes?.includes(LOCAL_WEB_RESULTS_VERIFIED_MARKER),
          )
          .map((item) => item.googleMapsUrl),
      ],
    });

    const scannedSeeds =
      browserResult.scannedSeeds ||
      seeds.slice(0, browserResult.queriesScanned);
    for (const seed of scannedSeeds) {
      const key = discoverySeedKey(seed);
      const current = queryMetrics.get(key);
      if (current) current.searches += 1;
      else
        queryMetrics.set(key, {
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

    await qualifyBatch(browserResult.candidates);
    await persistOpportunities(browserResult.localOpportunities || []);

    const finishedAt = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx
        .update(discoveryRuns)
        .set({
          status: "completed",
          queriesScanned: browserResult.queriesScanned,
          profilesInspected: browserResult.profilesInspected,
          stopReason: browserResult.localProgress?.stopReason || null,
          localSearchProgress: browserResult.localProgress
            ? JSON.stringify(browserResult.localProgress)
            : null,
          profilesQualified,
          profilesCreated,
          skippedDuplicates,
          skippedBlocked,
          skippedLowScore,
          websiteOpportunitiesCreated,
          finishedAt,
        })
        .where(eq(discoveryRuns.id, runId));
      await tx
        .update(campaigns)
        .set({
          discoveryCursor: campaign.discoveryCursor + 1,
          lastDiscoveryAt: finishedAt,
          updatedAt: finishedAt,
        })
        .where(eq(campaigns.id, campaign.id));
      for (const metrics of queryMetrics.values()) {
        await tx
          .insert(discoveryQueryStats)
          .values({
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
          })
          .onConflictDoUpdate({
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
    await scheduleNextCampaignDiscovery({
      campaignId: campaign.id,
      currentJobId: input.jobId,
      from: new Date(finishedAt),
    });
    return {
      status: "completed" as const,
      created: profilesCreated,
      qualified: profilesQualified,
      inspected: browserResult.profilesInspected,
      websiteOpportunitiesCreated,
    };
  } catch (error) {
    await db
      .update(discoveryRuns)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Falha desconhecida",
        finishedAt: new Date().toISOString(),
      })
      .where(eq(discoveryRuns.id, runId));
    throw error;
  }
}
