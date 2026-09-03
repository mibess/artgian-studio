import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const testDir = path.join(process.cwd(), ".test-tmp");
const databasePath = path.join(testDir, `artgian-safety-test-${process.pid}.db`);

describe("circuit breaker persistente do outbound", () => {
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
    process.env.OUTBOUND_FAILURE_THRESHOLD = "3";
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("pausa outbound depois de três falhas consecutivas", async () => {
    const [{ recordOutboundIntegrationFailure }, { getCommercialDb }, schema] = await Promise.all([
      import("../src/features/outbound/safety"),
      import("../src/db/commercial"),
      import("../db/schema"),
    ]);
    expect((await recordOutboundIntegrationFailure("falha 1"))?.opened).toBe(false);
    expect((await recordOutboundIntegrationFailure("falha 2"))?.opened).toBe(false);
    expect((await recordOutboundIntegrationFailure("falha 3"))?.opened).toBe(true);
    const db = await getCommercialDb();
    const [setting] = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, "outbound_paused"));
    const [integration] = await db
      .select()
      .from(schema.integrationStates)
      .where(eq(schema.integrationStates.key, "instagram_browser"));
    expect(setting.value).toBe("true");
    expect(integration.status).toBe("error");
  });

  it("recupera jobs internos e isola envio outbound interrompido", async () => {
    const [{ recoverStaleJobs }, { getCommercialDb }, schema] = await Promise.all([
      import("../src/worker/processor"),
      import("../src/db/commercial"),
      import("../db/schema"),
    ]);
    const db = await getCommercialDb();
    const startedAt = "2026-09-03T10:00:00.000Z";
    await db.insert(schema.jobs).values([
      { id: "stale-internal", type: "generate_reply", status: "running", payload: "{}", startedAt, scheduledAt: startedAt, createdAt: startedAt },
      { id: "stale-outbound", type: "send_outbound", status: "running", payload: "{}", startedAt, scheduledAt: startedAt, createdAt: startedAt },
    ]);
    const result = await recoverStaleJobs(new Date("2026-09-03T11:00:00.000Z"));
    expect(result).toEqual({ recovered: 1, uncertain: 1 });
    const rows = await db.select().from(schema.jobs);
    expect(rows.find((job) => job.id === "stale-internal")?.status).toBe("pending");
    expect(rows.find((job) => job.id === "stale-outbound")?.status).toBe("waiting_review");
  });
});
