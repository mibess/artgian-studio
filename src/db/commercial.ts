import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, getLocalCommercialDb } from "../../db";
import {
  aiUsage,
  auditLogs,
  briefings,
  campaigns,
  catalogProducts,
  commercialOrders,
  conversations,
  exceptions,
  experiments,
  jobs,
  leads,
  messages,
  quoteRequests,
  systemSettings,
  timelineEvents,
} from "../../db/schema";

const DEMO_IDS = {
  mariana: "demo-lead-mariana",
  lucas: "demo-lead-lucas",
  renata: "demo-lead-renata",
  camila: "demo-lead-camila",
  pedro: "demo-lead-pedro",
  atelie: "demo-lead-atelie",
  bruno: "demo-lead-bruno",
};

const isoOffset = (hoursAgo: number) =>
  new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

let seedPromise: Promise<void> | undefined;

async function getCommercialDatabaseConnection() {
  const mode = process.env.COMMERCIAL_DATABASE_MODE?.trim() || "local";
  if (mode === "local") return getLocalCommercialDb();
  if (mode === "turso") return getDb();
  throw new Error(
    "COMMERCIAL_DATABASE_MODE deve ser 'local' ou 'turso'.",
  );
}

async function seedDemoData() {
  const db = await getCommercialDatabaseConnection();
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(leads);
  if (Number(total) > 0 || process.env.COMMERCIAL_DEMO_MODE === "false") return;

  await db.transaction(async (tx) => {
    await tx.insert(leads).values([
      { id: DEMO_IDS.mariana, instagramUsername: "mariana.cria", name: "Mariana Costa", leadType: "consumer", source: "Instagram · DM", segment: "Presente personalizado", productInterest: "Miniatura personalizada", occasion: "Aniversário", tags: JSON.stringify(["presente", "referência enviada"]), score: 91, intentScore: 28, icpScore: 18, engagementScore: 20, commercialPotentialScore: 15, urgencyScore: 10, pipelineStage: "quote_requested", channelState: "api_active", lastContactAt: isoOffset(0.3), nextActionAt: isoOffset(-1), quoteStatus: "requested", isDemo: true, createdAt: isoOffset(26), updatedAt: isoOffset(0.3) },
      { id: DEMO_IDS.lucas, instagramUsername: "lucas.geek", name: "Lucas Martins", leadType: "consumer", source: "Instagram · Comentário", segment: "Colecionável geek", productInterest: "Colecionável personalizado", tags: JSON.stringify(["geek", "alta intenção"]), score: 82, intentScore: 28, icpScore: 18, engagementScore: 14, commercialPotentialScore: 12, urgencyScore: 10, pipelineStage: "requirements_collection", channelState: "api_active", lastContactAt: isoOffset(1.2), nextActionAt: isoOffset(-3), quoteStatus: "none", isDemo: true, createdAt: isoOffset(31), updatedAt: isoOffset(1.2) },
      { id: DEMO_IDS.renata, instagramUsername: "renata.festeja", name: "Renata Lima", leadType: "consumer", source: "Campanha · Festa afetiva", segment: "Festas e datas especiais", productInterest: "Lembrancinhas", occasion: "Festa infantil", tags: JSON.stringify(["evento", "20 unidades"]), score: 76, intentScore: 24, icpScore: 20, engagementScore: 12, commercialPotentialScore: 15, urgencyScore: 5, pipelineStage: "whatsapp_handoff", channelState: "whatsapp_handoff", lastContactAt: isoOffset(3), whatsappHandoffAt: isoOffset(3), quoteStatus: "requested", isDemo: true, createdAt: isoOffset(52), updatedAt: isoOffset(3) },
      { id: DEMO_IDS.camila, instagramUsername: "camiladecor", name: "Camila Souza", leadType: "consumer", source: "Instagram · Story", segment: "Decoração personalizada", productInterest: "Peça decorativa", tags: JSON.stringify(["decoração"]), score: 64, intentScore: 18, icpScore: 19, engagementScore: 12, commercialPotentialScore: 10, urgencyScore: 5, pipelineStage: "interest_identified", channelState: "api_active", lastContactAt: isoOffset(5), nextActionAt: isoOffset(-18), quoteStatus: "none", isDemo: true, createdAt: isoOffset(74), updatedAt: isoOffset(5) },
      { id: DEMO_IDS.pedro, instagramUsername: "pedro.presenteia", name: "Pedro Alves", leadType: "consumer", source: "Instagram · DM", segment: "Presente personalizado", productInterest: "Presente com nome", occasion: "Dia dos Pais", tags: JSON.stringify(["presente"]), score: 56, intentScore: 18, icpScore: 17, engagementScore: 8, commercialPotentialScore: 8, urgencyScore: 5, pipelineStage: "replied", channelState: "api_active", lastContactAt: isoOffset(8), nextActionAt: isoOffset(-24), quoteStatus: "none", isDemo: true, createdAt: isoOffset(96), updatedAt: isoOffset(8) },
      { id: DEMO_IDS.atelie, instagramUsername: "atelie.pequenina", name: "Ateliê Pequenina", leadType: "business", source: "Indicação", segment: "Pequenos negócios", productInterest: "Displays personalizados", tags: JSON.stringify(["B2B", "revisão humana"]), score: 71, intentScore: 20, icpScore: 20, engagementScore: 11, commercialPotentialScore: 15, urgencyScore: 5, pipelineStage: "qualified", channelState: "human_review_required", lastContactAt: isoOffset(18), nextActionAt: isoOffset(-4), quoteStatus: "none", isDemo: true, createdAt: isoOffset(120), updatedAt: isoOffset(18) },
      { id: DEMO_IDS.bruno, instagramUsername: "bruno.coleciona", name: "Bruno Nunes", leadType: "consumer", source: "Instagram · DM", segment: "Colecionável geek", productInterest: "Miniatura", tags: JSON.stringify(["convertido"]), score: 94, intentScore: 34, icpScore: 20, engagementScore: 20, commercialPotentialScore: 15, urgencyScore: 5, pipelineStage: "order_confirmed", channelState: "completed", lastContactAt: isoOffset(30), quoteStatus: "accepted", orderStatus: "confirmed", confirmedOrderValueCents: 18900, isDemo: true, createdAt: isoOffset(168), updatedAt: isoOffset(30) },
    ]);

    await tx.insert(conversations).values([
      { id: "demo-conv-mariana", leadId: DEMO_IDS.mariana, channel: "instagram", externalId: "demo-ext-conv-mariana", status: "active", lastMessageAt: isoOffset(0.3), createdAt: isoOffset(26), updatedAt: isoOffset(0.3) },
      { id: "demo-conv-lucas", leadId: DEMO_IDS.lucas, channel: "instagram", externalId: "demo-ext-conv-lucas", status: "active", lastMessageAt: isoOffset(1.2), createdAt: isoOffset(31), updatedAt: isoOffset(1.2) },
      { id: "demo-conv-renata", leadId: DEMO_IDS.renata, channel: "instagram", externalId: "demo-ext-conv-renata", status: "handed_off", lastMessageAt: isoOffset(3), createdAt: isoOffset(52), updatedAt: isoOffset(3) },
      { id: "demo-conv-camila", leadId: DEMO_IDS.camila, channel: "instagram", externalId: "demo-ext-conv-camila", status: "active", lastMessageAt: isoOffset(5), createdAt: isoOffset(74), updatedAt: isoOffset(5) },
      { id: "demo-conv-pedro", leadId: DEMO_IDS.pedro, channel: "instagram", externalId: "demo-ext-conv-pedro", status: "active", lastMessageAt: isoOffset(8), createdAt: isoOffset(96), updatedAt: isoOffset(8) },
      { id: "demo-conv-bruno", leadId: DEMO_IDS.bruno, channel: "instagram", externalId: "demo-ext-conv-bruno", status: "completed", lastMessageAt: isoOffset(30), createdAt: isoOffset(168), updatedAt: isoOffset(30) },
    ]);

    await tx.insert(messages).values([
      { id: "demo-msg-m-1", conversationId: "demo-conv-mariana", externalId: "demo-msg-ext-m-1", direction: "inbound", sender: "lead", body: "Oi! Quanto custa uma miniatura personalizada? Posso mandar uma foto?", intent: "asked_price", action: "collect_requirement", sentAt: isoOffset(25.5), createdAt: isoOffset(25.5) },
      { id: "demo-msg-m-2", conversationId: "demo-conv-mariana", externalId: "demo-msg-ext-m-2", direction: "outbound", sender: "assistant", body: "Claro! O valor depende do modelo e da personalização. Pode mandar a referência e me dizer para quando você precisa?", intent: "asked_price", action: "request_reference", status: "sent", sentAt: isoOffset(25.3), createdAt: isoOffset(25.3) },
      { id: "demo-msg-m-3", conversationId: "demo-conv-mariana", externalId: "demo-msg-ext-m-3", direction: "inbound", sender: "lead", body: "Mandei a foto. É para aniversário, uma unidade, com o nome Giulia. Preciso dia 15/09 em Ribeirão Preto/SP.", intent: "sent_reference", action: "prepare_briefing", sentAt: isoOffset(0.3), createdAt: isoOffset(0.3) },
      { id: "demo-msg-l-1", conversationId: "demo-conv-lucas", externalId: "demo-msg-ext-l-1", direction: "inbound", sender: "lead", body: "Vocês fazem um colecionável parecido com esse, mas com outra cor?", intent: "asked_customization", action: "request_reference", sentAt: isoOffset(1.2), createdAt: isoOffset(1.2) },
      { id: "demo-msg-r-1", conversationId: "demo-conv-renata", externalId: "demo-msg-ext-r-1", direction: "inbound", sender: "lead", body: "Preciso de 20 lembrancinhas para uma festa infantil. Podemos falar pelo WhatsApp?", intent: "wants_whatsapp", action: "send_whatsapp_handoff", sentAt: isoOffset(3), createdAt: isoOffset(3) },
      { id: "demo-msg-c-1", conversationId: "demo-conv-camila", externalId: "demo-msg-ext-c-1", direction: "inbound", sender: "lead", body: "Tenho uma ideia de decoração com o nome da minha filha", intent: "asked_customization", action: "request_reference", sentAt: isoOffset(5), createdAt: isoOffset(5) },
      { id: "demo-msg-p-1", conversationId: "demo-conv-pedro", externalId: "demo-msg-ext-p-1", direction: "inbound", sender: "lead", body: "Boa tarde! Queria um presente personalizado para o meu pai", intent: "interested", action: "collect_requirement", sentAt: isoOffset(8), createdAt: isoOffset(8) },
      { id: "demo-msg-b-1", conversationId: "demo-conv-bruno", externalId: "demo-msg-ext-b-1", direction: "inbound", sender: "lead", body: "Fechado, vou fazer o pedido", intent: "ready_to_order", action: "escalate_to_human", sentAt: isoOffset(30), createdAt: isoOffset(30) },
    ]);

    await tx.insert(briefings).values([
      { id: "demo-brief-mariana", leadId: DEMO_IDS.mariana, productInterest: "Miniatura personalizada", productCategory: "Colecionável", occasion: "Aniversário", recipient: "Giulia", referenceDescription: "Miniatura baseada na referência enviada pela cliente", customizationText: "Nome “Giulia”", quantity: 1, desiredDeadline: "15/09", city: "Ribeirão Preto", state: "SP", shippingRequired: null, additionalNotes: "Validar viabilidade do modelo e calcular orçamento.", needsQuote: true, needsProductionReview: true, status: "ready", createdAt: isoOffset(0.3), updatedAt: isoOffset(0.3) },
      { id: "demo-brief-renata", leadId: DEMO_IDS.renata, productInterest: "Lembrancinhas personalizadas", productCategory: "Festa", occasion: "Festa infantil", quantity: 20, additionalNotes: "Definir tema, cores, prazo e endereço.", needsQuote: true, needsProductionReview: true, status: "collecting", createdAt: isoOffset(3), updatedAt: isoOffset(3) },
      { id: "demo-brief-bruno", leadId: DEMO_IDS.bruno, productInterest: "Miniatura personalizada", productCategory: "Colecionável", occasion: "Coleção pessoal", quantity: 1, preferredColors: "Azul e grafite", needsQuote: false, needsProductionReview: false, status: "converted", createdAt: isoOffset(100), updatedAt: isoOffset(30) },
    ]);

    await tx.insert(catalogProducts).values([
      { id: "cat-miniatura", name: "Miniatura personalizada", category: "Colecionáveis", description: "Solicitação de miniatura desenvolvida a partir de referências e detalhes do cliente.", pricingType: "quote", customizationOptions: JSON.stringify(["modelo", "cores", "texto ou nome", "tamanho"]), notes: "Exige análise de viabilidade antes de confirmar.", verifiedClaims: JSON.stringify(["Desenvolvimento sob demanda"]), active: true },
      { id: "cat-lembrancinha", name: "Lembrancinha personalizada", category: "Festas", description: "Peças para festas e datas especiais, avaliadas conforme tema, quantidade e personalização.", pricingType: "quote", customizationOptions: JSON.stringify(["texto ou nome", "cores", "quantidade"]), verifiedClaims: JSON.stringify(["Personalização sob análise"]), active: true },
      { id: "cat-bandeja", name: "Bandeja Aurora", category: "Decoração", description: "Bandeja decorativa para organização de pequenos objetos.", basePriceCents: 8900, pricingType: "fixed", availableColors: JSON.stringify(["Branco", "Preto", "Rosa"]), active: true },
      { id: "cat-display", name: "Display para pequenos negócios", category: "Negócios", description: "Displays e peças de comunicação visual desenvolvidos sob demanda.", pricingType: "quote", customizationOptions: JSON.stringify(["modelo", "texto ou nome", "cores", "quantidade"]), active: true },
      { id: "cat-ideia", name: "Sua ideia em 3D", category: "Sob demanda", description: "Entrada para solicitações que ainda não possuem um produto cadastrado.", pricingType: "quote", active: true, notes: "Nunca confirmar viabilidade, preço ou prazo sem análise humana." },
    ]);

    await tx.insert(quoteRequests).values([
      { id: "demo-quote-mariana", leadId: DEMO_IDS.mariana, briefingId: "demo-brief-mariana", status: "requested", notes: "Analisar referência e modelagem.", createdAt: isoOffset(0.2), updatedAt: isoOffset(0.2) },
      { id: "demo-quote-bruno", leadId: DEMO_IDS.bruno, briefingId: "demo-brief-bruno", status: "accepted", amountCents: 18900, sentAt: isoOffset(48), createdAt: isoOffset(52), updatedAt: isoOffset(30) },
    ]);

    await tx.insert(commercialOrders).values({ id: "demo-order-bruno", leadId: DEMO_IDS.bruno, quoteRequestId: "demo-quote-bruno", source: "Instagram · DM", productCategory: "Colecionáveis", amountCents: 18900, status: "confirmed", confirmedAt: isoOffset(30), createdAt: isoOffset(30) });

    await tx.insert(campaigns).values([
      { id: "demo-campaign-inbound", name: "Inbound orgânico", source: "Instagram", segment: "Todos os segmentos", status: "active", outboundEnabled: false, createdAt: isoOffset(240), updatedAt: isoOffset(2) },
      { id: "demo-campaign-festa", name: "Festa afetiva", source: "Conteúdo", segment: "Festas e datas especiais", status: "paused", outboundEnabled: false, createdAt: isoOffset(180), updatedAt: isoOffset(24) },
    ]);

    await tx.insert(experiments).values({ id: "demo-exp-cta", hypothesis: "Uma pergunta contextual gera mais respostas do que um CTA direto", variant: "Pergunta sobre a ocasião", control: "Convite para conhecer produtos", sampleSize: 12, minimumSampleSize: 30, startedAt: isoOffset(168), primaryMetric: "Taxa de resposta", secondaryMetrics: JSON.stringify(["Interesse real", "Opt-outs"]), status: "running", createdAt: isoOffset(168) });

    await tx.insert(jobs).values([
      { id: "demo-job-score", type: "score_lead", payload: JSON.stringify({ leadId: DEMO_IDS.mariana }), status: "completed", attempts: 1, maxAttempts: 3, scheduledAt: isoOffset(0.4), startedAt: isoOffset(0.35), finishedAt: isoOffset(0.34), idempotencyKey: "demo-score-mariana", createdAt: isoOffset(0.4) },
      { id: "demo-job-brief", type: "prepare_briefing", payload: JSON.stringify({ leadId: DEMO_IDS.mariana }), status: "completed", attempts: 1, maxAttempts: 3, scheduledAt: isoOffset(0.3), startedAt: isoOffset(0.29), finishedAt: isoOffset(0.28), idempotencyKey: "demo-brief-mariana", createdAt: isoOffset(0.3) },
      { id: "demo-job-follow", type: "execute_followup", payload: JSON.stringify({ leadId: DEMO_IDS.camila }), status: "pending", attempts: 0, maxAttempts: 2, scheduledAt: isoOffset(-18), idempotencyKey: "demo-follow-camila-1", createdAt: isoOffset(2) },
      { id: "demo-job-dead", type: "generate_reply", payload: JSON.stringify({ leadId: DEMO_IDS.atelie }), status: "dead_letter", attempts: 3, maxAttempts: 3, scheduledAt: isoOffset(15), startedAt: isoOffset(14), finishedAt: isoOffset(13), lastError: "Revisão humana obrigatória para negociação B2B", idempotencyKey: "demo-reply-atelie", createdAt: isoOffset(18) },
    ]);

    await tx.insert(aiUsage).values([
      { id: "demo-ai-1", model: "modelo-rápido", inputTokens: 322, outputTokens: 48, estimatedCostUsdMicros: 83, leadId: DEMO_IDS.mariana, conversationId: "demo-conv-mariana", purpose: "classify_message", createdAt: isoOffset(0.3) },
      { id: "demo-ai-2", model: "modelo-principal", inputTokens: 786, outputTokens: 126, estimatedCostUsdMicros: 596, leadId: DEMO_IDS.mariana, conversationId: "demo-conv-mariana", purpose: "generate_reply", createdAt: isoOffset(25.3) },
      { id: "demo-ai-3", model: "modelo-rápido", inputTokens: 280, outputTokens: 44, estimatedCostUsdMicros: 72, leadId: DEMO_IDS.lucas, conversationId: "demo-conv-lucas", purpose: "classify_message", createdAt: isoOffset(1.2) },
    ]);

    await tx.insert(exceptions).values([
      { id: "demo-exception-atelier", leadId: DEMO_IDS.atelie, type: "business_negotiation", severity: "high", title: "Oportunidade B2B precisa de análise", description: "O contato perguntou sobre fornecimento recorrente. Não há condição comercial cadastrada.", status: "open", createdAt: isoOffset(18) },
      { id: "demo-exception-whatsapp", leadId: DEMO_IDS.renata, type: "missing_configuration", severity: "medium", title: "WhatsApp ainda não configurado", description: "O briefing está pronto, mas o CTA permanece bloqueado enquanto WHATSAPP_LINK = A_DEFINIR.", status: "open", createdAt: isoOffset(3) },
    ]);

    await tx.insert(systemSettings).values([
      { key: "automation_paused", value: "false", updatedAt: isoOffset(1) },
      { key: "outbound_paused", value: "true", updatedAt: isoOffset(1) },
      { key: "followups_paused", value: "false", updatedAt: isoOffset(1) },
      { key: "auto_replies_paused", value: "true", updatedAt: isoOffset(1) },
    ]);

    await tx.insert(timelineEvents).values([
      { id: "demo-event-m-1", leadId: DEMO_IDS.mariana, type: "discovered", title: "Lead criado por DM", description: "Contato inbound com intenção de preço.", metadata: JSON.stringify({ source: "instagram_dm" }), createdAt: isoOffset(26) },
      { id: "demo-event-m-2", leadId: DEMO_IDS.mariana, type: "score_changed", title: "Score atualizado para 91", description: "Referência, quantidade, prazo e pedido de orçamento aumentaram a prioridade.", createdAt: isoOffset(0.25) },
      { id: "demo-event-m-3", leadId: DEMO_IDS.mariana, type: "briefing", title: "Briefing pronto para análise", description: "Campos extraídos da conversa sem exigir interrogatório.", createdAt: isoOffset(0.2) },
      { id: "demo-event-b-1", leadId: DEMO_IDS.bruno, type: "order", title: "Pedido confirmado", description: "Conversão atribuída ao inbound do Instagram.", metadata: JSON.stringify({ amountCents: 18900 }), createdAt: isoOffset(30) },
    ]);

    await tx.insert(auditLogs).values({ id: "demo-audit-seed", actor: "system", action: "demo_seeded", entityType: "system", metadata: JSON.stringify({ records: "commercial_demo" }), createdAt: isoOffset(0) });
  });
}

