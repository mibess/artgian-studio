"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { processInboundMessage } from "../../src/features/conversations/process-inbound";
import { setSystemSetting } from "../../src/db/commercial";
import { saveBusinessFields } from "../../src/config/business";
import { getCommercialDb } from "../../src/db/commercial";
import { auditLogs, briefings, campaigns, catalogProducts, commercialOrders, exceptions, experiments, leads, quoteRequests, timelineEvents } from "../../db/schema";
import { eq } from "drizzle-orm";
import { prepareWhatsAppHandoff } from "../../src/integrations/whatsapp/handoff";
import { approveAndSendInstagramReply, createReplyDraftForLead, enhanceReplyDraftWithAi } from "../../src/features/conversations/replies";
import { runInstagramMaintenance } from "../../src/integrations/instagram/maintenance";

export async function updateAutomationSetting(formData: FormData) {
  const allowed = new Set([
    "automation_paused",
    "outbound_paused",
    "followups_paused",
    "auto_replies_paused",
  ]);
  const key = String(formData.get("key") || "");
  const value = String(formData.get("value") || "false");
  if (!allowed.has(key) || !["true", "false"].includes(value)) {
    throw new Error("Configuração inválida.");
  }
  await setSystemSetting(key, value);
  revalidatePath("/comercial", "layout");
}

export async function simulateInbound(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const text = String(formData.get("message") || "").trim();
  if (username.length < 2 || text.length < 2) {
    redirect("/comercial/conversas?erro=Preencha+o+perfil+e+a+mensagem");
  }
  const result = await processInboundMessage({
    externalMessageId: `manual-${crypto.randomUUID()}`,
    instagramUsername: username,
    text,
    source: "Simulação inbound",
  });
  if (result.draftMessageId) {
    await enhanceReplyDraftWithAi({
      leadId: result.leadId,
      messageId: result.draftMessageId,
    });
  }
  revalidatePath("/comercial", "layout");
  redirect(`/comercial/leads/${result.leadId}?simulado=1`);
}

export async function updateBusinessConfiguration(formData: FormData) {
  const whatsappLink = String(formData.get("whatsappLink") || "").trim();
  const fulfillmentGeography = String(formData.get("fulfillmentGeography") || "").trim();
  if (whatsappLink && whatsappLink !== "A_DEFINIR") {
    let url: URL;
    try {
      url = new URL(whatsappLink);
    } catch {
      redirect("/comercial/configuracoes?erro=Informe+um+link+completo+e+válido");
    }
    if (!['wa.me', 'api.whatsapp.com'].includes(url.hostname)) {
      redirect("/comercial/configuracoes?erro=Use+um+link+oficial+do+WhatsApp");
    }
  }
  await saveBusinessFields({
    whatsappLink: whatsappLink || "A_DEFINIR",
    fulfillmentGeography: fulfillmentGeography || "A_DEFINIR",
  });
  revalidatePath("/comercial", "layout");
  redirect("/comercial/configuracoes?salvo=1");
}

export async function addCatalogProduct(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const productionTime = String(formData.get("productionTime") || "").trim();
  const rawPrice = String(formData.get("basePrice") || "").replace(",", ".").trim();
  if (name.length < 2) redirect("/comercial/produtos?erro=Informe+o+nome+do+produto");
  const basePriceCents = rawPrice ? Math.round(Number(rawPrice) * 100) : null;
  if (rawPrice && (!Number.isFinite(basePriceCents) || basePriceCents! < 0)) redirect("/comercial/produtos?erro=Preço+inválido");
  const db = await getCommercialDb();
  await db.insert(catalogProducts).values({
    id: crypto.randomUUID(),
    name,
    category: category || null,
    description: description || null,
    basePriceCents,
    pricingType: basePriceCents == null ? "quote" : "fixed",
    productionTime: productionTime || null,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  revalidatePath("/comercial/produtos");
  redirect("/comercial/produtos?salvo=1");
}

export async function createCampaign(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const source = String(formData.get("source") || "").trim();
  const segment = String(formData.get("segment") || "").trim();
  if (name.length < 3 || source.length < 2) {
    redirect("/comercial/campanhas?erro=Informe+nome+e+origem+da+campanha");
  }
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(campaigns).values({
      id,
      name,
      source,
      segment: segment || null,
      status: "draft",
      outboundEnabled: false,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "campaign_created",
      entityType: "campaign",
      entityId: id,
      metadata: JSON.stringify({ outboundEnabled: false }),
      createdAt: now,
    });
  });
  revalidatePath("/comercial/campanhas");
  redirect("/comercial/campanhas?salvo=1");
}

