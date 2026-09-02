import { and, eq, inArray, sql } from "drizzle-orm";
import {
  briefings,
  catalogProducts,
  commercialOrders,
  conversations,
  exceptions,
  idempotencyKeys,
  jobs,
  leads,
  messages,
  timelineEvents,
} from "../../../db/schema";
import { getCommercialDb } from "../../db/commercial";
import {
  calculateLeadScore,
  canonicalInstagramUsername,
  classifyIntent,
  decideNextAction,
  evaluateCatalogTruth,
  extractBriefingFields,
} from "../leads/domain";

export type InboundMessage = {
  externalMessageId: string;
  externalConversationId?: string;
  instagramUsername: string;
  name?: string;
  text: string;
  source?: string;
  receivedAt?: string;
  forceHumanReview?: boolean;
};

function stageForIntent(intent: ReturnType<typeof classifyIntent>) {
  if (intent === "opt_out" || intent === "not_interested") return "closed";
  if (intent === "ready_to_order") return "order_pending";
  if (intent === "wants_whatsapp") return "requirements_collection";
  if (intent === "wants_quote") return "quote_requested";
  if (["asked_price", "asked_customization", "asked_product", "sent_reference", "asked_deadline", "asked_shipping"].includes(intent)) return "requirements_collection";
  return "replied";
}

