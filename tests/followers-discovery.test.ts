import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { followersProgressSummary } from "../src/features/outbound/followers-discovery-domain";
const databasePath = path.join(
  process.cwd(),
  ".test-tmp",
  `followers-${process.pid}.db`,
);

describe("seguidores: cotas e retomada persistente", () => {
  beforeAll(async () => {
    await mkdir(path.dirname(databasePath), { recursive: true });
    Object.assign(process.env, {
      DATABASE_URL: `file:${databasePath}`,
      COMMERCIAL_DATABASE_MODE: "local",
      COMMERCIAL_DEMO_MODE: "false",
      INSTAGRAM_DISCOVERY_ENABLED: "true",
      MAX_DISCOVERY_PROFILES_PER_RUN: "10",
    });
  });
  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"])
      await unlink(databasePath + suffix).catch(() => undefined);
  });
  it("pode inspecionar dez perfis com apenas uma vaga diária, criando no máximo um novo", async () => {
    const { getCommercialDb } = await import("../src/db/commercial");
    const s = await import("../db/schema");
    const { executeCampaignDiscovery } =
      await import("../src/features/outbound/discovery");
    const db = await getCommercialDb();
    await db
      .insert(s.campaigns)
      .values({
        id: "followers",
        name: "Seguidores",
        source: "Instagram",
        funnelType: "partner",
        discoveryStrategy: "instagram_followers",
        discoveryBaseProfiles: '["perfilbase"]',
        discoveryEnabled: true,
        discoveryDailyLimit: 5,
        discoveryMinimumScore: 0,
      });
    for (let i = 0; i < 3; i++)
      await db
        .insert(s.outboundProspects)
        .values({
          id: `old-${i}`,
          campaignId: "followers",
          instagramUsername: `old.${i}`,
          discoverySource: "google_maps",
          qualificationReason: "Teste anterior",
          createdAt: new Date().toISOString(),
        });
    await db
      .insert(s.localBusinessOpportunities)
      .values({
        id: "old-site",
        campaignId: "followers",
        businessName: "Site",
        niche: "Manicure",
        location: "Brasil",
        googleMapsUrl: "https://www.google.com/maps/place/Site",
        status: "website_opportunity",
        createdAt: new Date().toISOString(),
      });
    for (const id of ["followers-job", "followers-next"])
      await db
        .insert(s.jobs)
        .values({ id, type: "discover_prospects", status: "running" });
    const result = await executeCampaignDiscovery(
      { jobId: "followers-job", campaignId: "followers" },
      {
        discover: async (input) => {
          expect(input.maximumProfiles).toBe(10);
          expect(input.maximumNewResults).toBe(1);
          await input.onFollowerLinks!("perfilbase", [
            "rejeitado",
            "aprovado",
            "pendente",
            "pendente",
          ]);
          for (const username of ["rejeitado", "aprovado"]) {
            const created = await input.onFollowerBatch!({
              baseUsername: "perfilbase",
              inspectedUsernames: [username],
              unreadableUsernames: [],
              candidates: [
                {
                  instagramUsername: username,
                  sourceUrl: `https://www.instagram.com/${username}/`,
                  profileBio: "Loja de presentes personalizados",
                  discoveryKind: "base_profile",
                  discoveryQuery: "perfilbase",
                },
              ],
            });
            expect(created).toBe(username === "aprovado" ? 1 : 0);
          }
          return {
            candidates: [],
            profilesInspected: 2,
            queriesScanned: 1,
            followerProgress: {
              stopReason: "followers_target_reached",
              visibleUsers: 3,
              skippedKnownUsers: 0,
              scrolls: 1,
              pendingUsers: 1,
              limitedBaseProfiles: ["perfilbase"],
            },
          };
        },
        qualify: async ({ candidates }) => ({
          available: true,
          decisions: candidates.map((candidate, index) => ({
            index,
            fits: candidate.instagramUsername === "aprovado",
            confidence: "high",
            classification: "business",
            reason: "Teste de aderência à campanha",
          })),
        }),
      },
    );
    expect(result.created).toBe(1);
    const queue = await db.select().from(s.followerDiscoveryQueue);
    expect(queue).toHaveLength(3);
    expect(
      queue
        .filter((p) => p.status === "pending")
        .map((p) => p.instagramUsername),
    ).toEqual(["pendente"]);
    const [run] = await db
      .select()
      .from(s.discoveryRuns)
      .where(eq(s.discoveryRuns.jobId, "followers-job"));
    expect(run.stopReason).toBe("followers_target_reached");
    expect(followersProgressSummary(run.followerSearchProgress)).toContain(
      "não representa todos os seguidores",
    );
    const next = await executeCampaignDiscovery(
      { jobId: "followers-next", campaignId: "followers" },
      {
        discover: async () => {
          throw new Error("Cota diária deve bloquear nova busca");
        },
        qualify: async () => {
          throw new Error("Sem IA");
        },
      },
    );
    expect(next).toMatchObject({ dailyLimitReached: true, created: 0 });
    expect(
      (await db.select().from(s.jobs)).every(
        (job) => job.type === "discover_prospects",
      ),
    ).toBe(true);
  });
  it("não conclui a fila quando a qualificação falha", async () => {
    const { getCommercialDb } = await import("../src/db/commercial");
    const s = await import("../db/schema");
    const { executeCampaignDiscovery } =
      await import("../src/features/outbound/discovery");
    const db = await getCommercialDb();
    await db
      .insert(s.campaigns)
      .values({
        id: "failure",
        name: "Falha",
        source: "Instagram",
        funnelType: "partner",
        discoveryStrategy: "instagram_followers",
        discoveryBaseProfiles: '["perfilbase"]',
        discoveryEnabled: true,
        discoveryMinimumScore: 0,
      });
    await db
      .insert(s.jobs)
      .values({
        id: "failure-job",
        type: "discover_prospects",
        status: "running",
      });
    await expect(
      executeCampaignDiscovery(
        { jobId: "failure-job", campaignId: "failure" },
        {
          discover: async (input) => {
            await input.onFollowerLinks!("perfilbase", ["pendente.ai"]);
            await input.onFollowerBatch!({
              baseUsername: "perfilbase",
              inspectedUsernames: ["pendente.ai"],
              unreadableUsernames: [],
              candidates: [
                {
                  instagramUsername: "pendente.ai",
                  sourceUrl: "https://www.instagram.com/pendente.ai/",
                  profileBio: "Loja de presentes",
                  discoveryKind: "base_profile",
                  discoveryQuery: "perfilbase",
                },
              ],
            });
            return { candidates: [], profilesInspected: 1, queriesScanned: 1 };
          },
          qualify: async () => ({
            available: false,
            reason: "IA indisponível no teste",
            decisions: [],
          }),
        },
      ),
    ).rejects.toThrow("IA indisponível");
    const [pending] = await db
      .select()
      .from(s.followerDiscoveryQueue)
      .where(eq(s.followerDiscoveryQueue.campaignId, "failure"));
    expect(pending.status).toBe("pending");
  });
});
