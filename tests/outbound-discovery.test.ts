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
    const [{ getCommercialDb }, schema, { enqueueCampaignDiscovery, executeCampaignDiscovery }] = await Promise.all([
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
          profilesInspected: 4,
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
            {
              instagramUsername: "loja.presentes",
              name: "Loja de Presentes",
              sourceUrl: "https://www.instagram.com/loja.presentes/",
              profileBio: "Loja de decoração geek · encomendas pelo WhatsApp",
              publicSignal: "que você destaca decoração geek",
              discoveryQuery: "decoração geek",
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
      profilesInspected: 4,
      profilesCreated: 1,
      skippedBlocked: 1,
      skippedLowScore: 2,
    });
    const remembered = await db.select().from(schema.discoveryCandidates);
    expect(remembered).toHaveLength(4);
    expect(remembered.find((item) => item.instagramUsername === "perfil.semaderencia")?.lastOutcome)
      .toBe("low_score");
    const queryStats = await db.select().from(schema.discoveryQueryStats);
    expect(queryStats.find((item) => item.query === "presente personalizado")).toMatchObject({
      searches: 1,
      profilesInspected: 3,
      profilesCreated: 1,
    });
    const [campaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, "discovery-campaign"));
    expect(campaign.discoveryCursor).toBe(1);

    const requestedAt = new Date(Date.now() - 1_000).toISOString();
    const rescheduled = await enqueueCampaignDiscovery({
      campaignId: "discovery-campaign",
      scheduledAt: requestedAt,
      rescheduleExisting: true,
    });
    const [rescheduledJob] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, rescheduled.jobId));
    expect(rescheduled).toMatchObject({ created: false });
    expect(rescheduledJob.scheduledAt).toBe(requestedAt);
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

  it("registra empresas sem site como oportunidade local sem criar contato", async () => {
    const [{ getCommercialDb }, schema, { executeCampaignDiscovery }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/features/outbound/discovery"),
    ]);
    const db = await getCommercialDb();
    const now = new Date().toISOString();
    await db.insert(schema.campaigns).values({
      id: "local-discovery-campaign",
      name: "Mecânicas de Brodowski",
      source: "Google Maps",
      segment: "Mecânicas",
      funnelType: "partner",
      status: "active",
      discoveryEnabled: true,
      discoveryStrategy: "local_business",
      discoveryLocalNiche: "Mecânica automotiva",
      discoveryLocalLocation: "Brodowski, SP",
      discoveryDailyLimit: 5,
      discoveryMinimumScore: 0,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.jobs).values({
      id: "local-discovery-job",
      type: "discover_prospects",
      payload: JSON.stringify({ campaignId: "local-discovery-campaign" }),
      status: "running",
      scheduledAt: now,
      startedAt: now,
      createdAt: now,
    });
    let receivedStrategy = "";
    const result = await executeCampaignDiscovery(
      { jobId: "local-discovery-job", campaignId: "local-discovery-campaign" },
      {
        discover: async (input) => {
          receivedStrategy = input.strategy;
          expect(input.localNiche).toBe("Mecânica automotiva");
          expect(input.localLocation).toBe("Brodowski, SP");
          expect(input.seeds).toEqual([{
            kind: "local_business",
            value: "Mecânica automotiva em Brodowski, SP",
          }]);
          return {
            queriesScanned: 1,
            profilesInspected: 1,
            candidates: [],
            localOpportunities: [{
              businessName: "Auto Mecânica Exemplo",
              niche: "Mecânica automotiva",
              location: "Brodowski, SP",
              address: "Rua Teste, 10",
              phone: "(16) 3000-0000",
              googleMapsUrl: "https://www.google.com/maps/place/auto-mecanica-exemplo",
              status: "website_opportunity" as const,
            }],
          };
        },
      },
    );

    expect(receivedStrategy).toBe("local_business");
    expect(result).toMatchObject({
      status: "completed",
      created: 0,
      websiteOpportunitiesCreated: 1,
    });
    const opportunities = await db.select().from(schema.localBusinessOpportunities);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      businessName: "Auto Mecânica Exemplo",
      status: "website_opportunity",
      websiteUrl: null,
    });
    const outboundJobs = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.type, "send_outbound"));
    expect(outboundJobs).toHaveLength(0);
  });

  it("não consome descoberta quando o executor local não está disponível", async () => {
    const [{ getCommercialDb }, schema, { runWorkerOnce }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/worker/processor"),
    ]);
    const db = await getCommercialDb();
    const now = new Date().toISOString();
    await db.insert(schema.jobs).values({
      id: "cloud-must-skip-discovery",
      type: "discover_prospects",
      payload: JSON.stringify({ campaignId: "discovery-campaign" }),
      status: "pending",
      scheduledAt: now,
      createdAt: now,
    });

    expect(await runWorkerOnce()).toEqual({ processed: false });
    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, "cloud-must-skip-discovery"));
    expect(job).toMatchObject({ status: "pending", attempts: 0 });
  });
});