export async function processInboundMessage(input: InboundMessage) {
  const db = await getCommercialDb();
  const idempotencyKey = `instagram:${input.externalMessageId}`;
  const [processed] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, idempotencyKey))
    .limit(1);
  if (processed) {
    return { ...JSON.parse(processed.response || "{}"), duplicate: true };
  }

  const username = canonicalInstagramUsername(input.instagramUsername);
  const now = input.receivedAt || new Date().toISOString();
  const source = input.source || "Instagram · DM";
  const [history] = await db
    .select({ total: sql<number>`count(*)` })
    .from(commercialOrders)
    .where(eq(commercialOrders.source, source));
  const intent = classifyIntent(input.text);
  const catalog = await db.select().from(catalogProducts).where(eq(catalogProducts.active, true));
  const normalizedMessage = input.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const matchedProduct = catalog.find((product) => normalizedMessage.includes(product.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")));
  const catalogTruth = evaluateCatalogTruth(matchedProduct || null);
  let decision = decideNextAction(intent);
  if (intent === "asked_price" && matchedProduct && !catalogTruth.needsQuote) {
    const priceCents = matchedProduct.basePriceCents ?? matchedProduct.priceFromCents;
    const prefix = matchedProduct.basePriceCents == null ? "a partir de " : "";
    decision = {
      intent,
      action: "show_product",
      reason: "Preço encontrado no catálogo verificado",
      message: `O ${matchedProduct.name} está cadastrado ${prefix}por ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((priceCents || 0) / 100)}. Você gostaria dessa opção ou imaginou alguma personalização?`,
      requiresHuman: false,
    };
  }
  const extracted = extractBriefingFields(input.text);
  const score = calculateLeadScore({
    intent,
    icpMatches: 1,
    replied: true,
    sentReference: intent === "sent_reference",
    informedQuantity: Boolean(extracted.quantity),
    informedDeadline: Boolean(extracted.desiredDeadline),
    askedQuote: intent === "wants_quote" || intent === "asked_price",
    askedWhatsapp: intent === "wants_whatsapp",
    businessPotential: intent === "business_opportunity",
    historicalConversionBoost: Math.min(4, Number(history.total) * 2),
  });
  const leadId = crypto.randomUUID();
  const conversationId = crypto.randomUUID();
  const pipelineStage = stageForIntent(intent);
  const doNotContact = intent === "opt_out";
  const requiresHuman = Boolean(input.forceHumanReview) || decision.requiresHuman || intent === "business_opportunity" || intent === "partnership_interest";
  const draftMessageId = !doNotContact && intent !== "not_interested" ? crypto.randomUUID() : null;

  const response = await db.transaction(async (tx) => {
    await tx
      .insert(leads)
      .values({
        id: leadId,
        instagramUsername: username,
        name: input.name,
        leadType: intent === "business_opportunity" || intent === "partnership_interest" ? "business" : "consumer",
        source,
        productInterest: matchedProduct?.name,
        score: score.total,
        intentScore: score.intentScore,
        icpScore: score.icpScore,
        engagementScore: score.engagementScore,
        commercialPotentialScore: score.commercialPotentialScore,
        urgencyScore: score.urgencyScore,
        pipelineStage,
        channelState: doNotContact ? "do_not_contact" : requiresHuman ? "human_review_required" : "api_active",
        doNotContact,
        lastContactAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: leads.instagramUsername,
        set: {
          name: input.name,
          productInterest: matchedProduct?.name,
          score: score.total,
          intentScore: score.intentScore,
          icpScore: score.icpScore,
          engagementScore: score.engagementScore,
          commercialPotentialScore: score.commercialPotentialScore,
          urgencyScore: score.urgencyScore,
          pipelineStage,
          channelState: doNotContact ? "do_not_contact" : requiresHuman ? "human_review_required" : "api_active",
          doNotContact,
          lastContactAt: now,
          updatedAt: now,
        },
      });

    const [lead] = await tx
      .select()
      .from(leads)
      .where(eq(leads.instagramUsername, username))
      .limit(1);

    const existingConversations = await tx
      .select()
      .from(conversations)
      .where(
        input.externalConversationId
          ? and(
              eq(conversations.leadId, lead.id),
              eq(conversations.externalId, input.externalConversationId),
            )
          : eq(conversations.leadId, lead.id),
      )
      .limit(1);
    const conversation = existingConversations[0];
    const activeConversationId = conversation?.id || conversationId;
    if (!conversation) {
      await tx.insert(conversations).values({
        id: activeConversationId,
        leadId: lead.id,
        channel: "instagram",
        externalId: input.externalConversationId || `ig:${username}`,
        status: "active",
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await tx.update(conversations).set({ lastMessageAt: now, updatedAt: now }).where(eq(conversations.id, conversation.id));
    }

    const supersededDrafts = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, activeConversationId),
          inArray(messages.status, ["draft", "failed"]),
        ),
      );

    if (supersededDrafts.length) {
      const supersededDraftIds = new Set(
        supersededDrafts.map((message) => message.id),
      );
      const waitingReviewJobs = await tx
        .select({ id: jobs.id, payload: jobs.payload })
        .from(jobs)
        .where(eq(jobs.status, "waiting_review"));
      const supersededJobIds = waitingReviewJobs
        .filter((job) => {
          try {
            const payload = JSON.parse(job.payload) as {
              draftMessageId?: string;
            };
            return Boolean(
              payload.draftMessageId &&
                supersededDraftIds.has(payload.draftMessageId),
            );
          } catch {
            return false;
          }
        })
        .map((job) => job.id);
      if (supersededJobIds.length) {
        await tx
          .update(jobs)
          .set({ status: "completed", finishedAt: now, lastError: null })
          .where(inArray(jobs.id, supersededJobIds));
      }
    }

    await tx
      .update(messages)
      .set({ status: "superseded" })
      .where(
        and(
          eq(messages.conversationId, activeConversationId),
          inArray(messages.status, ["draft", "failed"]),
        ),
      );

    await tx.insert(messages).values({
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      externalId: input.externalMessageId,
      direction: "inbound",
      sender: "lead",
      body: input.text,
      intent,
      action: decision.action,
      status: "received",
      sentAt: now,
      createdAt: now,
    });

    if (draftMessageId) {
      await tx.insert(messages).values({
        id: draftMessageId,
        conversationId: activeConversationId,
        direction: "outbound",
        sender: "assistant",
        body: decision.message,
        intent,
        action: decision.action,
        status: "draft",
        sentAt: now,
        createdAt: now,
      });
    }

    if (Object.keys(extracted).length > 0 || ["asked_price", "wants_quote", "sent_reference"].includes(intent)) {
      await tx
        .insert(briefings)
        .values({
          id: crypto.randomUUID(),
          leadId: lead.id,
          ...extracted,
          productInterest: matchedProduct?.name,
          productCategory: matchedProduct?.category,
          needsQuote: catalogTruth.needsQuote,
          needsProductionReview: catalogTruth.needsProductionReview,
          status: "collecting",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: briefings.leadId,
          set: {
            ...extracted,
            productInterest: matchedProduct?.name,
            productCategory: matchedProduct?.category,
            needsQuote: catalogTruth.needsQuote,
            needsProductionReview: catalogTruth.needsProductionReview,
            updatedAt: now,
          },
        });
    }

    await tx.insert(timelineEvents).values([
      {
        id: crypto.randomUUID(),
        leadId: lead.id,
        type: "inbound_message",
        title: `Mensagem classificada como ${intent}`,
        description: decision.reason,
        metadata: JSON.stringify({ action: decision.action, score: score.total, catalogProductId: matchedProduct?.id || null }),
        createdAt: now,
      },
      ...(doNotContact
        ? [{ id: crypto.randomUUID(), leadId: lead.id, type: "opt_out", title: "Contato bloqueado permanentemente", description: "Pedido de opt-out reconhecido na mensagem.", metadata: "{}", createdAt: now }]
        : []),
    ]);

    if (requiresHuman) {
      await tx.insert(exceptions).values({
        id: crypto.randomUUID(),
        leadId: lead.id,
        type: "human_review",
        severity: intent === "business_opportunity" ? "high" : "medium",
        title: "Conversa precisa de revisão humana",
        description: decision.reason,
        status: "open",
        createdAt: now,
      });
    }

    if (!doNotContact && intent !== "not_interested") {
      await tx.insert(jobs).values({
        id: crypto.randomUUID(),
        type: decision.action === "prepare_briefing" ? "prepare_briefing" : "generate_reply",
        payload: JSON.stringify({ leadId: lead.id, conversationId: activeConversationId, suggestedMessage: decision.message, draftMessageId }),
        status: "waiting_review",
        maxAttempts: 3,
        scheduledAt: now,
        idempotencyKey: `reply:${input.externalMessageId}`,
        createdAt: now,
      });
    }

    const result = {
      duplicate: false,
      leadId: lead.id,
      conversationId: activeConversationId,
      intent,
      action: decision.action,
      reason: decision.reason,
      suggestedMessage: decision.message,
      draftMessageId,
      score,
      doNotContact,
      requiresHuman,
    };
    await tx.insert(idempotencyKeys).values({ key: idempotencyKey, scope: "instagram_inbound", response: JSON.stringify(result), createdAt: now });
    return result;
  });

  return response;
}
