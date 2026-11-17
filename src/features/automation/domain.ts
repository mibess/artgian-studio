export const AUTOMATION_SETTING_KEYS = [
  "automation_paused", "discovery_paused", "outbound_paused",
  "followups_paused", "auto_replies_paused", "ai_reply_generation_enabled",
  "ai_outbound_opening_enabled", "ai_qualification_enabled", "local_worker_enabled",
] as const;

export type AutomationSettingKey = typeof AUTOMATION_SETTING_KEYS[number];
type Settings = Record<string, string>;
type Environment = Record<string, string | undefined>;

function enabledSetting(value: string | undefined, fallback: boolean) {
  return value === undefined ? fallback : value === "true";
}

export function resolveAutomationControls(settings: Settings, env: Environment = {}) {
  return {
    repliesEnabled: enabledSetting(settings.ai_reply_generation_enabled, env.AI_REPLY_GENERATION_ENABLED === "true"),
    openingsEnabled: enabledSetting(settings.ai_outbound_opening_enabled, true),
    qualificationEnabled: enabledSetting(settings.ai_qualification_enabled, true),
    localWorkerEnabled: enabledSetting(settings.local_worker_enabled, false),
    automationPaused: settings.automation_paused === "true",
    discoveryPaused: settings.discovery_paused === "true",
    outboundPaused: settings.outbound_paused !== "false",
    followupsPaused: settings.followups_paused !== "false",
    autoRepliesPaused: settings.auto_replies_paused !== "false",
  };
}

export function parseWorkerHeartbeat(raw: string | undefined) {
  try {
    const data = JSON.parse(raw || "null");
    if (!data || typeof data.at !== "string" || !Number.isFinite(Date.parse(data.at)) ||
      !["idle", "working", "paused", "error", "stopped"].includes(data.status)) return null;
    return {
      at: data.at as string,
      status: data.status as "idle" | "working" | "paused" | "error" | "stopped",
      browserConfigured: data.browserConfigured === true,
      discoveryEnabled: data.discoveryEnabled === true,
      outboundEnabled: data.outboundEnabled === true,
      qualificationConfigured: data.qualificationConfigured === true,
    };
  } catch { return null; }
}

export function resolveWorkerStatus(settings: Settings, now = Date.now()) {
  const enabled = resolveAutomationControls(settings).localWorkerEnabled;
  const heartbeat = parseWorkerHeartbeat(settings.local_worker_heartbeat);
  const age = heartbeat ? now - Date.parse(heartbeat.at) : Infinity;
  const connected = age >= 0 && age <= 90_000 && heartbeat?.status !== "stopped";
  const statusLabel = !enabled ? "Tarefas locais pausadas"
    : !connected ? "Sem comunicação recente"
    : heartbeat?.status === "error" ? "Requer atenção"
    : heartbeat?.status === "paused" ? "Aguardando liberação"
    : heartbeat?.status === "working" ? "Executando tarefa" : "Conectado";
  const reason = !enabled
    ? "Novas tarefas locais estão bloqueadas. Uma tarefa já iniciada pode terminar antes da pausa."
    : !connected ? "O painel não recebeu um sinal recente. Inicie o programa no computador operacional ou confira sua conexão."
    : heartbeat?.status === "error" ? "O worker informou uma falha. Confira o computador operacional."
    : "O programa está conectado. Cada tarefa ainda depende dos controles e das regras abaixo.";
  return { enabled, connected, statusLabel, reason, lastSeenAt: heartbeat?.at || null, heartbeat };
}

export type AutomationFeature = {
  key: AutomationSettingKey;
  title: string;
  description: string;
  location: string;
  tokens: boolean;
  enabled: boolean;
  nextValue: "true" | "false";
  actionLabel: string;
  state: "paused" | "ready" | "waiting" | "blocked";
  statusLabel: string;
  reason: string;
};

