import { describe, expect, it } from "vitest";
import {
  CircuitBreaker,
  buildBriefingSummary,
  calculateLeadScore,
  canScheduleFollowup,
  canonicalInstagramUsername,
  classifyIntent,
  decideNextAction,
  evaluateCatalogTruth,
  extractBriefingFields,
  isWithinAiBudget,
} from "../src/features/leads/domain";

describe("classificação de intenção", () => {
  it.each([
    ["quanto custa?", "asked_price"],
    ["vocês fazem personalizado?", "asked_customization"],
    ["posso mandar uma foto?", "sent_reference"],
    ["preciso de orçamento", "wants_quote"],
    ["me chama no WhatsApp", "wants_whatsapp"],
    ["pode fechar o pedido", "ready_to_order"],
    ["busco fornecedor para brindes da empresa", "business_opportunity"],
    ["não quero receber mensagens", "opt_out"],
  ])("classifica %s", (message, expected) => {
    expect(classifyIntent(message)).toBe(expected);
  });

  it("nunca responde opt-out com follow-up", () => {
    const decision = decideNextAction("opt_out");
    expect(decision.action).toBe("close");
    expect(decision.message).toContain("Não enviaremos");
  });
});

describe("lead score", () => {
  it("prioriza sinais comerciais fortes", () => {
    const strong = calculateLeadScore({ intent: "wants_quote", icpMatches: 2, replied: true, sentReference: true, informedQuantity: true, informedDeadline: true, askedQuote: true, askedWhatsapp: true });
    const generic = calculateLeadScore({ intent: "greeting", icpMatches: 1 });
    expect(strong.total).toBeGreaterThan(80);
    expect(strong.total).toBeGreaterThan(generic.total * 2);
    expect(strong).toMatchObject({ intentScore: 28, engagementScore: 20, urgencyScore: 10 });
  });

  it("usa conversões confirmadas como um pequeno reforço, sem dominar o score", () => {
    const baseline = calculateLeadScore({ intent: "interested", icpMatches: 1, replied: true });
    const learned = calculateLeadScore({ intent: "interested", icpMatches: 1, replied: true, historicalConversionBoost: 3 });
    expect(learned.total).toBe(baseline.total + 3);
    expect(learned.commercialPotentialScore).toBeLessThanOrEqual(15);
  });
});

describe("briefing incremental", () => {
  it("extrai somente dados presentes", () => {
    expect(extractBriefingFields("Preciso de 20 unidades até 15/09 para Ribeirão Preto/SP")).toEqual({ quantity: 20, desiredDeadline: "15/09", city: "Ribeirão Preto", state: "SP" });
  });

  it("gera resumo sem inventar campos ausentes", () => {
    const summary = buildBriefingSummary("cliente.teste", { productInterest: "Presente personalizado", quantity: 1 });
    expect(summary).toContain("Cliente: @cliente.teste");
    expect(summary).toContain("1 unidade");
    expect(summary).toContain("Validar viabilidade");
    expect(summary).not.toContain("Prazo desejado:");
  });
});

describe("catálogo como fonte de verdade", () => {
  it("bloqueia preço e prazo ausentes", () => {
    expect(evaluateCatalogTruth({ name: "Peça sob demanda" })).toEqual({ needsQuote: true, needsProductionReview: true, canShowProduct: true });
  });

  it("libera apenas dados cadastrados", () => {
    expect(evaluateCatalogTruth({ name: "Produto", basePriceCents: 8900, productionTime: "5 dias úteis" })).toEqual({ needsQuote: false, needsProductionReview: false, canShowProduct: true });
  });

  it("não mostra produto inativo", () => {
    expect(evaluateCatalogTruth({ name: "Produto", active: false }).canShowProduct).toBe(false);
  });
});

describe("guardas operacionais", () => {
  it("normaliza perfil para deduplicação", () => {
    expect(canonicalInstagramUsername("  @Cliente.Teste ")).toBe("cliente.teste");
  });

  it("cancela follow-up após resposta, recusa ou opt-out", () => {
    expect(canScheduleFollowup({ doNotContact: true, explicitRefusal: false, followupsSent: 0, maxFollowups: 2, hasRepliedSinceLastContact: false })).toBe(false);
    expect(canScheduleFollowup({ doNotContact: false, explicitRefusal: true, followupsSent: 0, maxFollowups: 2, hasRepliedSinceLastContact: false })).toBe(false);
    expect(canScheduleFollowup({ doNotContact: false, explicitRefusal: false, followupsSent: 0, maxFollowups: 2, hasRepliedSinceLastContact: true })).toBe(false);
    expect(canScheduleFollowup({ doNotContact: false, explicitRefusal: false, followupsSent: 2, maxFollowups: 2, hasRepliedSinceLastContact: false })).toBe(false);
  });

  it("bloqueia IA sem orçamento disponível", () => {
    expect(isWithinAiBudget(3, 3)).toBe(false);
    expect(isWithinAiBudget(0, 0)).toBe(false);
    expect(isWithinAiBudget(1, 3)).toBe(true);
  });

  it("abre e recupera circuit breaker", () => {
    const breaker = new CircuitBreaker(2, 100);
    breaker.recordFailure(0);
    expect(breaker.canExecute(10)).toBe(true);
    breaker.recordFailure(20);
    expect(breaker.canExecute(30)).toBe(false);
    expect(breaker.canExecute(121)).toBe(true);
  });
});
