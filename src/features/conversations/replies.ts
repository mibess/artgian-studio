import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  auditLogs,
  catalogProducts,
  conversations,
  jobs,
  leads,
  messages,
  timelineEvents,
} from "../../../db/schema";
import { getCommercialDb } from "../../db/commercial";
import { generateCommercialDecision } from "../../integrations/openai/conversation-engine";
import {
  InstagramSendError,
  getInstagramRecipientId,
  isInstagramReplyWindowOpen,
  sendInstagramText,
} from "../../integrations/instagram/send";

const EDITABLE_STATUSES = ["draft", "failed"];

type CommercialDecisionGenerator = typeof generateCommercialDecision;

export async function enhanceReplyDraftWithAi(
  input: { leadId: string; messageId: string },
  dependencies: { generateDecision?: CommercialDecisionGenerator } = {},
) {
  const db = await getCommercialDb();
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, input.leadId))
    .limit(1);
  if (!lead || lead.doNotContact) return { status: "blocked" as const };

  const [draft] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, input.messageId),
        eq(messages.direction, "outbound"),
        eq(messages.status, "draft"),
      ),
    )
    .limit(1);
  if (!draft) return { status: "stale" as const };

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, draft.conversationId),
        eq(conversations.leadId, lead.id),
      ),
    )
    .limit(1);
  if (!conversation) return { status: "not_found" as const };

  const [alreadyEnhanced] = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "instagram_reply_ai_drafted"),
        eq(auditLogs.entityId, draft.id),
      ),
    )
    .limit(1);
  if (alreadyEnhanced) return { status: "already_enhanced" as const };

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.sentAt));
  const inbound = [...history]
    .reverse()
    .find((message) => message.direction === "inbound");
  if (!inbound) return { status: "not_found" as const };

  const [product] = lead.productInterest
    ? await db
        .select()
        .from(catalogProducts)
        .where(eq(catalogProducts.name, lead.productInterest))
        .limit(1)
    : [];
  const productTruth = product
    ? {
        name: product.name,
        basePriceCents: product.basePriceCents,
        priceFromCents: product.priceFromCents,
        productionTime: product.productionTime,
        active: product.active,
      }
    : null;

  const generateDecision =
    dependencies.generateDecision || generateCommercialDecision;
  const decision = await generateDecision({
    message: inbound.body,
    recentMessages: history
      .filter((message) => message.id !== draft.id)
      .slice(-6)
      .map((message) => ({
        direction: message.direction as "inbound" | "outbound",
        body: message.body,
      })),
    product: productTruth,
    leadId: lead.id,
    conversationId: conversation.id,
  });
  if (decision.source !== "openai") return { status: "fallback" as const };

  const now = new Date().toISOString();
  const updated = await db
    .update(messages)
    .set({
      body: decision.message,
      intent: decision.intent,
      action: decision.action,
    })
    .where(and(eq(messages.id, draft.id), eq(messages.status, "draft")))
    .returning({ id: messages.id });
  if (!updated.length) return { status: "stale" as const };

  await db.transaction(async (tx) => {
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "assistant",
      action: "instagram_reply_ai_drafted",
      entityType: "message",
      entityId: draft.id,
      metadata: JSON.stringify({ source: decision.source }),
      createdAt: now,
    });
    await tx.insert(timelineEvents).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: "ai_draft",
      title: "Rascunho aprimorado pela OpenAI",
      description: "A resposta permanece aguardando aprovação humana.",
      metadata: JSON.stringify({ messageId: draft.id }),
      createdAt: now,
    });
  });
  return { status: "enhanced" as const, messageId: draft.id };
}

export async function createReplyDraftForLead(leadId: string) {
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return { status: "not_found" as const };
  if (lead.doNotContact) return { status: "blocked" as const };

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  if (!conversation) return { status: "not_found" as const };

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.sentAt));
  const existing = [...history]
    .reverse()
    .find(
      (message) =>
        message.direction === "outbound" &&
        ["draft", "failed", "sending", "send_uncertain"].includes(message.status),
    );
  if (existing) return { status: "exists" as const, messageId: existing.id };

  const inbound = [...history]
    .reverse()
    .find((message) => message.direction === "inbound");
  if (!inbound) return { status: "not_found" as const };
  const lastSent = [...history]
    .reverse()
    .find(
      (message) =>
        message.direction === "outbound" && message.status === "sent",
    );
  if (lastSent && Date.parse(lastSent.sentAt) >= Date.parse(inbound.sentAt)) {
    return { status: "already_replied" as const };
  }

  const decision = await generateCommercialDecision({
    message: inbound.body,
    recentMessages: history.slice(-6).map((message) => ({
      direction: message.direction as "inbound" | "outbound",
      body: message.body,
    })),
    leadId: lead.id,
    conversationId: conversation.id,
  });
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(messages).values({
      id: messageId,
      conversationId: conversation.id,
      direction: "outbound",
      sender: "assistant",
      body: decision.message,
      intent: decision.intent,
      action: decision.action,
      status: "draft",
      sentAt: now,
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "instagram_reply_drafted",
      entityType: "message",
      entityId: messageId,
      metadata: JSON.stringify({ source: decision.source }),
      createdAt: now,
    });
  });
  return { status: "created" as const, messageId };
}

