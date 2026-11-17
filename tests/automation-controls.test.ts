import { describe, expect, it } from "vitest";
import { buildAutomationOverview, resolveAutomationControls, resolveWorkerStatus } from "../src/features/automation/domain";

const now = Date.parse("2026-11-06T12:00:00Z");
const env = { OPENAI_API_KEY: "configured", OPENAI_MODEL: "model", OPENAI_MONTHLY_BUDGET_USD: "10",
  OPENAI_INPUT_COST_PER_1M_USD: "1", OPENAI_OUTPUT_COST_PER_1M_USD: "1",
  INSTAGRAM_AUTO_REPLY_ENABLED: "true", INSTAGRAM_PAGE_ACCESS_TOKEN: "configured", INSTAGRAM_BUSINESS_ACCOUNT_ID: "account" };
function overview(settings: Record<string, string> = {}) {
  return buildAutomationOverview({ settings, env, spentUsd: 0, schedulerReady: true, now });
}

describe("central de Automação e IA", () => {
  it("preserva a pausa de respostas e do worker na ausência de configurações", () => {
    expect(resolveAutomationControls({})).toMatchObject({ repliesEnabled: false, localWorkerEnabled: false,
      openingsEnabled: true, qualificationEnabled: true, autoRepliesPaused: true });
    expect(overview().features.find(f => f.key === "auto_replies_paused")?.state).toBe("paused");
  });

  it("permite configuração pelo painel sem publicação e falha fechado com valores inválidos", () => {
    expect(resolveAutomationControls({ ai_reply_generation_enabled: "true" }, { AI_REPLY_GENERATION_ENABLED: "false" }).repliesEnabled).toBe(true);
    expect(resolveAutomationControls({ ai_reply_generation_enabled: "false" }, { AI_REPLY_GENERATION_ENABLED: "true" }).repliesEnabled).toBe(false);
    expect(resolveAutomationControls({ ai_reply_generation_enabled: "invalid", local_worker_enabled: "invalid" }).repliesEnabled).toBe(false);
    expect(resolveAutomationControls({}, { AI_REPLY_GENERATION_ENABLED: "true" }).repliesEnabled).toBe(true);
  });

  it("não confunde envio liberado com geração pausada", () => {
    const state = overview({ auto_replies_paused: "false" });
    const sending = state.features.find(f => f.key === "auto_replies_paused")!;
    expect(sending.enabled).toBe(true);
    expect(sending.state).toBe("blocked");
    expect(sending.reason).toContain("geração de respostas");
  });

  it("mostra espera em vez de ativo quando o worker não se comunica", () => {
    const state = overview({ local_worker_enabled: "true", outbound_paused: "false" });
    expect(state.worker.connected).toBe(false);
    expect(state.worker.statusLabel).toBe("Sem comunicação recente");
    expect(state.features.find(f => f.key === "outbound_paused")?.state).toBe("waiting");
  });

  it.each([undefined, "invalid", JSON.stringify({ at: "invalid", status: "idle" }),
    JSON.stringify({ at: new Date(now - 90_001).toISOString(), status: "idle" }),
    JSON.stringify({ at: new Date(now + 1000).toISOString(), status: "idle" }),
    JSON.stringify({ at: new Date(now).toISOString(), status: "stopped" })])(
    "não declara conectado para sinal ausente, inválido, futuro, antigo ou parado: %s", raw => {
      const settings: Record<string, string> = { local_worker_enabled: "true" };
      if (raw !== undefined) settings.local_worker_heartbeat = raw;
      expect(resolveWorkerStatus(settings, now).connected).toBe(false);
    },
  );

  it("mostra conexão e configuração da estação, sem usar o Chrome do servidor", () => {
    const state = overview({ local_worker_enabled: "true", discovery_paused: "false", local_worker_heartbeat:
      JSON.stringify({ at: new Date(now).toISOString(), status: "idle", browserConfigured: true, discoveryEnabled: true, qualificationConfigured: true }) });
    expect(state.worker.connected).toBe(true);
    expect(state.features.find(f => f.key === "discovery_paused")?.state).toBe("ready");
  });

  it("respeita o orçamento e a pausa geral sem alterar permissões manuais", () => {
    const state = buildAutomationOverview({ settings: { ai_reply_generation_enabled: "true", automation_paused: "true" },
      env, spentUsd: 10, schedulerReady: true, now });
    expect(state.features.find(f => f.key === "ai_reply_generation_enabled")).toMatchObject({ enabled: true, state: "blocked" });
    expect(state.features.find(f => f.key === "ai_reply_generation_enabled")?.reason).toContain("limite mensal");
    expect(resolveAutomationControls({ automation_paused: "true", ai_reply_generation_enabled: "true" }).repliesEnabled).toBe(true);
  });

  it("os botões indicam a ação e usam a polaridade correta de cada configuração", () => {
    for (const feature of overview().features) {
      expect(feature.actionLabel).toBe(feature.enabled ? "Pausar" : "Ativar");
      const updated = overview({ [feature.key]: feature.nextValue });
      expect(updated.features.find(f => f.key === feature.key)?.enabled).toBe(!feature.enabled);
    }
  });

  it("explica dependências entre busca e qualificação", () => {
    expect(overview({ ai_qualification_enabled: "false" }).features.find(f => f.key === "discovery_paused")?.reason).toContain("qualificação por IA está pausada");
    expect(overview({ discovery_paused: "true" }).features.find(f => f.key === "ai_qualification_enabled")?.reason).toContain("busca e a importação");
  });

  it("permite respostas curtas quando somente o modelo rápido está configurado", () => {
    const state = buildAutomationOverview({ settings: { ai_reply_generation_enabled: "true" },
      env: { ...env, OPENAI_MODEL: "", OPENAI_MODEL_FAST: "fast" }, spentUsd: 0, schedulerReady: true, now });
    expect(state.features.find(f => f.key === "ai_reply_generation_enabled")?.state).toBe("ready");
    expect(state.features.find(f => f.key === "ai_reply_generation_enabled")?.reason).toContain("Apenas mensagens curtas");
    expect(state.features.find(f => f.key === "ai_outbound_opening_enabled")?.state).toBe("blocked");
  });
});