export async function getCommercialDb() {
  seedPromise ??= seedDemoData();
  await seedPromise;
  return getCommercialDatabaseConnection();
}

export async function getDashboardData() {
  const db = await getCommercialDb();
  const [leadRows, briefingRows, quoteRows, orderRows, usageRows, jobRows, exceptionRows, settingRows] = await Promise.all([
    db.select().from(leads).orderBy(desc(leads.score)),
    db.select().from(briefings),
    db.select().from(quoteRequests),
    db.select().from(commercialOrders),
    db.select().from(aiUsage),
    db.select().from(jobs).orderBy(desc(jobs.createdAt)),
    db.select().from(exceptions).where(eq(exceptions.status, "open")),
    db.select().from(systemSettings),
  ]);
  const totalAiUsd = usageRows.reduce((sum, row) => sum + row.estimatedCostUsdMicros / 1_000_000, 0);
  return { leads: leadRows, briefings: briefingRows, quotes: quoteRows, orders: orderRows, aiUsage: usageRows, jobs: jobRows, exceptions: exceptionRows, settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])), totalAiUsd };
}

export async function getLeads() {
  const db = await getCommercialDb();
  return db.select().from(leads).orderBy(desc(leads.score), desc(leads.updatedAt));
}

export async function getLeadDetail(id: string) {
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) return null;
  const [conversationRows, briefingRows, timelineRows] = await Promise.all([
    db.select().from(conversations).where(eq(conversations.leadId, id)).orderBy(desc(conversations.updatedAt)),
    db.select().from(briefings).where(eq(briefings.leadId, id)).limit(1),
    db.select().from(timelineEvents).where(eq(timelineEvents.leadId, id)).orderBy(desc(timelineEvents.createdAt)),
  ]);
  const conversation = conversationRows[0];
  const messageRows = conversation ? await db.select().from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(asc(messages.sentAt)) : [];
  return { lead, conversation, messages: messageRows, briefing: briefingRows[0] ?? null, timeline: timelineRows };
}