export async function createExperiment(formData: FormData) {
  const hypothesis = String(formData.get("hypothesis") || "").trim();
  const control = String(formData.get("control") || "").trim();
  const variant = String(formData.get("variant") || "").trim();
  const primaryMetric = String(formData.get("primaryMetric") || "").trim();
  const minimumSampleSize = Math.max(
    20,
    Math.min(1_000, Number(formData.get("minimumSampleSize") || 30)),
  );
  if (
    hypothesis.length < 10 ||
    control.length < 3 ||
    variant.length < 3 ||
    primaryMetric.length < 3 ||
    !Number.isFinite(minimumSampleSize)
  ) {
    redirect("/comercial/experimentos?erro=Preencha+todos+os+campos+do+experimento");
  }
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(experiments).values({
      id,
      hypothesis,
      control,
      variant,
      sampleSize: 0,
      minimumSampleSize: Math.trunc(minimumSampleSize),
      primaryMetric,
      secondaryMetrics: "[]",
      status: "draft",
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "experiment_created",
      entityType: "experiment",
      entityId: id,
      metadata: JSON.stringify({ minimumSampleSize: Math.trunc(minimumSampleSize) }),
      createdAt: now,
    });
  });
  revalidatePath("/comercial/experimentos");
  redirect("/comercial/experimentos?salvo=1");
}

export async function updateLeadStage(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  const pipelineStage = String(formData.get("pipelineStage") || "");
  const allowed = new Set(["discovered", "qualified", "contacted", "replied", "interest_identified", "requirements_collection", "quote_requested", "whatsapp_handoff", "quote_sent", "order_pending", "order_confirmed", "closed"]);
  if (!leadId || !allowed.has(pipelineStage)) throw new Error("Etapa inválida.");
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ pipelineStage, updatedAt: now }).where(eq(leads.id, leadId));
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "stage_changed", title: `Etapa alterada para ${pipelineStage}`, createdBy: "operator", createdAt: now });
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actor: "operator", action: "pipeline_stage_updated", entityType: "lead", entityId: leadId, metadata: JSON.stringify({ pipelineStage }), createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  revalidatePath("/comercial/funil");
}

export async function registerQuote(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  const rawAmount = String(formData.get("amount") || "").replace(",", ".");
  const amountCents = Math.round(Number(rawAmount) * 100);
  if (!leadId || !Number.isFinite(amountCents) || amountCents <= 0) throw new Error("Valor de orçamento inválido.");
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  const [existing] = await db.select().from(quoteRequests).where(eq(quoteRequests.leadId, leadId)).limit(1);
  const quoteId = existing?.id || crypto.randomUUID();
  await db.transaction(async (tx) => {
    if (existing) await tx.update(quoteRequests).set({ amountCents, status: "sent", sentAt: now, updatedAt: now }).where(eq(quoteRequests.id, existing.id));
    else await tx.insert(quoteRequests).values({ id: quoteId, leadId, amountCents, status: "sent", sentAt: now, createdAt: now, updatedAt: now });
    await tx.update(leads).set({ quoteStatus: "sent", pipelineStage: "quote_sent", estimatedOrderValueCents: amountCents, updatedAt: now }).where(eq(leads.id, leadId));
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "quote", title: "Orçamento registrado e enviado", metadata: JSON.stringify({ amountCents }), createdBy: "operator", createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  revalidatePath("/comercial/orcamentos");
}

export async function confirmCommercialOrder(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead?.estimatedOrderValueCents) throw new Error("Registre um orçamento antes de confirmar o pedido.");
  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.leadId, leadId)).limit(1);
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.insert(commercialOrders).values({ id: crypto.randomUUID(), leadId, quoteRequestId: quote?.id, source: lead.source, productCategory: lead.segment, amountCents: lead.estimatedOrderValueCents!, status: "confirmed", confirmedAt: now, createdAt: now });
    await tx.update(leads).set({ orderStatus: "confirmed", quoteStatus: "accepted", pipelineStage: "order_confirmed", confirmedOrderValueCents: lead.estimatedOrderValueCents, updatedAt: now }).where(eq(leads.id, leadId));
    if (quote) await tx.update(quoteRequests).set({ status: "accepted", updatedAt: now }).where(eq(quoteRequests.id, quote.id));
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "order", title: "Pedido confirmado", metadata: JSON.stringify({ amountCents: lead.estimatedOrderValueCents, source: lead.source }), createdBy: "operator", createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  revalidatePath("/comercial/pedidos");
  revalidatePath("/comercial");
}

