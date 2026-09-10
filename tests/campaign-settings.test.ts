import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const databasePath = path.join(
  process.cwd(),
  ".test-tmp",
  `campaign-settings-${process.pid}.db`,
);
const input = {
  campaignId: "edit-campaign",
  name: "Novo nome",
  source: "Google Maps",
  segment: "Manicure e pedicure",
  funnelType: "consumer",
  dailyLimit: "7",
  operatingHours: "10:00-17:30",
  operatingTimezone: "America/Sao_Paulo",
};

describe("edição dos dados da campanha", () => {
  beforeAll(async () => {
    await mkdir(path.dirname(databasePath), { recursive: true });
    Object.assign(process.env, {
      DATABASE_URL: `file:${databasePath}`,
      COMMERCIAL_DATABASE_MODE: "local",
      TURSO_DATABASE_URL: "",
      TURSO_AUTH_TOKEN: "",
      COMMERCIAL_DEMO_MODE: "false",
    });
  });
  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"])
      await unlink(databasePath + suffix).catch(() => undefined);
  });

  it("salva apenas dados editáveis, preserva critérios, público e travas", async () => {
    const [{ getCommercialDb }, schema, { saveCampaignDetails }] =
      await Promise.all([
        import("../src/db/commercial"),
        import("../db/schema"),
        import("../src/features/outbound/campaign-settings"),
      ]);
    const db = await getCommercialDb();
    await db.insert(schema.campaigns).values([
      {
        id: input.campaignId,
        name: "Original",
        source: "Instagram",
        funnelType: "partner",
        discoveryStrategy: "local_business",
        discoveryLocalNiche: "Manicure",
        discoveryLocalLocation: "Brodowski SP",
        discoveryMinimumScore: 55,
        discoveryEnabled: false,
        outboundEnabled: false,
      },
      { id: "untouched", name: "Não alterar", source: "Instagram" },
    ]);
    await db
      .insert(schema.outboundProspects)
      .values({
        id: "unchanged-prospect",
        campaignId: input.campaignId,
        instagramUsername: "teste.edicao",
        qualificationReason: "Teste",
        funnelType: "partner",
        status: "waiting_review",
        draftBody: "Mensagem existente",
      });
    await saveCampaignDetails({
      ...input,
      outboundEnabled: true,
      discoveryEnabled: true,
      status: "active",
    });
    const [saved] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, input.campaignId));
    expect(saved).toMatchObject({
      name: input.name,
      segment: input.segment,
      dailyLimit: 7,
      operatingHours: input.operatingHours,
      funnelType: "partner",
      discoveryMinimumScore: 55,
      discoveryLocalLocation: "Brodowski SP",
      discoveryEnabled: false,
      outboundEnabled: false,
      status: "draft",
    });
    const [other] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, "untouched"));
    expect(other.name).toBe("Não alterar");
    const [prospect] = await db.select().from(schema.outboundProspects);
    expect(prospect).toMatchObject({
      draftBody: "Mensagem existente",
      funnelType: "partner",
      status: "waiting_review",
    });
    expect(await db.select().from(schema.jobs)).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.action, "campaign_details_updated")),
    ).toHaveLength(1);
  });

  it("rejeita limites, horários, fuso e funil inválidos e campanha ausente", async () => {
    const { saveCampaignDetails } =
      await import("../src/features/outbound/campaign-settings");
    for (const invalid of [
      { dailyLimit: 31 },
      { dailyLimit: "" },
      { dailyLimit: 1.5 },
      { operatingHours: "24:10-30:00" },
      { operatingTimezone: "Fuso/invalido" },
      { name: "ab" },
      { funnelType: "admin" },
    ])
      await expect(
        saveCampaignDetails({ ...input, ...invalid }),
      ).rejects.toThrow();
    await expect(
      saveCampaignDetails({ ...input, campaignId: "missing" }),
    ).rejects.toThrow("Campanha não encontrada");
  });
});
