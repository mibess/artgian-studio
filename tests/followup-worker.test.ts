import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const testDir = path.join(process.cwd(), ".test-tmp");
const databasePath = path.join(testDir, `artgian-followup-test-${process.pid}.db`);

describe("follow-up compatível com a janela do Instagram", () => {
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
    process.env.FOLLOWUP_INTERVAL_HOURS = "20";
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("limita o agendamento a no máximo 20 horas", async () => {
    const { getFollowupSchedule } = await import(
      "../src/features/conversations/followups"
    );
    const sentAt = "2026-09-02T12:00:00.000Z";
    process.env.FOLLOWUP_INTERVAL_HOURS = "48";
    expect(getFollowupSchedule(sentAt)).toBe("2026-09-03T08:00:00.000Z");
  });

  it("prepara rascunho para revisão quando não houve nova resposta", async () => {
    const [{ getCommercialDb }, schema, { runWorkerOnce }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/worker/processor"),
    ]);
    const db = await getCommercialDb();
    const now = Date.now();
    const inboundAt = new Date(now - 21 * 60 * 60 * 1_000).toISOString();
    const outboundAt = new Date(now - 20 * 60 * 60 * 1_000).toISOString();
    await db.insert(schema.leads).values({
      id: "followup-lead",
      instagramUsername: "followup.teste",
      source: "Instagram · Webhook",
      pipelineStage: "replied",
      channelState: "api_active",
      createdAt: inboundAt,
      updatedAt: outboundAt,
    });
    await db.insert(schema.conversations).values({
      id: "followup-conversation",
      leadId: "followup-lead",
      externalId: "business:test-recipient",
      lastMessageAt: outboundAt,
      createdAt: inboundAt,
      updatedAt: outboundAt,
    });
    await db.insert(schema.messages).values([
      {
        id: "followup-inbound",
        conversationId: "followup-conversation",
        direction: "inbound",
        sender: "lead",
        body: "Tenho interesse",
        status: "received",
        sentAt: inboundAt,
        createdAt: inboundAt,
      },
      {
        id: "followup-source",
        conversationId: "followup-conversation",
        direction: "outbound",
        sender: "assistant",
        body: "Qual peça você imaginou?",
        status: "sent",
        sentAt: outboundAt,
        createdAt: outboundAt,
      },
    ]);
    await db.insert(schema.systemSettings).values({
      key: "followups_paused",
      value: "false",
      updatedAt: outboundAt,
    }).onConflictDoUpdate({
      target: schema.systemSettings.key,
      set: { value: "false", updatedAt: outboundAt },
    });
    await db.insert(schema.jobs).values({
      id: "followup-job",
      type: "execute_followup",
      payload: JSON.stringify({
        leadId: "followup-lead",
        conversationId: "followup-conversation",
        sourceMessageId: "followup-source",
        followupsSent: 0,
      }),
      status: "pending",
      scheduledAt: new Date(now - 1_000).toISOString(),
      createdAt: outboundAt,
    });

    const result = await runWorkerOnce();
    expect(result).toMatchObject({ processed: true, waitingReview: true });
    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, "followup-job"));
    expect(job.status).toBe("waiting_review");
    const drafts = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.status, "draft"));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].body).toContain("Ficou alguma dúvida");
  });
});
