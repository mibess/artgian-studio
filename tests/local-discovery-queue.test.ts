import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const databasePath = path.join(
  process.cwd(),
  ".test-tmp",
  `local-queue-${process.pid}.db`,
);
describe("fila persistente de empresas", () => {
  beforeAll(async () => {
    await mkdir(path.dirname(databasePath), { recursive: true });
    Object.assign(process.env, {
      DATABASE_URL: `file:${databasePath}`,
      COMMERCIAL_DEMO_MODE: "false",
      COMMERCIAL_DATABASE_MODE: "local",
      INSTAGRAM_DISCOVERY_ENABLED: "true",
      MAX_DISCOVERY_PROFILES_PER_RUN: "10",
    });
  });
  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"])
      await unlink(databasePath + suffix).catch(() => undefined);
  });

  it("guarda excedentes, retoma por campanha/critério e separa cota diária de inspeções", async () => {
    const { getCommercialDb } = await import("../src/db/commercial");
    const schema = await import("../db/schema");
    const { executeCampaignDiscovery } =
      await import("../src/features/outbound/discovery");
    const db = await getCommercialDb();
    await db
      .insert(schema.campaigns)
      .values({
        id: "queue",
        name: "Fila",
        source: "Maps",
        discoveryEnabled: true,
        discoveryStrategy: "local_business",
        discoveryLocalNiche: "Manicure",
        discoveryLocalLocation: "Brodowski",
        discoveryDailyLimit: 2,
      });
    const urls = [1, 2, 3].map(
      (id) => `https://www.google.com/maps/place/Empresa${id}`,
    );
    const qualify = vi.fn();
    const run = async (
      jobId: string,
      discover: Parameters<typeof executeCampaignDiscovery>[1]["discover"],
    ) => {
      await db
        .insert(schema.jobs)
        .values({
          id: jobId,
          type: "discover_prospects",
          payload: '{"campaignId":"queue"}',
          status: "running",
        });
      return executeCampaignDiscovery(
        { campaignId: "queue", jobId },
        { discover, qualify },
      );
    };
    await run("queue-job1", async (input) => {
      expect(input.maximumProfiles).toBe(10);
      expect(input.maximumNewResults).toBe(2);
      await input.onLocalLinks!([
        urls[0],
        urls[1],
        urls[2],
        urls[0] + "?hl=en",
      ]);
      const count = await input.onLocalBatch!({
        candidates: [],
        processedUrls: [urls[0]],
        localOpportunities: [
          {
            businessName: "Empresa1",
            niche: "Manicure",
            location: "Brodowski",
            googleMapsUrl: urls[0],
            status: "website_opportunity",
          },
        ],
      });
      expect(count).toBe(1);
      return {
        candidates: [],
        profilesInspected: 1,
        queriesScanned: 1,
        localProgress: {
          stopReason: "time_limit",
          linksSeen: 3,
          skippedKnownBusinesses: 0,
          scrolls: 2,
          pendingBusinesses: 2,
        },
      };
    });
    expect(qualify).not.toHaveBeenCalled();
    const queue = await db.select().from(schema.localDiscoveryQueue);
    expect(queue).toHaveLength(3);
    expect(queue.filter((row) => row.status === "pending")).toHaveLength(2);
    const [firstRun] = await db
      .select()
      .from(schema.discoveryRuns)
      .where(eq(schema.discoveryRuns.jobId, "queue-job1"));
    expect(firstRun.stopReason).toBe("time_limit");
    await run("queue-job2", async (input) => {
      expect(input.maximumProfiles).toBe(10);
      expect(input.maximumNewResults).toBe(1);
      expect(input.pendingLocalBusinessUrls).toEqual([urls[1], urls[2]]);
      expect(input.excludedLocalBusinessUrls).toContain(urls[0]);
      return { candidates: [], queriesScanned: 1, profilesInspected: 0 };
    });
    await db
      .update(schema.campaigns)
      .set({ discoveryLocalNiche: "Mecânica" })
      .where(eq(schema.campaigns.id, "queue"));
    await run("queue-job3", async (input) => {
      expect(input.pendingLocalBusinessUrls).toEqual([]);
      return { candidates: [], queriesScanned: 1, profilesInspected: 0 };
    });
    expect(
      (await db.select().from(schema.jobs)).every(
        (job) => job.type === "discover_prospects",
      ),
    ).toBe(true);
  });

  it("não marca a empresa como processada se a IA estiver indisponível", async () => {
    const { getCommercialDb } = await import("../src/db/commercial");
    const schema = await import("../db/schema");
    const { executeCampaignDiscovery } =
      await import("../src/features/outbound/discovery");
    const db = await getCommercialDb();
    await db
      .insert(schema.campaigns)
      .values({
        id: "failure",
        name: "Falha",
        source: "Maps",
        discoveryEnabled: true,
        discoveryStrategy: "local_business",
        discoveryLocalNiche: "Manicure",
        discoveryLocalLocation: "Brodowski",
      });
    await db
      .insert(schema.jobs)
      .values({
        id: "failure-job",
        type: "discover_prospects",
        status: "running",
      });
    const url = "https://www.google.com/maps/place/Pendente";
    await expect(
      executeCampaignDiscovery(
        { campaignId: "failure", jobId: "failure-job" },
        {
          discover: async (input) => {
            await input.onLocalLinks!([url]);
            await input.onLocalBatch!({
              processedUrls: [url],
              localOpportunities: [
                {
                  businessName: "Pendente",
                  niche: "Manicure",
                  location: "Brodowski",
                  googleMapsUrl: url,
                  instagramUsername: "teste.pendente",
                  status: "instagram_found",
                },
              ],
              candidates: [
                {
                  instagramUsername: "teste.pendente",
                  name: "Manicure",
                  sourceUrl: "https://www.instagram.com/teste.pendente/",
                  profileBio: "Manicure em Brodowski",
                  discoveryKind: "local_business",
                  discoveryQuery: "Manicure em Brodowski",
                },
              ],
            });
            return { candidates: [], queriesScanned: 1, profilesInspected: 1 };
          },
          qualify: async () => ({
            available: false,
            reason: "Teste offline",
            decisions: [],
          }),
        },
      ),
    ).rejects.toThrow("Teste offline");
    const [row] = await db
      .select()
      .from(schema.localDiscoveryQueue)
      .where(eq(schema.localDiscoveryQueue.campaignId, "failure"));
    expect(row.status).toBe("pending");
    expect(
      await db
        .select()
        .from(schema.localBusinessOpportunities)
        .where(eq(schema.localBusinessOpportunities.campaignId, "failure")),
    ).toHaveLength(0);
  });
});