export function buildAutomationOverview(input: {
  settings: Settings; env: Environment; spentUsd: number; schedulerReady: boolean; now?: number;
}) {
  const { settings, env } = input;
  const c = resolveAutomationControls(settings, env);
  const worker = resolveWorkerStatus(settings, input.now);
  const limitUsd = Number(env.OPENAI_MONTHLY_BUDGET_USD || 0);
  const budgetReady = Number.isFinite(limitUsd) && limitUsd > 0 && input.spentUsd < limitUsd;
  const ratesReady = Number(env.OPENAI_INPUT_COST_PER_1M_USD) > 0 && Number(env.OPENAI_OUTPUT_COST_PER_1M_USD) > 0;
  const aiBlock = !env.OPENAI_API_KEY?.trim()
    ? "A conexão com a IA precisa ser configurada no servidor."
    : !budgetReady ? (limitUsd > 0 ? "O limite mensal de IA foi atingido." : "O orçamento mensal de IA ainda não foi configurado.")
    : !ratesReady ? "Os custos do modelo precisam ser configurados." : null;
  const replyAiBlock = aiBlock || (!env.OPENAI_MODEL?.trim() && !env.OPENAI_MODEL_FAST?.trim()
    ? "Configure um modelo para gerar respostas." : null);
  const openingAiBlock = aiBlock || (!env.OPENAI_MODEL?.trim() ? "Configure o modelo principal para gerar abordagens." : null);
  const workerBlock = !worker.enabled ? "As tarefas do worker local estão pausadas."
    : !worker.connected ? "Aguardando comunicação do computador operacional."
    : worker.heartbeat?.status === "error" ? "O worker informou uma falha."
    : worker.heartbeat?.status === "paused" ? "Aguardando o worker reconhecer a liberação de tarefas." : null;
  const automaticBlock = c.automationPaused ? "A execução automática geral está pausada." : null;
  const instagramReady = Boolean(env.INSTAGRAM_PAGE_ACCESS_TOKEN?.trim() && env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim());
  const features: AutomationFeature[] = [];
  function add(key: AutomationSettingKey, title: string, description: string, location: string,
    tokens: boolean, enabled: boolean, block: string | null, readyReason: string, waiting = false) {
    const pausedKey = key.endsWith("_paused");
    features.push({ key, title, description, location, tokens, enabled,
      nextValue: (pausedKey ? enabled : !enabled) ? "true" : "false",
      actionLabel: enabled ? "Pausar" : "Ativar",
      state: !enabled ? "paused" : block ? (waiting ? "waiting" : "blocked") : "ready",
      statusLabel: !enabled ? "Pausado" : block ? (waiting ? "Aguardando" : "Bloqueado") : "Disponível sob regras",
      reason: !enabled ? "Desativado neste controle. Ative somente quando quiser utilizar este recurso." : block || readyReason,
    });
  }
  add("ai_reply_generation_enabled", "Respostas por IA", "Cria e aprimora sugestões para mensagens recebidas. Pausar evita novas chamadas de IA nesta função.", "Site · atendimento", true, c.repliesEnabled, replyAiBlock,
    !env.OPENAI_MODEL?.trim() ? "Apenas mensagens curtas podem usar o modelo rápido. Mensagens longas usam sugestões locais até configurar o modelo principal."
      : "Gera sugestões quando uma mensagem chega ou quando você solicita. O envio é controlado separadamente.");
  add("ai_outbound_opening_enabled", "Abordagens por IA", "Escreve a primeira mensagem de uma campanha. Quando pausado, usa um texto local sem IA.", "Site · campanhas", true, c.openingsEnabled, openingAiBlock, "Só utiliza IA ao preparar uma abordagem no painel. O texto permanece sujeito à aprovação.");
  add("ai_qualification_enabled", "Qualificação de perfis por IA", "Avalia se os perfis encontrados combinam com a campanha. Quando pausado, a qualificação aguarda retomada.", "Computador · worker local", true, c.qualificationEnabled,
    automaticBlock || (c.discoveryPaused ? "A busca e a importação de perfis estão pausadas." : null) || workerBlock || (worker.heartbeat?.qualificationConfigured ? null : "A IA precisa ser configurada no computador operacional."),
    "Cada lote verifica orçamento e evidências antes de usar IA. Os custos seguem a configuração do computador.", Boolean(workerBlock));
  add("automation_paused", "Execução automática geral", "Permite tarefas e envios automáticos. As permissões individuais continuam valendo; a geração manual de IA tem controles próprios.", "Site e computador", false, !c.automationPaused, null, "Não inicia o worker nem libera os recursos pausados individualmente.");
  add("auto_replies_paused", "Envio automático de respostas", "Envia respostas geradas por IA quando a política permite. Pausar o envio sozinho não impede a geração de textos.", "Site · Instagram", false, !c.autoRepliesPaused,
    automaticBlock || (!c.repliesEnabled ? "A geração de respostas por IA está pausada." : replyAiBlock) ||
    (env.INSTAGRAM_AUTO_REPLY_ENABLED !== "true" || !instagramReady ? "O envio pelo Instagram precisa ser habilitado no servidor." : null),
    "Somente mensagens elegíveis, dentro do horário e dos limites. As demais aguardam revisão.");
  add("discovery_paused", "Busca de perfis", "Busca perfis públicos e depende da qualificação dos candidatos por IA. As campanhas aguardam quando a qualificação é pausada.", "Computador · worker local", false, !c.discoveryPaused,
    automaticBlock || (!c.qualificationEnabled ? "A qualificação por IA está pausada. A busca aguarda sua retomada." : null) || workerBlock || (!worker.heartbeat?.discoveryEnabled || !worker.heartbeat.browserConfigured ? "A busca e o navegador precisam ser configurados no computador." : null),
    "Busca quando houver uma campanha agendada e permissões locais válidas.", Boolean(workerBlock));
  add("outbound_paused", "Envio de campanhas", "Envia pelo navegador as abordagens aprovadas, respeitando os limites de contato.", "Computador · worker local", false, !c.outboundPaused,
    automaticBlock || workerBlock || (!worker.heartbeat?.outboundEnabled || !worker.heartbeat.browserConfigured ? "O envio e o navegador precisam ser liberados no computador." : null),
    "Exige aprovação da mensagem e conexão com o navegador ao executar.", Boolean(workerBlock));
  add("followups_paused", "Lembretes de acompanhamento", "Prepara um texto local para retomar a conversa. Você revisa antes de enviar; não usa IA para escrever.", "Site · agendador, ou worker local", false, !c.followupsPaused,
    automaticBlock || (env.FOLLOWUP_REVIEW_ENABLED !== "true" ? "O acompanhamento precisa ser habilitado no servidor." : null) ||
    (!input.schedulerReady && (!worker.enabled || !worker.connected) ? "Aguardando agendador configurado ou worker conectado." : null),
    "Respeita a janela de atendimento e cancela a retomada se houver resposta ou pedido de bloqueio.");
  return { features, worker, budget: { spentUsd: input.spentUsd, limitUsd: Number.isFinite(limitUsd) ? limitUsd : 0 } };
}
