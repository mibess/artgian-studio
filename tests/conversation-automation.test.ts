import { describe, expect, it } from "vitest";
import {
  evaluateAutoReplyPolicy,
  isWithinOperatingHours,
} from "../src/features/conversations/automation";

const safeDecision = {
  intent: "asked_customization" as const,
  action: "request_reference" as const,
  reason: "É preciso entender a personalização",
  message: "Você tem uma referência do que imaginou?",
  requiresHuman: false,
  source: "openai" as const,
};

function evaluate(overrides: Partial<Parameters<typeof evaluateAutoReplyPolicy>[0]> = {}) {
  return evaluateAutoReplyPolicy({
    decision: safeDecision,
    enabled: true,
    automationPaused: false,
    autoRepliesPaused: false,
    withinOperatingHours: true,
    sentToday: 0,
    dailyLimit: 20,
    ...overrides,
  });
}

describe("política de respostas automáticas inbound", () => {
  it("permite somente uma intenção comercial explícita e segura gerada pela OpenAI", () => {
    expect(evaluate()).toEqual({ allowed: true, reason: "safe_inbound" });
  });

  it.each(["greeting", "general_question"] as const)(
    "permite %s quando a resposta apenas pede mais contexto",
    (intent) => {
      expect(
        evaluate({
          decision: { ...safeDecision, intent, action: "ask_question" },
        }),
      ).toEqual({ allowed: true, reason: "safe_inbound" });
    },
  );

  it.each(["greeting", "general_question"] as const)(
    "mantém %s em revisão quando a resposta faz uma afirmação geral",
    (intent) => {
      expect(
        evaluate({ decision: { ...safeDecision, intent, action: "reply" } }),
      ).toEqual({ allowed: false, reason: "unsafe_intent" });
    },
  );

  it("mantém mensagens ambíguas em revisão humana", () => {
    expect(
      evaluate({ decision: { ...safeDecision, intent: "ambiguous" } }),
    ).toEqual({ allowed: false, reason: "unsafe_intent" });
  });

  it("bloqueia fallback local, decisão sensível e ação de escalonamento", () => {
    expect(evaluate({ decision: { ...safeDecision, source: "rules" } }).allowed).toBe(false);
    expect(evaluate({ decision: { ...safeDecision, requiresHuman: true } }).allowed).toBe(false);
    expect(
      evaluate({ decision: { ...safeDecision, action: "escalate_to_human" } }).allowed,
    ).toBe(false);
  });

  it("respeita kill switches, horário de atendimento e limite diário", () => {
    expect(evaluate({ enabled: false }).allowed).toBe(false);
    expect(evaluate({ automationPaused: true }).allowed).toBe(false);
    expect(evaluate({ autoRepliesPaused: true }).allowed).toBe(false);
    expect(evaluate({ withinOperatingHours: false }).allowed).toBe(false);
    expect(evaluate({ sentToday: 20 }).allowed).toBe(false);
  });

  it("interpreta horários normais e intervalos que atravessam a meia-noite", () => {
    const middayUtc = new Date("2026-09-02T15:00:00.000Z");
    expect(isWithinOperatingHours(middayUtc, "09:00-18:00", "America/Sao_Paulo")).toBe(true);
    expect(isWithinOperatingHours(middayUtc, "20:00-06:00", "America/Sao_Paulo")).toBe(false);
    expect(isWithinOperatingHours(middayUtc, "horário-inválido", "America/Sao_Paulo")).toBe(false);
  });
});
