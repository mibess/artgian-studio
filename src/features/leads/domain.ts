export const CONSUMER_PIPELINE = [
  "discovered",
  "qualified",
  "contacted",
  "replied",
  "interest_identified",
  "requirements_collection",
  "quote_requested",
  "whatsapp_handoff",
  "quote_sent",
  "order_pending",
  "order_confirmed",
  "closed",
] as const;

export type ConsumerPipelineStage = (typeof CONSUMER_PIPELINE)[number];

export const PIPELINE_LABELS: Record<ConsumerPipelineStage, string> = {
  discovered: "Descoberto",
  qualified: "Qualificado",
  contacted: "Abordado",
  replied: "Respondeu",
  interest_identified: "Interesse identificado",
  requirements_collection: "Levantando informações",
  quote_requested: "Orçamento solicitado",
  whatsapp_handoff: "Encaminhado ao WhatsApp",
  quote_sent: "Orçamento enviado",
  order_pending: "Aguardando pedido",
  order_confirmed: "Pedido confirmado",
  closed: "Encerrado",
};

export const INTENTS = [
  "greeting",
  "general_question",
  "interested",
  "asked_price",
  "asked_customization",
  "asked_product",
  "asked_shipping",
  "asked_deadline",
  "sent_reference",
  "wants_quote",
  "wants_whatsapp",
  "ready_to_order",
  "business_opportunity",
  "partnership_interest",
  "objection",
  "not_interested",
  "opt_out",
  "ambiguous",
  "needs_human",
] as const;

export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  greeting: "Saudação",
  general_question: "Pergunta geral",
  interested: "Interessado",
  asked_price: "Perguntou preço",
  asked_customization: "Perguntou personalização",
  asked_product: "Perguntou sobre produto",
  asked_shipping: "Perguntou entrega",
  asked_deadline: "Perguntou prazo",
  sent_reference: "Enviou referência",
  wants_quote: "Quer orçamento",
  wants_whatsapp: "Quer WhatsApp",
  ready_to_order: "Pronto para pedir",
  business_opportunity: "Oportunidade de negócio",
  partnership_interest: "Interesse em parceria",
  objection: "Objeção",
  not_interested: "Sem interesse",
  opt_out: "Não contatar",
  ambiguous: "Ambíguo",
  needs_human: "Precisa de humano",
};

export const CHANNEL_STATE_LABELS: Record<string, string> = {
  browser_contact_pending: "Contato pelo navegador pendente",
  browser_contact_sent: "Contato pelo navegador enviado",
  waiting_inbound_reply: "Aguardando resposta inbound",
  api_eligible: "Elegível para API",
  api_active: "API ativa",
  api_window_closed: "Janela da API encerrada",
  whatsapp_handoff: "Encaminhado ao WhatsApp",
  human_review_required: "Revisão humana obrigatória",
  do_not_contact: "Não contatar",
  blocked: "Bloqueado",
  completed: "Concluído",
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  discover_prospects: "Descobrir prospectos",
  discover_leads: "Descobrir leads",
  score_lead: "Calcular score",
  send_outbound: "Preparar outbound",
  process_inbound: "Processar inbound",
  classify_message: "Classificar mensagem",
  generate_reply: "Gerar resposta",
  schedule_followup: "Agendar follow-up",
  execute_followup: "Executar follow-up",
  prepare_briefing: "Preparar briefing",
  sync_catalog: "Sincronizar catálogo",
  evaluate_experiment: "Avaliar experimento",
  commercial_decision: "Decisão comercial",
};

export const AI_ACTIONS = [
  "reply",
  "ask_question",
  "show_product",
  "explain_customization",
  "collect_requirement",
  "request_reference",
  "prepare_briefing",
  "prepare_quote_request",
  "send_whatsapp_handoff",
  "schedule_followup",
  "wait",
  "close",
  "escalate_to_human",
] as const;

export type AiAction = (typeof AI_ACTIONS)[number];

