import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import {
  isPendingLocalOpportunity,
  parseImportedInstagramUsername,
} from "../src/features/outbound/instagram-import-domain";

const databasePath = path.join(
  process.cwd(),
  ".test-tmp",
  `instagram-import-${process.pid}.db`,
);

describe("importação pontual de Instagram", () => {
  beforeAll(async () => {
    await mkdir(path.dirname(databasePath), { recursive: true });
    Object.assign(process.env, {
      DATABASE_URL: `file:${databasePath}`,
      COMMERCIAL_DATABASE_MODE: "local",
      TURSO_DATABASE_URL: "",
      TURSO_AUTH_TOKEN: "",
      COMMERCIAL_DEMO_MODE: "false",
      INSTAGRAM_DISCOVERY_ENABLED: "true",
    });
  });
  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"])
      await unlink(databasePath + suffix).catch(() => undefined);
  });
  async function fixture(id: string, username = `perfil.${id}`) {
    const [{ getCommercialDb }, schema, service] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/features/outbound/instagram-import"),
    ]);
    const db = await getCommercialDb();
    await db
      .insert(schema.campaigns)
      .values({
        id,
        name: `Parcerias ${id}`,
        source: "Google Maps",
        segment: "Manicure e pedicure",
        funnelType: "partner",
        discoveryStrategy: "local_business",
        discoveryLocalNiche: "Manicure e pedicure",
        discoveryLocalLocation: "Brodowski SP",
        discoveryMinimumScore: 40,
        discoveryEnabled: false,
      });
    await db
      .insert(schema.localBusinessOpportunities)
      .values({
        id: `op-${id}`,
        campaignId: id,
        businessName: `Manicure ${id}`,
        niche: "Manicure",
        location: "Brodowski SP",
        googleMapsUrl: `https://www.google.com/maps/place/${id}`,
        websiteUrl: "https://www.facebook.com/exemplo",
        status: "instagram_not_found",
      });
    const input = {
      campaignId: id,
      opportunityId: `op-${id}`,
      instagramUsername: username,
    };
    const inspect = vi.fn(async () => ({
      instagramUsername: username,
      name: "Manicure Local",
      sourceUrl: `https://www.instagram.com/${username}/`,
      profileBio: "Manicure e pedicure · atendimento em Brodowski SP",
      discoveryQuery: "Importação",
    }));
    const qualify = vi.fn(async () => ({
      available: true as const,
      decisions: [
        {
          index: 0,
          fits: true,
          confidence: "high" as const,
          classification: "business" as const,
          reason: "Manicure local compatível com a campanha",
        },
      ],
    }));
    return { db, schema, ...service, input, inspect, qualify };
  }

  it("normaliza @ e URL oficial, rejeitando caminhos reservados e URLs externas", () => {
    expect(parseImportedInstagramUsername(" @NataliaaCesar ")).toBe(
      "nataliaacesar",
    );
    expect(
      parseImportedInstagramUsername(
        "https://instagram.com/nataliaacesar/?hl=pt",
      ),
    ).toBe("nataliaacesar");
    for (const value of [
      "",
      "@",
      "@um @dois",
      "https://evil.com/natalia",
      "javascript:alert(1)",
      "@explore",
      "@accounts",
      "../admin",
      "https://instagram.com/p/123",
    ])
      expect(parseImportedInstagramUsername(value)).toBeNull();
  });

  it("importa com a mesma IA da campanha, concilia e não cria rascunho, envio ou recorrência", async () => {
    const f = await fixture("approved", "nataliaacesar");
    const queued = await f.enqueueInstagramImport({
      ...f.input,
      instagramUsername: "@NataliaaCesar",
    });
    if (!queued.jobId) throw new Error("Job não criado");
    const second = await f.enqueueInstagramImport({
      ...f.input,
      instagramUsername: "@outro.perfil",
    });
    expect(second).toMatchObject({ status: "pending", jobId: queued.jobId });
    const { runWorkerOnce } = await import("../src/worker/processor");
    const result = await runWorkerOnce(queued.jobId, {
      executeInstagramImportJob: (input) => f.executeInstagramImport(input, f),
    });
    expect(result).toMatchObject({ imported: true, created: 1 });
    expect(f.inspect).toHaveBeenCalledOnce();
    expect(f.qualify).toHaveBeenCalledOnce();
    expect(f.qualify.mock.calls[0]).toMatchObject([
      {
        campaign: {
          segment: "Manicure e pedicure",
          strategy: "local_business",
          localLocation: "Brodowski SP",
        },
        candidates: [{ instagramUsername: "nataliaacesar" }],
      },
    ]);
    const [prospect] = await f.db
      .select()
      .from(f.schema.outboundProspects)
      .where(eq(f.schema.outboundProspects.instagramUsername, "nataliaacesar"));
    expect(prospect).toMatchObject({
      campaignId: "approved",
      status: "identified",
      contactPolicy: "manual_only",
      draftBody: null,
      pipelineStage: "qualified",
    });
    const [op] = await f.db
      .select()
      .from(f.schema.localBusinessOpportunities)
      .where(eq(f.schema.localBusinessOpportunities.id, f.input.opportunityId));
    expect(op).toMatchObject({
      status: "instagram_found",
      instagramUsername: "nataliaacesar",
    });
    const [campaign] = await f.db
      .select()
      .from(f.schema.campaigns)
      .where(eq(f.schema.campaigns.id, "approved"));
    expect(campaign).toMatchObject({
      discoveryEnabled: false,
      discoveryCursor: 0,
      lastDiscoveryAt: null,
    });
    expect(
      (await f.db.select().from(f.schema.jobs)).every(
        (job) => job.type === "import_instagram_profile",
      ),
    ).toBe(true);
    expect(await f.enqueueInstagramImport(f.input)).toEqual({
      status: "resolved",
    });
  });

  it("concilia um Instagram já cadastrado sem chamar Chrome ou IA e sem duplicar", async () => {
    const f = await fixture("duplicate", "perfil.jacadastrado");
    await f.db.insert(f.schema.outboundProspects).values({
      id: "existing-import-prospect", campaignId: f.input.campaignId,
      instagramUsername: f.input.instagramUsername, qualificationReason: "Perfil já qualificado",
    });
    const result = await f.executeInstagramImport(
      { ...f.input, jobId: "dup-job" },
      f,
    );
    expect(result).toMatchObject({ outcome: "duplicate" });
    expect(f.inspect).not.toHaveBeenCalled();
    expect(f.qualify).not.toHaveBeenCalled();
    expect(
      await f.db
        .select()
        .from(f.schema.outboundProspects)
        .where(
          eq(f.schema.outboundProspects.instagramUsername, f.input.instagramUsername),
        ),
    ).toHaveLength(1);
  });

  it("mantém a empresa pendente com motivo quando a IA reprova e permite tentar outro @", async () => {
    const f = await fixture("rejected");
    const { runWorkerOnce } = await import("../src/worker/processor");
    const queued = await f.enqueueInstagramImport(f.input);
    const result = await runWorkerOnce(queued.jobId, {
      executeInstagramImportJob: (input) =>
        f.executeInstagramImport(input, {
          inspect: f.inspect,
          qualify: async () => ({
            available: true,
            decisions: [
              {
                index: 0,
                fits: false,
                confidence: "high",
                classification: "business",
                reason: "Perfil de outro segmento",
              },
            ],
          }),
        }),
    });
    expect(result).toMatchObject({ imported: true, created: 0 });
    const [job] = await f.db
      .select()
      .from(f.schema.jobs)
      .where(eq(f.schema.jobs.id, queued.jobId!));
    expect(JSON.parse(job.payload).result).toMatchObject({
      outcome: "rejected",
      reason: "Perfil de outro segmento",
    });
    const [op] = await f.db
      .select()
      .from(f.schema.localBusinessOpportunities)
      .where(eq(f.schema.localBusinessOpportunities.id, f.input.opportunityId));
    expect(op.status).toBe("instagram_not_found");
    expect(
      await f.db
        .select()
        .from(f.schema.outboundProspects)
        .where(eq(f.schema.outboundProspects.campaignId, "rejected")),
    ).toHaveLength(0);
    expect(
      await f.enqueueInstagramImport({
        ...f.input,
        instagramUsername: "@corrigido",
      }),
    ).toMatchObject({ status: "queued", jobId: queued.jobId });
  });

  it("falha fechada quando a IA está indisponível ou a leitura não é pública", async () => {
    const f = await fixture("unavailable");
    await expect(
      f.executeInstagramImport(
        { ...f.input, jobId: "ai-fail" },
        {
          inspect: f.inspect,
          qualify: async () => ({
            available: false,
            reason: "Orçamento indisponível",
            decisions: [],
          }),
        },
      ),
    ).rejects.toThrow("IA rápida indisponível");
    await expect(
      f.executeInstagramImport(
        { ...f.input, jobId: "read-fail" },
        { inspect: async () => null, qualify: f.qualify },
      ),
    ).rejects.toThrow("Não foi possível ler");
    const [op] = await f.db
      .select()
      .from(f.schema.localBusinessOpportunities)
      .where(eq(f.schema.localBusinessOpportunities.id, f.input.opportunityId));
    expect(op.status).toBe("instagram_not_found");
    expect(f.qualify).not.toHaveBeenCalled();
  });

  it("não processa importação no executor de nuvem nem durante pausa", async () => {
    const f = await fixture("paused");
    const queued = await f.enqueueInstagramImport(f.input);
    const { runWorkerOnce } = await import("../src/worker/processor");
    expect(await runWorkerOnce(queued.jobId)).toEqual({ processed: false });
    await f.db
      .insert(f.schema.systemSettings)
      .values({ key: "discovery_paused", value: "true" })
      .onConflictDoUpdate({
        target: f.schema.systemSettings.key,
        set: { value: "true" },
      });
    const result = await runWorkerOnce(queued.jobId, {
      executeInstagramImportJob: (input) => f.executeInstagramImport(input, f),
    });
    expect(result).toMatchObject({ paused: true });
    expect(f.inspect).not.toHaveBeenCalled();
    await f.db
      .update(f.schema.systemSettings)
      .set({ value: "false" })
      .where(eq(f.schema.systemSettings.key, "discovery_paused"));
  });

  it("respeita opt-out, inclusive se registrado enquanto a IA valida", async () => {
    const f = await fixture("blocked");
    await f.db
      .insert(f.schema.leads)
      .values({
        id: "lead-blocked-import",
        instagramUsername: f.input.instagramUsername,
        source: "test",
        doNotContact: true,
      });
    expect(
      await f.executeInstagramImport({ ...f.input, jobId: "block" }, f),
    ).toMatchObject({ outcome: "rejected" });
    expect(f.inspect).not.toHaveBeenCalled();
    await f.db
      .update(f.schema.leads)
      .set({ doNotContact: false })
      .where(eq(f.schema.leads.id, "lead-blocked-import"));
    await f.executeInstagramImport(
      { ...f.input, jobId: "block-mid" },
      {
        inspect: f.inspect,
        qualify: async () => {
          await f.db
            .update(f.schema.leads)
            .set({ doNotContact: true })
            .where(eq(f.schema.leads.id, "lead-blocked-import"));
          return f.qualify();
        },
      },
    );
    expect(
      await f.db
        .select()
        .from(f.schema.outboundProspects)
        .where(eq(f.schema.outboundProspects.campaignId, "blocked")),
    ).toHaveLength(0);
  });

  it("confere associação da empresa e não aceita outro perfil retornado pelo navegador", async () => {
    const f = await fixture("wrong");
    await expect(
      f.enqueueInstagramImport({ ...f.input, campaignId: "approved" }),
    ).rejects.toThrow("Empresa não encontrada");
    await expect(
      f.executeInstagramImport(
        { ...f.input, jobId: "wrong-job" },
        {
          inspect: async () => ({
            instagramUsername: "outro",
            sourceUrl: "https://www.instagram.com/outro/",
            discoveryQuery: "test",
          }),
          qualify: f.qualify,
        },
      ),
    ).rejects.toThrow("perfil diferente");
    expect(f.qualify).not.toHaveBeenCalled();
  });

  it("remove da tela registros conciliados ou com o mesmo @ já no público, sem comparar nomes", () => {
    const known = new Set(["nataliaacesar"]);
    expect(
      isPendingLocalOpportunity(
        { status: "instagram_found", instagramUsername: null },
        known,
      ),
    ).toBe(false);
    expect(
      isPendingLocalOpportunity(
        { status: "instagram_not_found", instagramUsername: "@NataliaaCesar" },
        known,
      ),
    ).toBe(false);
    expect(
      isPendingLocalOpportunity(
        { status: "instagram_not_found", instagramUsername: null },
        known,
      ),
    ).toBe(true);
    expect(
      isPendingLocalOpportunity(
        { status: "instagram_not_found", instagramUsername: "outra.natalia" },
        known,
      ),
    ).toBe(true);
  });

  it("não reabre uma empresa conciliada quando chega uma busca antiga sem Instagram", async () => {
    const f = await fixture("preserve");
    await f.db
      .update(f.schema.campaigns)
      .set({ discoveryEnabled: true })
      .where(eq(f.schema.campaigns.id, "preserve"));
    await f.db
      .update(f.schema.localBusinessOpportunities)
      .set({ status: "instagram_found", instagramUsername: "ja.resolvido" })
      .where(eq(f.schema.localBusinessOpportunities.id, f.input.opportunityId));
    const { executeCampaignDiscovery } =
      await import("../src/features/outbound/discovery");
    await f.db
      .insert(f.schema.jobs)
      .values({
        id: "old-discovery",
        type: "discover_prospects",
        status: "running",
        payload: JSON.stringify({ campaignId: "preserve" }),
      });
    await executeCampaignDiscovery(
      { jobId: "old-discovery", campaignId: "preserve" },
      {
        discover: async () => ({
          candidates: [],
          queriesScanned: 1,
          profilesInspected: 1,
          localOpportunities: [
            {
              businessName: "Antigo",
              niche: "Manicure",
              location: "Brodowski SP",
              googleMapsUrl: "https://www.google.com/maps/place/preserve",
              status: "website_opportunity",
            },
          ],
        }),
        qualify: async () => ({ available: true, decisions: [] }),
      },
    );
    const [op] = await f.db
      .select()
      .from(f.schema.localBusinessOpportunities)
      .where(
        and(
          eq(f.schema.localBusinessOpportunities.id, f.input.opportunityId),
          eq(f.schema.localBusinessOpportunities.status, "instagram_found"),
        ),
      );
    expect(op.instagramUsername).toBe("ja.resolvido");
  });
});
