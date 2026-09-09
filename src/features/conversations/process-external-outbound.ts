import { and, desc, eq, inArray } from "drizzle-orm";
import {
  auditLogs,
  conversations,
  jobs,
  leads,
  messages,
  timelineEvents,
} from "../../../db/schema";
import { getCommercialDb } from "../../db/commercial";
import { canonicalInstagramUsername } from "../leads/domain";

export type ExternalOutboundMessage = {
  externalMessageId: string;
  externalConversationId?: string;
  instagramUsername?: string;
  text: string;
  sentAt?: string;
  source?: string;
};

export async function recordExternalOutboundMessage(
  input: ExternalOutboundMessage,
) {
  const db = await getCommercialDb();
  const [existing] = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
    })
    .from(messages)
    .where(eq(messages.externalId, input.externalMessageId))
    .limit(1);
  if (existing) {
    return {
      status: "duplicate" as const,
      messageId: existing.id,
      conversationId: existing.conversationId,
    };
  }

  const [conversationByExternalId] = input.externalConversationId
    ? await db
        .select()
        .from(conversations)
        .where(eq(conversations.externalId, input.externalConversationId))
        .limit(1)
    : [];
  const username = input.instagramUsername
    ? canonicalInstagramUsername(input.instagramUsername)
    : null;
  const [conversationByUsername] = conversationByExternalId || !username
    ? []
    : await db
        .select({ conversation: conversations })
        .from(conversations)
        .innerJoin(leads, eq(conversations.leadId, leads.id))
        .where(eq(leads.instagramUsername, username))
        .orderBy(desc(conversations.updatedAt))
        .limit(1);
  const conversation =
    conversationByExternalId || conversationByUsername?.conversation;
  if (!conversation) {
    return { status: "conversation_not_found" as const };
  }

  const now = input.sentAt || new Date().toISOString();
  const normalizedBody = input.text.trim();
  if (!normalizedBody) return { status: "invalid_text" as const };

  const [uncertainMessage] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        eq(messages.direction, "outbound"),
        eq(messages.body, normalizedBody),
        inArray(messages.status, ["sending", "send_uncertain"]),
      ),
    )
    .orderBy(desc(messages.sentAt))
    .limit(1);
  const messageId = uncertainMessage?.id || crypto.randomUUID();

  await db.transaction(async (tx) => {
    if (uncertainMessage) {
      await tx
        .update(messages)
        .set({
          externalId: input.externalMessageId,
          status: "sent",
          sentAt: now,
        })
        .where(eq(messages.id, uncertainMessage.id));
    } else {
      await tx.insert(messages).values({
        id: messageId,
        conversationId: conversation.id,
        externalId: input.externalMessageId,
        direction: "outbound",
        sender: "external",
        body: normalizedBody,
        action: "synced_external",
        status: "sent",
        sentAt: now,
        createdAt: now,
      });
    }

    const supersededDrafts = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversation.id),
          inArray(messages.status, ["draft", "failed"]),
        ),
      );
    const supersededDraftIds = new Set(
      supersededDrafts.map((message) => message.id),
    );
    if (supersededDraftIds.size) {
      const waitingReviewJobs = await tx
        .select({ id: jobs.id, payload: jobs.payload })
        .from(jobs)
        .where(eq(jobs.status, "waiting_review"));
      const relatedJobIds = waitingReviewJobs
        .filter((job) => {
          try {
            const draftMessageId = JSON.parse(job.payload).draftMessageId;
            return (
              typeof draftMessageId === "string" &&
              supersededDraftIds.has(draftMessageId)
            );
          } catch {
            return false;
          }
        })
        .map((job) => job.id);
      if (relatedJobIds.length) {
        await tx
          .update(jobs)
          .set({ status: "completed", finishedAt: now, lastError: null })
          .where(inArray(jobs.id, relatedJobIds));
      }
      await tx
        .update(messages)
        .set({ status: "superseded" })
        .where(inArray(messages.id, [...supersededDraftIds]));
    }

    await tx
      .update(conversations)
      .set({ lastMessageAt: now, updatedAt: now })
      .where(eq(conversations.id, conversation.id));
    await tx
      .update(leads)
      .set({ lastContactAt: now, updatedAt: now })
      .where(eq(leads.id, conversation.leadId));
    await tx.insert(timelineEvents).values({
      id: crypto.randomUUID(),
      leadId: conversation.leadId,
      type: "outbound_message",
      title: "Mensagem enviada no Instagram sincronizada",
      description:
        input.source || "Mensagem enviada fora do painel comercial.",
      metadata: JSON.stringify({
        messageId,
        externalMessageId: input.externalMessageId,
      }),
      createdBy: "external",
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "external",
      action: "instagram_outbound_synced",
      entityType: "message",
      entityId: messageId,
      metadata: JSON.stringify({
        externalMessageId: input.externalMessageId,
        source: input.source || null,
      }),
      createdAt: now,
    });
  });

  return {
    status: uncertainMessage ? ("reconciled" as const) : ("recorded" as const),
    messageId,
    conversationId: conversation.id,
    leadId: conversation.leadId,
  };
}
