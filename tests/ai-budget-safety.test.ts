import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const testDir = path.join(process.cwd(), ".test-tmp");
const databasePath = path.join(testDir, `artgian-budget-test-${process.pid}.db`);

describe("corte automático por orçamento de IA", () => {
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
    process.env.OPENAI_MONTHLY_BUDGET_USD = "1";
    process.env.OPENAI_INPUT_COST_PER_1M_USD = "1";
    process.env.OPENAI_OUTPUT_COST_PER_1M_USD = "1";
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("pausa a automação quando o gasto registrado atinge o teto", async () => {
    const [{ getCommercialDb }, schema, { getAiBudgetStatus }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/integrations/openai/conversation-engine"),
    ]);
    const db = await getCommercialDb();
    await db.insert(schema.aiUsage).values({
      id: "budget-usage",
      model: "test-model-snapshot",
      estimatedCostUsdMicros: 1_000_000,
      purpose: "test",
      createdAt: new Date().toISOString(),
    });
    const status = await getAiBudgetStatus();
    expect(status.available).toBe(false);
    expect(status.reason).toBe("Orçamento mensal atingido");
    const [setting] = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, "automation_paused"));
    expect(setting.value).toBe("true");
  });
});
