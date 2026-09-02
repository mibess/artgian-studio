import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import path from "node:path";

const databasePath = path.join(
  "/tmp",
  `artgian-channel-safety-${process.pid}.db`,
);

describe("segurança entre DMs e comentários inbound", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DATABASE_MODE = "local";
    process.env.COMMERCIAL_DEMO_MODE = "false";
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("encerra jobs substituídos e mantém comentários fora da conversa de DM", async () => {
    const [
      { processInboundMessage },
      { approveAndSendInstagramReply },
      { getCommercialDb },
      { jobs, messages },
    ] = await Promise.all([
      import("../src/features/conversations/process-inbound"),
      import("../src/features/conversations/replies"),
      import("../src/db/commercial"),
      import("../db/schema"),
    ]);
    const db = await getCommercialDb();

    const firstDm = await processInboundMessage({
      externalMessageId: "queue-dm-1",
      externalConversationId: "business-1:person-1",
      instagramUsername: "person-1",
      text: "Olá, vocês fazem personalizados?",
    });
    const secondDm = await processInboundMessage({
      externalMessageId: "queue-dm-2",
      externalConversationId: "business-1:person-1",
      instagramUsername: "person-1",
      text: "Tenho uma referência para enviar.",
    });

    const [firstDraft] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, firstDm.draftMessageId!))
      .limit(1);
    const [firstJob] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, "reply:queue-dm-1"))
      .limit(1);
    const [secondJob] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, "reply:queue-dm-2"))
      .limit(1);

    expect(secondDm.conversationId).toBe(firstDm.conversationId);
    expect(firstDraft.status).toBe("superseded");
    expect(firstJob.status).toBe("completed");
    expect(secondJob.status).toBe("waiting_review");

    const comment = await processInboundMessage({
      externalMessageId: "comment:queue-comment-1",
      externalConversationId: "comment:queue-comment-1",
      instagramUsername: "person-1",
      text: "Também queria saber sobre este produto.",
      source: "Instagram · Comentário",
      forceHumanReview: true,
    });

    const [currentDmDraft] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, secondDm.draftMessageId!))
      .limit(1);
    const sendText = vi.fn();
    const approval = await approveAndSendInstagramReply(
      {
        leadId: comment.leadId,
        messageId: comment.draftMessageId!,
        body: comment.suggestedMessage,
      },
      { sendText },
    );

    expect(comment.conversationId).not.toBe(firstDm.conversationId);
    expect(comment.requiresHuman).toBe(true);
    expect(currentDmDraft.status).toBe("draft");
    expect(approval.status).toBe("comment_review_only");
    expect(sendText).not.toHaveBeenCalled();
  });
});