export type IntentDecision = {
  intent: Intent;
  action: AiAction;
  reason: string;
  message: string;
  requiresHuman: boolean;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const includesAny = (body: string, terms: string[]) =>
  terms.some((term) => body.includes(term));

export function classifyIntent(message: string): Intent {
  const body = normalize(message);

  if (
    includesAny(body, [
      "nao me chame",
      "nao quero receber",
      "pare de mandar",
      "remover meu contato",
      "nao tenho interesse e nao",
    ])
  ) return "opt_out";
  if (includesAny(body, ["quero fechar", "pode fechar", "fechar o pedido", "pode fazer o pedido", "vou comprar", "fechado"])) return "ready_to_order";
  if (includesAny(body, ["whatsapp", "zap", "numero de voces"])) return "wants_whatsapp";
  if (includesAny(body, ["orcamento", "faz uma cotacao", "me passa o valor certinho"])) return "wants_quote";
  if (includesAny(body, ["quanto custa", "qual o valor", "qual valor", "preco", "preço"])) return "asked_price";
  if (includesAny(body, ["posso mandar uma foto", "mandei a foto", "segue referencia", "segue a foto"])) return "sent_reference";
  if (includesAny(body, ["personalizado", "personalizar", "colocar nome", "com o nome"])) return "asked_customization";
  if (includesAny(body, ["quanto tempo", "qual o prazo", "fica pronto", "preciso para", "ate dia"])) return "asked_deadline";
  if (includesAny(body, ["entrega onde", "voces entregam", "frete", "envia para"])) return "asked_shipping";
  if (includesAny(body, ["empresa", "brindes", "fornecedor", "recorrente", "atacado"])) return "business_opportunity";
  if (includesAny(body, ["parceria", "colaboracao", "indicacao", "afiliado"])) return "partnership_interest";
  if (includesAny(body, ["nao tenho interesse", "agora nao", "obrigado, nao"])) return "not_interested";
  if (includesAny(body, ["muito caro", "achei caro", "nao cabe no orcamento"])) return "objection";
  if (includesAny(body, ["voces fazem", "consegue fazer", "tem como fazer", "tenho uma ideia"])) return "asked_product";
  if (includesAny(body, ["oi", "ola", "bom dia", "boa tarde", "boa noite"]) && body.length < 30) return "greeting";
  if (body.length < 4) return "ambiguous";
  return "general_question";
}

export function decideNextAction(intent: Intent): IntentDecision {
  const decisions: Record<Intent, IntentDecision> = {
    greeting: { intent, action: "ask_question", reason: "Ainda não sabemos o que a pessoa procura", message: "Oi! Que bom te ver por aqui 😊 Me conta, o que você está pensando em fazer?", requiresHuman: false },
    general_question: { intent, action: "reply", reason: "Pergunta geral sem intenção comercial clara", message: "Claro! Me conta um pouquinho mais do que você precisa pra eu entender direitinho.", requiresHuman: false },
    interested: { intent, action: "collect_requirement", reason: "Há interesse, mas faltam detalhes", message: "Que legal! Me conta um pouquinho mais do que você imaginou.", requiresHuman: false },
    asked_price: { intent, action: "collect_requirement", reason: "O preço depende do item e só pode vir do catálogo ou de orçamento", message: "Consigo te orientar sim 😊 O valor muda conforme o modelo e a personalização. Qual peça você imaginou e quantas unidades precisa?", requiresHuman: false },
    asked_customization: { intent, action: "request_reference", reason: "Precisamos entender a personalização antes de confirmar viabilidade", message: "A gente trabalha com peças personalizadas. Me manda uma referência e me conta o que você gostaria de mudar?", requiresHuman: false },
    asked_product: { intent, action: "request_reference", reason: "A viabilidade precisa ser analisada", message: "Posso dar uma olhada nessa ideia. Você tem uma foto ou alguma referência do que imaginou?", requiresHuman: false },
    asked_shipping: { intent, action: "collect_requirement", reason: "A região atendida ainda depende de configuração", message: "Me passa sua cidade e seu estado? Aí eu confiro a entrega direitinho.", requiresHuman: false },
    asked_deadline: { intent, action: "collect_requirement", reason: "Não há prazo confirmado sem consulta ao produto", message: "Pra quando você precisa? Aí eu verifico a produção antes de te confirmar.", requiresHuman: false },
    sent_reference: { intent, action: "prepare_briefing", reason: "A referência permite avançar o briefing", message: "Vi a referência! O que você gostaria de personalizar nela?", requiresHuman: false },
    wants_quote: { intent, action: "collect_requirement", reason: "Quantidade e personalização são necessárias para o orçamento", message: "Claro! Me conta quantas unidades você precisa e se pensou em alguma personalização.", requiresHuman: false },
    wants_whatsapp: { intent, action: "send_whatsapp_handoff", reason: "A pessoa pediu o canal de fechamento", message: "Claro! Vou deixar o que a gente conversou organizadinho pra você não precisar explicar tudo de novo por lá.", requiresHuman: false },
    ready_to_order: { intent, action: "escalate_to_human", reason: "Fechamento deve ser acompanhado pela responsável", message: "Perfeito! Vou organizar o que a gente conversou e chamar a responsável pra seguir com você.", requiresHuman: true },
    business_opportunity: { intent, action: "escalate_to_human", reason: "Oportunidade recorrente precisa de avaliação comercial", message: "Obrigada por contar a ideia! Vou organizar os detalhes e conversar com a responsável por aqui.", requiresHuman: true },
    partnership_interest: { intent, action: "escalate_to_human", reason: "Não há programa de parceria ativo", message: "Legal, obrigada por pensar na gente! Vou organizar sua ideia e conversar com a responsável por aqui.", requiresHuman: true },
    objection: { intent, action: "escalate_to_human", reason: "Negociação não deve ser automatizada", message: "Entendi. Vou conversar com a responsável pra ver o que faz sentido nesse caso, sem te prometer algo antes de confirmar.", requiresHuman: true },
    not_interested: { intent, action: "close", reason: "Recusa explícita encerra a abordagem", message: "Tudo bem 😊 Obrigada por me avisar!", requiresHuman: false },
    opt_out: { intent, action: "close", reason: "Opt-out deve ser permanente e imediato", message: "Pode deixar. Não enviaremos mais mensagens por aqui.", requiresHuman: false },
    ambiguous: { intent, action: "ask_question", reason: "A mensagem não tem contexto suficiente", message: "Não entendi muito bem 😅 Você consegue me contar um pouquinho mais?", requiresHuman: false },
    needs_human: { intent, action: "escalate_to_human", reason: "A solicitação exige revisão humana", message: "Prefiro confirmar isso direitinho antes de te responder. Vou verificar com a responsável por aqui.", requiresHuman: true },
  };
  return decisions[intent];
}

export type ScoreSignals = {
  intent?: Intent;
  icpMatches?: number;
  replied?: boolean;
  sentReference?: boolean;
  informedQuantity?: boolean;
  informedDeadline?: boolean;
  askedQuote?: boolean;
  askedWhatsapp?: boolean;
  businessPotential?: boolean;
  historicalConversionBoost?: number;
};

export function calculateLeadScore(signals: ScoreSignals) {
  const intentWeights: Partial<Record<Intent, number>> = {
    asked_price: 18,
    asked_customization: 18,
    sent_reference: 24,
    wants_quote: 28,
    wants_whatsapp: 26,
    ready_to_order: 34,
    business_opportunity: 20,
  };
  const intentScore = Math.min(35, intentWeights[signals.intent ?? "ambiguous"] ?? 6);
  const icpScore = Math.min(20, Math.max(0, signals.icpMatches ?? 0) * 7);
  const engagementScore = Math.min(20, (signals.replied ? 8 : 0) + (signals.sentReference ? 12 : 0));
  const commercialPotentialScore = Math.min(15, (signals.informedQuantity ? 5 : 0) + (signals.askedQuote ? 6 : 0) + (signals.businessPotential ? 8 : 0) + Math.max(0, signals.historicalConversionBoost || 0));
  const urgencyScore = Math.min(10, (signals.informedDeadline ? 6 : 0) + (signals.askedWhatsapp ? 4 : 0));
  return {
    intentScore,
    icpScore,
    engagementScore,
    commercialPotentialScore,
    urgencyScore,
    total: intentScore + icpScore + engagementScore + commercialPotentialScore + urgencyScore,
  };
}

export type CatalogTruth = {
  name: string;
  basePriceCents?: number | null;
  priceFromCents?: number | null;
  productionTime?: string | null;
  active?: boolean;
};

export function evaluateCatalogTruth(product: CatalogTruth | null) {
  if (!product || product.active === false) {
    return { needsQuote: true, needsProductionReview: true, canShowProduct: false };
  }
  return {
    needsQuote: product.basePriceCents == null && product.priceFromCents == null,
    needsProductionReview: !product.productionTime,
    canShowProduct: true,
  };
}

export type BriefingData = {
  productInterest?: string | null;
  occasion?: string | null;
  referenceDescription?: string | null;
  customizationText?: string | null;
  preferredColors?: string | null;
  quantity?: number | null;
  desiredDeadline?: string | null;
  city?: string | null;
  state?: string | null;
  additionalNotes?: string | null;
};

export function extractBriefingFields(message: string): Partial<BriefingData> {
  const result: Partial<BriefingData> = {};
  const quantity = message.match(/\b(\d{1,4})\s*(?:unidades?|pecas?|peças?|itens?)\b/i);
  const deadline = message.match(/\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/);
  const name = message.match(/(?:nome|escrito|com)\s+["“']?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]{1,24})["”']?/u);
  const cityState = message.match(/(?:em|para)\s+([\p{L}\s]{2,40})\s*[-/]\s*([A-Z]{2})\b/u);
  if (quantity) result.quantity = Number(quantity[1]);
  if (deadline) result.desiredDeadline = deadline[1];
  if (name) result.customizationText = name[1];
  if (cityState) {
    result.city = cityState[1].trim();
    result.state = cityState[2];
  }
  return result;
}

export function buildBriefingSummary(
  username: string,
  briefing: BriefingData,
) {
  const lines = [`Cliente: @${username.replace(/^@/, "")}`, ""];
  if (briefing.productInterest) lines.push("Interesse:", `${briefing.productInterest}.`, "");
  if (briefing.referenceDescription) lines.push("Ideia:", `${briefing.referenceDescription}.`, "");
  if (briefing.customizationText) lines.push("Personalização:", briefing.customizationText, "");
  if (briefing.quantity) lines.push("Quantidade:", `${briefing.quantity} ${briefing.quantity === 1 ? "unidade" : "unidades"}.`, "");
  if (briefing.desiredDeadline) lines.push("Prazo desejado:", `${briefing.desiredDeadline}.`, "");
  if (briefing.city || briefing.state) lines.push("Local:", `${briefing.city ?? "Cidade não informada"}${briefing.state ? `/${briefing.state}` : ""}.`, "");
  lines.push("Pontos pendentes:", briefing.additionalNotes || "Validar viabilidade, prazo e calcular orçamento.");
  return lines.join("\n");
}

export function canonicalInstagramUsername(username: string) {
  return username.trim().replace(/^@/, "").toLocaleLowerCase("pt-BR");
}

export function canScheduleFollowup(input: {
  doNotContact: boolean;
  explicitRefusal: boolean;
  followupsSent: number;
  maxFollowups: number;
  hasRepliedSinceLastContact: boolean;
}) {
  return !input.doNotContact && !input.explicitRefusal && !input.hasRepliedSinceLastContact && input.followupsSent < input.maxFollowups;
}

export function isWithinAiBudget(spentUsd: number, monthlyBudgetUsd: number) {
  return monthlyBudgetUsd > 0 && spentUsd < monthlyBudgetUsd;
}

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  constructor(private readonly threshold = 3, private readonly resetAfterMs = 60_000) {}
  canExecute(now = Date.now()) {
    if (this.openedAt === null) return true;
    if (now - this.openedAt >= this.resetAfterMs) {
      this.consecutiveFailures = 0;
      this.openedAt = null;
      return true;
    }
    return false;
  }
  recordSuccess() {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }
  recordFailure(now = Date.now()) {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.threshold) this.openedAt = now;
  }
}