export async function approveAndSendInstagramReply(input: {
  leadId: string;
  messageId: string;
  body: string;
}, dependencies: {
  sendText?: typeof sendInstagramText;
} = {}) {
  const body = input.body.trim();
  if (!body || body.length > 1_000) return { status: "invalid_text" as const };

  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, input.messageId))
    .limit(1);
  if (!lead || !message || message.direction !== "outbound") {
    return { status: "not_found" as const };
  }
  if (lead.doNotContact) return { status: "blocked" as const };

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, message.conversationId),
        eq(conversations.leadId, lead.id),
      ),
    )
    .limit(1);
  if (!conversation) return { status: "not_found" as const };

  const recipientId = getInstagramRecipientId(conversation.externalId);
  if (!recipientId) return { status: "invalid_recipient" as const };
  const [latestInbound] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        eq(messages.direction, "inbound"),
      ),
    )
    .orderBy(desc(messages.sentAt))
    .limit(1);
  if (!latestInbound || !isInstagramReplyWindowOpen(latestInbound.sentAt)) {
    return { status: "outside_window" as const };
  }

  const claimed = await db
    .update(messages)
    .set({ body, status: "sending" })
    .where(
      and(
        eq(messages.id, message.id),
        inArray(messages.status, EDITABLE_STATUSES),
      ),
    )
    .returning({ id: messages.id });
  if (!claimed.length) return { status: "already_processed" as const };

  let sent: Awaited<ReturnType<typeof sendInstagramText>>;
  try {
    sent = await (dependencies.sendText || sendInstagramText)({ recipientId, text: body });
  } catch (error) {
    const instagramError =
      error instanceof InstagramSendError
        ? error
        : new InstagramSendError("Falha inesperada no envio.", "uncertain");
    const status = instagramError.kind === "uncertain" ? "send_uncertain" : "failed";
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.update(messages).set({ status }).where(eq(messages.id, message.id));
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "operator",
        action: "instagram_reply_failed",
        entityType: "message",
        entityId: message.id,
        metadata: JSON.stringify({ kind: instagramError.kind, status: instagramError.status }),
        createdAt: now,
      });
    });
    return { status: status as "failed" | "send_uncertain" };
  }

  const now = new Date().toISOString();
  const reviewJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "waiting_review"));
  const relatedJobIds = reviewJobs
    .filter((job) => {
      try {
        return JSON.parse(job.payload).draftMessageId === message.id;
      } catch {
        return false;
      }
    })
    .map((job) => job.id);
  await db.transaction(async (tx) => {
    await tx
      .update(messages)
      .set({ status: "sent", externalId: sent.messageId, sentAt: now })
      .where(eq(messages.id, message.id));
    await tx
      .update(conversations)
      .set({ lastMessageAt: now, updatedAt: now })
      .where(eq(conversations.id, conversation.id));
    await tx
      .update(leads)
      .set({ lastContactAt: now, updatedAt: now })
      .where(eq(leads.id, lead.id));
    await tx.insert(timelineEvents).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: "outbound_message",
      title: "Resposta aprovada e enviada pelo Instagram",
      metadata: JSON.stringify({ messageId: message.id }),
      createdBy: "operator",
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "instagram_reply_sent",
      entityType: "message",
      entityId: message.id,
      metadata: JSON.stringify({ recipientId: sent.recipientId }),
      createdAt: now,
    });
    if (relatedJobIds.length) {
      await tx
        .update(jobs)
        .set({ status: "completed", finishedAt: now, lastError: null })
        .where(inArray(jobs.id, relatedJobIds));
    }
  });
  return { status: "sent" as const };
}
