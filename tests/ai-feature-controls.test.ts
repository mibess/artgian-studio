import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const clientConstructor = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({ default: class { constructor() { clientConstructor(); throw new Error("Unexpected paid provider call"); } } }));
const databasePath = path.join(process.cwd(), ".test-tmp", `automation-controls-${process.pid}.db`);

describe("controle persistente antes de chamadas de IA", () => {
  beforeAll(async () => {
    await mkdir(path.dirname(databasePath), { recursive: true });
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
  });
  afterEach(() => { vi.unstubAllEnvs(); clientConstructor.mockClear(); });
  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) await unlink(`${databasePath}${suffix}`).catch(() => undefined);
  });

  it("bloqueia respostas, abordagens e qualificação antes de criar o cliente pago", async () => {
    const { setSystemSetting } = await import("../src/db/commercial");
    for (const key of ["ai_reply_generation_enabled", "ai_outbound_opening_enabled", "ai_qualification_enabled"])
      await setSystemSetting(key, "false");
    vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    vi.stubEnv("OPENAI_MODEL_FAST", "test-model");
    vi.stubEnv("AI_REPLY_GENERATION_ENABLED", "true");
    const { generateCommercialDecision, generateOutboundOpening } = await import("../src/integrations/openai/conversation-engine");
    const { validateProspectCampaignFits } = await import("../src/integrations/openai/prospect-qualification");
    expect((await generateCommercialDecision({ message: "Olá" })).source).toBe("rules");
    expect((await generateOutboundOpening({ leadId: "test", funnelType: "consumer" })).source).toBe("rules");
    const result = await validateProspectCampaignFits({
      campaign: { name: "Test", funnelType: "consumer", strategy: "instagram_search", keywords: [], hashtags: [], locations: [] },
      candidates: [{ instagramUsername: "example", discoveryQuery: "test", sourceUrl: "https://www.instagram.com/example/" }],
    });
    expect(result.available).toBe(false);
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("aplica alterações e registra auditoria sem depender de reinício do servidor", async () => {
    const { setSystemSetting, getCommercialDb } = await import("../src/db/commercial");
    const { isAiFeatureEnabled } = await import("../src/features/automation/server");
    const { auditLogs } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    vi.stubEnv("AI_REPLY_GENERATION_ENABLED", "false");
    await setSystemSetting("ai_reply_generation_enabled", "true");
    expect(await isAiFeatureEnabled("replies")).toBe(true);
    await setSystemSetting("ai_reply_generation_enabled", "false");
    expect(await isAiFeatureEnabled("replies")).toBe(false);
    const db = await getCommercialDb();
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, "ai_reply_generation_enabled"));
    expect(logs.some(l => JSON.parse(l.metadata || "{}").value === "true")).toBe(true);
    expect(logs.some(l => JSON.parse(l.metadata || "{}").value === "false")).toBe(true);
  });
});