export async function registerWhatsappHandoff(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  const [briefing] = await db.select().from(briefings).where(eq(briefings.leadId, leadId)).limit(1);
  const handoff = await prepareWhatsAppHandoff(lead.instagramUsername, briefing || { productInterest: lead.productInterest, occasion: lead.occasion });
  if (!handoff.enabled) redirect("/comercial/configuracoes?erro=Configure+o+WhatsApp+antes+do+handoff");
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ pipelineStage: "whatsapp_handoff", channelState: "whatsapp_handoff", whatsappHandoffAt: now, updatedAt: now }).where(eq(leads.id, leadId));
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "whatsapp_handoff", title: "Encaminhado ao WhatsApp", description: "Briefing anexado ao handoff para evitar perguntas repetidas.", createdBy: "operator", createdAt: now });
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actor: "operator", action: "whatsapp_handoff_created", entityType: "lead", entityId: leadId, metadata: JSON.stringify({ summaryLength: handoff.summary.length }), createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  redirect(handoff.url);
}

export async function createInstagramReplyDraft(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  if (!leadId) throw new Error("Lead inválido.");
  const result = await createReplyDraftForLead(leadId);
  revalidatePath(`/comercial/leads/${leadId}`);
  if (result.status === "blocked") {
    redirect(`/comercial/leads/${leadId}?erro=Contato+bloqueado+por+opt-out`);
  }
  if (result.status === "not_found") {
    redirect(`/comercial/leads/${leadId}?erro=Não+há+mensagem+recebida+para+responder`);
  }
  if (result.status === "already_replied") {
    redirect(`/comercial/leads/${leadId}?erro=A+última+mensagem+já+foi+respondida`);
  }
  redirect(`/comercial/leads/${leadId}?rascunho=1`);
}

export async function approveInstagramReply(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  const messageId = String(formData.get("messageId") || "");
  const body = String(formData.get("body") || "");
  if (!leadId || !messageId) throw new Error("Resposta inválida.");

  const result = await approveAndSendInstagramReply({ leadId, messageId, body });
  revalidatePath(`/comercial/leads/${leadId}`);
  const errors: Record<string, string> = {
    invalid_text: "Revise+o+texto+da+mensagem",
    not_found: "Rascunho+ou+conversa+não+encontrado",
    blocked: "Contato+bloqueado+por+opt-out",
    invalid_recipient: "Esta+é+uma+conversa+simulada+e+não+pode+ser+enviada",
    comment_review_only: "Comentários+ficam+somente+em+revisão+e+não+são+enviados+como+DM",
    outside_window: "A+janela+de+24+horas+para+resposta+foi+encerrada",
    already_processed: "Esta+resposta+já+foi+processada",
    failed: "O+Instagram+recusou+o+envio;+revise+a+integração+e+tente+novamente",
    send_uncertain: "Envio+incerto;+confira+o+Instagram+antes+de+qualquer+nova+tentativa",
  };
  if (result.status !== "sent") {
    redirect(`/comercial/leads/${leadId}?erro=${errors[result.status] || "Falha+no+envio"}`);
  }
  redirect(`/comercial/leads/${leadId}?enviado=1`);
}

export async function escalateInstagramConversation(formData: FormData) {
  const leadId = String(formData.get("leadId") || "");
  if (!leadId) throw new Error("Lead inválido.");
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ channelState: "human_review_required", updatedAt: now }).where(eq(leads.id, leadId));
    await tx.insert(exceptions).values({ id: crypto.randomUUID(), leadId, type: "human_review", severity: "medium", title: "Conversa encaminhada para atendimento humano", description: "Encaminhamento manual registrado pelo operador.", status: "open", createdAt: now });
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "human_review", title: "Conversa encaminhada para atendimento humano", createdBy: "operator", createdAt: now });
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actor: "operator", action: "instagram_conversation_escalated", entityType: "lead", entityId: leadId, createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  revalidatePath("/comercial/excecoes");
  redirect(`/comercial/leads/${leadId}?escalado=1`);
}

export async function runInstagramReliabilityCheck() {
  const result = await runInstagramMaintenance();
  revalidatePath("/comercial/configuracoes");
  revalidatePath("/comercial/conversas");
  if (result.status === "error") {
    redirect(`/comercial/configuracoes?erro=${encodeURIComponent(result.error)}`);
  }
  if (result.status === "locked") {
    redirect("/comercial/configuracoes?erro=Uma+verificação+já+está+em+andamento");
  }
  redirect(`/comercial/configuracoes?verificado=${result.status}`);
}
