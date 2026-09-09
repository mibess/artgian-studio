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
          profilesInspected: 5,
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
            {
              instagramUsername: "perfil.duvidoso",
              name: "Perfil Duvidoso",
              sourceUrl: "https://www.instagram.com/perfil.duvidoso/",
              profileBio: "Presentes personalizados e decoração geek",
              profileLocation: "Brasil",
              publicSignal: "que você destaca presentes personalizados",
              discoveryQuery: "presente personalizado",
            },
          ],
        }),
        qualify: async ({ candidates }) => ({
          available: true as const,
          decisions: candidates.map((candidate, index) => ({
            index,
            fits: candidate.instagramUsername !== "perfil.duvidoso",
            confidence: "high" as const,
            classification: candidate.instagramUsername === "perfil.duvidoso"
              ? "unknown" as const
              : "consumer" as const,
            reason: candidate.instagramUsername === "perfil.duvidoso"
              ? "Não há evidência suficiente de intenção de compra"
              : "Perfil pessoal compatível com presentes personalizados",
          })),
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
      profilesInspected: 5,
      profilesCreated: 1,
      skippedBlocked: 1,
      skippedLowScore: 3,
    });
    const remembered = await db.select().from(schema.discoveryCandidates);
    expect(remembered).toHaveLength(5);
    expect(remembered.find((item) => item.instagramUsername === "perfil.semaderencia")?.lastOutcome)
      .toBe("low_score");
    expect(remembered.find((item) => item.instagramUsername === "perfil.duvidoso")?.lastOutcome)
      .toBe("ai_rejected");
    const queryStats = await db.select().from(schema.discoveryQueryStats);
    expect(queryStats.find((item) => item.query === "presente personalizado")).toMatchObject({
      searches: 1,
      profilesInspected: 4,
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
        qualify: async () => ({ available: true as const, decisions: [] }),
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

  it("reprocessa oportunidade antiga, reconcilia o Instagram e deixa a IA decidir", async () => {
    const [{ getCommercialDb }, schema, { executeCampaignDiscovery }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/features/outbound/discovery"),
    ]);
    const db = await getCommercialDb();
    const now = new Date().toISOString();
    const mapsUrl = "https://www.google.com/maps/place/studio-local";
    await db.insert(schema.campaigns).values({
      id: "local-recheck-campaign",
      name: "Parcerias locais",
      source: "Google Maps",
      segment: "Decoração e Utilidades",
      funnelType: "partner",
      status: "active",
      discoveryEnabled: true,
      discoveryStrategy: "local_business",
      discoveryLocalNiche: "Manicuri e pedicuri",
      discoveryLocalLocation: "Brodowski SP",
      discoveryDailyLimit: 5,
      discoveryMinimumScore: 40,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.localBusinessOpportunities).values({
      id: "old-local-opportunity",
      campaignId: "local-recheck-campaign",
      businessName: "Studio Local",
      niche: "Manicuri e pedicuri",
      location: "Brodowski SP",
      googleMapsUrl: mapsUrl,
      status: "website_opportunity",
      notes: "Nenhum site ou Instagram foi identificado.",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.discoveryCandidates).values({
      id: "old-local-candidate",
      campaignId: "local-recheck-campaign",
      instagramUsername: "studio.local",
      lastQueryKind: "local_business",
      lastQuery: "Manicuri e pedicuri em Brodowski SP",
      lastOutcome: "low_score",
      lastInspectedAt: now,
      revisitAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.jobs).values({
      id: "local-recheck-job",
      type: "discover_prospects",
      payload: JSON.stringify({ campaignId: "local-recheck-campaign" }),
      status: "running",
      scheduledAt: now,
      startedAt: now,
      createdAt: now,
    });

    let candidatesSentToAi = 0;
    const result = await executeCampaignDiscovery(
      { jobId: "local-recheck-job", campaignId: "local-recheck-campaign" },
      {
        discover: async (input) => {
          expect(input.localNiche).toBe("manicure e pedicure");
          expect(input.excludedLocalBusinessUrls).not.toContain(mapsUrl);
          expect(input.excludedUsernames).not.toContain("studio.local");
          return {
            queriesScanned: 1,
            profilesInspected: 1,
            candidates: [{
              instagramUsername: "studio.local",
              name: "Studio Local",
              sourceUrl: "https://www.instagram.com/studio.local/",
              profileBio: "Atendimento com hora marcada",
              publicSignal: "Empresa encontrada no Google Maps",
              discoveryKind: "local_business" as const,
              discoveryQuery: "manicure e pedicure em Brodowski SP",
              localBusinessUrl: mapsUrl,
            }],
            localOpportunities: [{
              businessName: "Studio Local",
              niche: "manicure e pedicure",
              location: "Brodowski SP",
              googleMapsUrl: mapsUrl,
              instagramUsername: "studio.local",
              status: "instagram_found" as const,
              notes: "Busca completa no Maps e nos Resultados da Web. Instagram identificado.",
            }],
          };
        },
        qualify: async ({ candidates }) => {
          candidatesSentToAi = candidates.length;
          return {
            available: true as const,
            decisions: [{
              index: 0,
              fits: true,
              confidence: "high" as const,
              classification: "business" as const,
              reason: "Empresa local compatível com o nicho definido",
            }],
          };
        },
      },
    );

    expect(candidatesSentToAi).toBe(1);
    expect(result).toMatchObject({ status: "completed", created: 1, qualified: 1 });
    const [opportunity] = await db
      .select()
      .from(schema.localBusinessOpportunities)
      .where(eq(schema.localBusinessOpportunities.id, "old-local-opportunity"));
    expect(opportunity).toMatchObject({
      status: "instagram_found",
      instagramUsername: "studio.local",
    });
    const [prospect] = await db
      .select()
      .from(schema.outboundProspects)
      .where(eq(schema.outboundProspects.instagramUsername, "studio.local"));
    expect(prospect).toMatchObject({
      pipelineStage: "qualified",
      icpScore: 40,
      discoverySource: "google_maps",
    });
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
