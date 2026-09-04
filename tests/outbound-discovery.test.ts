import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const testDir = path.join(process.cwd(), ".test-tmp");
const databasePath = path.join(testDir, `artgian-discovery-test-${process.pid}.db`);

describe("execução segura da descoberta", () => {
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
    process.env.INSTAGRAM_DISCOVERY_ENABLED = "true";
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("qualifica, deduplica e cadastra sem criar job de envio", async () => {
    const [{ getCommercialDb }, schema, { executeCampaignDiscovery }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/features/outbound/discovery"),
    ]);
    const db = await getCommercialDb();
    const now = new Date().toISOString();
    await db.insert(schema.campaigns).values({
      id: "discovery-campaign",
      name: "Descoberta segura",
      source: "Instagram",
      segment: "Presentes personalizados",
      status: "active",
      discoveryEnabled: true,
      discoveryKeywords: JSON.stringify(["presente personalizado"]),
      discoveryLocations: JSON.stringify(["Brasil"]),
      discoveryDailyLimit: 5,
      discoveryMinimumScore: 40,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.leads).values({
      id: "blocked-lead",
      instagramUsername: "perfil.bloqueado",
      source: "Teste",
      doNotContact: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.jobs).values({
      id: "discovery-job",
      type: "discover_prospects",
      payload: JSON.stringify({ campaignId: "discovery-campaign" }),
      status: "running",
      scheduledAt: now,
      startedAt: now,
      createdAt: now,
    });

    const result = await executeCampaignDiscovery(
      { jobId: "discovery-job", campaignId: "discovery-campaign" },
      {
        discover: async () => ({
          queriesScanned: 1,
          profilesInspected: 3,
          candidates: [
            {
              instagramUsername: "perfil.novo",
              name: "Perfil Novo",
              sourceUrl: "https://www.instagram.com/perfil.novo/",
              profileBio: "Presentes personalizados e decoração geek",
              profileLocation: "Brasil",
              publicSignal: "que você destaca presentes personalizados",
              discoveryQuery: "presente personalizado",
            },
            {
              instagramUsername: "perfil.bloqueado",
              sourceUrl: "https://www.instagram.com/perfil.bloqueado/",
              profileBio: "Presentes personalizados",
              discoveryQuery: "presente personalizado",
            },
            {
              instagramUsername: "perfil.semaderencia",
              sourceUrl: "https://www.instagram.com/perfil.semaderencia/",
              profileBio: "Assuntos sem relação com a campanha",
              discoveryQuery: "presente personalizado",
            },
          ],
        }),
      },
    );

    expect(result).toMatchObject({ status: "completed", created: 1, qualified: 1 });
    const [prospect] = await db
      .select()
      .from(schema.outboundProspects)
      .where(eq(schema.outboundProspects.instagramUsername, "perfil.novo"));
    expect(prospect).toMatchObject({
      status: "identified",
      contactPolicy: "manual_only",
      discoverySource: "instagram_browser",
    });
    const allJobs = await db.select().from(schema.jobs);
    expect(allJobs.some((job) => job.type === "send_outbound")).toBe(false);
    expect(allJobs.some((job) => job.type === "discover_prospects" && job.status === "pending")).toBe(true);
    const [run] = await db.select().from(schema.discoveryRuns);
    expect(run).toMatchObject({
      status: "completed",
      profilesInspected: 3,
      profilesCreated: 1,
      skippedBlocked: 1,
      skippedLowScore: 1,
    });
  });

  it("permite ao worker processar descoberta sem exigir um lead prévio", async () => {
    const [{ getCommercialDb }, schema, { runWorkerOnce }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/worker/processor"),
    ]);
    const db = await getCommercialDb();
    const now = new Date().toISOString();
    await db.insert(schema.jobs).values({
      id: "worker-discovery-job",
      type: "discover_prospects",
      payload: JSON.stringify({ campaignId: "discovery-campaign" }),
      status: "pending",
      scheduledAt: now,
      createdAt: now,
    });
    const result = await runWorkerOnce("worker-discovery-job", {
      executeDiscoveryJob: async () => ({ status: "completed", created: 2 }),
    });
    expect(result).toMatchObject({ processed: true, discovery: true, created: 2 });
    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, "worker-discovery-job"));
    expect(job.status).toBe("completed");
  });
});