export async function getCatalog() {
  const db = await getCommercialDb();
  return db.select().from(catalogProducts).orderBy(asc(catalogProducts.name));
}

export async function getConversationsOverview() {
  const db = await getCommercialDb();
  return db
    .select({ conversation: conversations, lead: leads })
    .from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getBriefingsOverview() {
  const db = await getCommercialDb();
  return db.select({ briefing: briefings, lead: leads }).from(briefings).innerJoin(leads, eq(briefings.leadId, leads.id)).orderBy(desc(briefings.updatedAt));
}

export async function getQuotesOverview() {
  const db = await getCommercialDb();
  return db.select({ quote: quoteRequests, lead: leads }).from(quoteRequests).innerJoin(leads, eq(quoteRequests.leadId, leads.id)).orderBy(desc(quoteRequests.updatedAt));
}

export async function getOrdersOverview() {
  const db = await getCommercialDb();
  return db.select({ order: commercialOrders, lead: leads }).from(commercialOrders).innerJoin(leads, eq(commercialOrders.leadId, leads.id)).orderBy(desc(commercialOrders.confirmedAt));
}

export async function getOperationsData() {
  const db = await getCommercialDb();
  const [campaignRows, experimentRows, jobRows, exceptionRows, usageRows, settingRows] = await Promise.all([
    db.select().from(campaigns).orderBy(desc(campaigns.updatedAt)),
    db.select().from(experiments).orderBy(desc(experiments.createdAt)),
    db.select().from(jobs).orderBy(desc(jobs.createdAt)),
    db.select().from(exceptions).orderBy(desc(exceptions.createdAt)),
    db.select().from(aiUsage).orderBy(desc(aiUsage.createdAt)),
    db.select().from(systemSettings),
  ]);
  return { campaigns: campaignRows, experiments: experimentRows, jobs: jobRows, exceptions: exceptionRows, aiUsage: usageRows, settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])) };
}

export async function setSystemSetting(key: string, value: string) {
  const db = await getCommercialDb();
  await db.insert(systemSettings).values({ key, value, updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date().toISOString() } });
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actor: "operator", action: "setting_updated", entityType: "system_setting", entityId: key, metadata: JSON.stringify({ value }), createdAt: new Date().toISOString() });
}

export async function findOpenJob(type: string, idempotencyKey: string) {
  const db = await getCommercialDb();
  return db.select().from(jobs).where(and(eq(jobs.type, type), eq(jobs.idempotencyKey, idempotencyKey))).limit(1);
}
