import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const databasePath = path.join(
  process.cwd(),
  ".test-tmp",
  `hashtag-history-${process.pid}.db`,
);
describe("índice persistente de hashtag, post e usuário", () => {
  beforeAll(async () => {
    await mkdir(path.dirname(databasePath), { recursive: true });
    Object.assign(process.env, {
      DATABASE_URL: `file:${databasePath}`,
      COMMERCIAL_DATABASE_MODE: "local",
      COMMERCIAL_DEMO_MODE: "false",
      INSTAGRAM_DISCOVERY_ENABLED: "true",
    });
  });
  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"])
      await unlink(databasePath + suffix).catch(() => undefined);
  });

  it("persiste posts sem duplicar e exclui autores já qualificados ou temporariamente indisponíveis", async () => {
    const { getCommercialDb } = await import("../src/db/commercial");
    const schema = await import("../db/schema");
    const { executeCampaignDiscovery } =
      await import("../src/features/outbound/discovery");
    const db = await getCommercialDb();
    await db
      .insert(schema.campaigns)
      .values({
        id: "hashtag",
        name: "Parcerias hashtag",
        source: "Instagram",
        discoveryStrategy: "instagram_search",
        discoveryEnabled: true,
        funnelType: "partner",
        segment: "Presentes personalizados",
        discoveryHashtags: '["presentes"]',
        discoveryMinimumScore: 0,
        discoveryDailyLimit: 10,
      });
    const post = {
      postKey: "ABC123",
      postUrl: "https://www.instagram.com/p/ABC123/",
    };
    for (const id of ["hashtag-job1", "hashtag-job2"])
      await db
        .insert(schema.jobs)
        .values({ id, type: "discover_prospects", status: "running" });
    const result = await executeCampaignDiscovery(
      { campaignId: "hashtag", jobId: "hashtag-job1" },
      {
        discover: async (input) => {
          await input.onHashtagLinks!("#Presentes", [
            post,
            post,
            {
              postKey: "DEF456",
              postUrl: "https://www.instagram.com/p/DEF456/",
            },
          ]);
          await input.onHashtagPost!(
            "presentes",
            post.postKey,
            "autor.validado",
          );
          await input.onHashtagProfileUnavailable!(
            "presentes",
            "autor.indisponivel",
          );
          return {
            profilesInspected: 2,
            queriesScanned: 1,
            scannedSeeds: [{ kind: "hashtag", value: "presentes" }],
            candidates: [
              {
                instagramUsername: "autor.validado",
                name: "Ateliê",
                sourceUrl: "https://www.instagram.com/autor.validado/",
                profileBio: "Presentes personalizados e decoração · encomendas",
                profileLocation: "Brasil",
                discoveryKind: "hashtag",
                discoveryQuery: "presentes",
              },
            ],
          };
        },
        qualify: async ({ candidates }) => ({
          available: true,
          decisions: candidates.map((_, index) => ({
            index,
            fits: true,
            confidence: "high",
            classification: "business",
            reason: "Negócio alinhado à campanha",
          })),
        }),
      },
    );
    expect(result.created).toBe(1);
    const rows = await db.select().from(schema.hashtagDiscoveryPosts);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.postKey === "DEF456")?.status).toBe(
      "pending",
    );
    expect(
      rows.find((row) => row.postKey === "ABC123")?.instagramUsername,
    ).toBe("autor.validado");
    const [profile] = await db
      .select()
      .from(schema.discoveryCandidates)
      .where(
        eq(schema.discoveryCandidates.instagramUsername, "autor.validado"),
      );
    expect(profile.lastQueryKind).toBe("hashtag");
    await executeCampaignDiscovery(
      { campaignId: "hashtag", jobId: "hashtag-job2" },
      {
        discover: async (input) => {
          expect(input.excludedUsernames).toContain("autor.validado");
          expect(input.excludedUsernames).toContain("autor.indisponivel");
          expect(
            input.rememberedHashtagPosts?.map((row) => row.postKey).sort(),
          ).toEqual(["ABC123", "DEF456"]);
          return { candidates: [], profilesInspected: 0, queriesScanned: 1 };
        },
        qualify: async () => {
          throw new Error("Não deve chamar IA sem novos perfis");
        },
      },
    );
    expect(
      (await db.select().from(schema.jobs)).every(
        (job) => job.type === "discover_prospects",
      ),
    ).toBe(true);
  });
});
