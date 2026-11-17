import Link from "next/link";
import { ArrowRight, Bot, CircleDollarSign, Clock3, Computer, History, SlidersHorizontal, Workflow } from "lucide-react";
import { SubmitButton } from "../../../components/PendingButton";
import { getAutomationOverview } from "../../../../src/features/automation/server";
import { PageHeader, formatDateTime } from "../_components";
import { updateAutomationSetting } from "../actions";
import { RefreshState } from "./RefreshState";

const stateStyles = {
  paused: "border-amber-200 bg-amber-50 text-amber-900",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  waiting: "border-slate-200 bg-slate-50 text-slate-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-900",
};

const flows = [
  {
    title: "Atendimento",
    description: "Receber, gerar uma sugestão e enviar são etapas independentes.",
    steps: ["Mensagem recebida", "Sugestão local · sem tokens", "IA opcional · usa tokens", "Revisão humana ou envio permitido"],
  },
  {
    title: "Prospecção",
    description: "A busca e o envio pelo navegador precisam do worker local.",
    steps: ["Worker busca perfis", "IA avalia os perfis", "Painel prepara a abordagem", "Operador aprova", "Worker envia"],
  },
  {
    title: "Retomadas de conversa",
    description: "O agendador prepara um rascunho para revisão humana.",
    steps: ["Agendamento", "Verificação da conversa", "Rascunho local · sem tokens", "Revisão e envio"],
  },
];

export default async function AutomationPage({ searchParams }: { searchParams: Promise<{ salvo?: string; erro?: string }> }) {
  const [overview, params] = await Promise.all([getAutomationOverview(), searchParams]);
  const { features, worker, budget, history } = overview;
  const workerState = !worker.enabled ? "paused" : !worker.connected ? "waiting" : worker.heartbeat?.status === "error" ? "blocked" : "ready";
  const featureLabels = Object.fromEntries(features.map((feature) => [feature.key, feature.title]));
  featureLabels.local_worker_enabled = "Tarefas do worker local";
  const groups = [
    { title: "Criação e análise por IA", description: "Essas funções podem consumir tokens quando recebem uma tarefa. Cada uma pode ser pausada separadamente.", tokens: true },
    { title: "Execução e envios", description: "Esses controles autorizam tarefas e mensagens. A geração de texto por IA tem os controles acima.", tokens: false },
  ];

  return <>
    <PageHeader eyebrow="Controle da operação" title="Automação e IA" description="Veja o que cada recurso faz, onde funciona e o que falta para operar. Alterações salvas aqui valem para as próximas tarefas." />
    <div className="mb-5 flex flex-wrap gap-2">
      <RefreshState />
      <Link href="/admin/ia" className="inline-flex items-center gap-2 rounded-xl border border-[#d9e3e7] bg-white px-4 py-2.5 text-xs font-semibold text-[#415967]"><CircleDollarSign size={14} />Consumo de IA</Link>
      <Link href="/admin/jobs" className="inline-flex items-center gap-2 rounded-xl border border-[#d9e3e7] bg-white px-4 py-2.5 text-xs font-semibold text-[#415967]"><Workflow size={14} />Fila de tarefas</Link>
    </div>
    <p className="mb-5 text-xs leading-5 text-[#718088]">O estado se atualiza enquanto esta tela estiver aberta. Pausas valem para novas chamadas e tarefas; uma operação já iniciada pode terminar.</p>
    {params.salvo && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Controle atualizado. As demais configurações foram preservadas.</p>}
    {params.erro && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{params.erro}</p>}

    <section aria-labelledby="automation-flow-title" className="mb-7 rounded-[22px] border border-[#e1e1db] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c8a90]">Entenda o fluxo</p><h2 id="automation-flow-title" className="mt-1 text-lg font-semibold">Do contato à mensagem enviada</h2></div>
        <p className="rounded-xl bg-[#f7f5ee] px-4 py-3 text-xs text-[#526873]">IA neste mês: <strong>US$ {budget.spentUsd.toFixed(2).replace(".", ",")}</strong>{budget.limitUsd > 0 ? ` de US$ ${budget.limitUsd.toFixed(2).replace(".", ",")}` : " · limite não configurado"}</p>
      </div>
      <div className="mt-5 divide-y divide-[#ecece7]">
        {flows.map((flow) => <div key={flow.title} className="py-4 first:pt-0 last:pb-0">
          <h3 className="text-sm font-bold text-[#344f5c]">{flow.title}</h3>
          <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2" aria-label={`Etapas de ${flow.title.toLowerCase()}`}>
            {flow.steps.map((step, index) => <li key={step} className="flex items-center gap-2 text-xs text-[#526873]">
              {index > 0 && <ArrowRight size={13} aria-hidden="true" className="shrink-0 text-[#9aa3a7]" />}
              <span className="rounded-lg bg-[#f7f5ee] px-3 py-2"><span className="mr-1.5 font-bold text-[#bc5b40]">{index + 1}.</span>{step}</span>
            </li>)}
          </ol>
          <p className="mt-2 text-xs leading-5 text-[#7c8a90]">{flow.description}</p>
        </div>)}
      </div>
    </section>

    {groups.map((group) => <section key={group.title} className="mb-7" aria-label={group.title}>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8e1f2] text-[#6b5481]">{group.tokens ? <Bot size={18} /> : <SlidersHorizontal size={18} />}</span>
        <div><h2 className="text-lg font-semibold">{group.title}</h2><p className="mt-1 text-xs leading-5 text-[#718088]">{group.description}</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {features.filter((feature) => feature.tokens === group.tokens).map((feature) => <article key={feature.key} className="flex flex-col rounded-[22px] border border-[#e1e1db] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-[#344f5c]">{feature.title}</h3>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${stateStyles[feature.state]}`}>{feature.statusLabel}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#526873]">{feature.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#718088]"><span className="rounded-lg bg-[#f7f5ee] px-2.5 py-1.5">Onde funciona: {feature.location}</span><span className="rounded-lg bg-[#f7f5ee] px-2.5 py-1.5">{feature.tokens ? "Pode consumir tokens" : "Este controle não chama IA"}</span></div>
          <p className="my-4 flex-1 rounded-xl bg-[#faf9f6] px-3 py-3 text-xs leading-5 text-[#526873]">{feature.reason}</p>
          <form action={updateAutomationSetting} className="flex items-center justify-between gap-3 border-t border-[#ecece7] pt-4">
            <input type="hidden" name="key" value={feature.key} />
            <input type="hidden" name="value" value={feature.nextValue} />
            <input type="hidden" name="returnTo" value="/admin/automacao" />
            <p className="text-xs text-[#7c8a90]">Permissão: {feature.enabled ? "liberada" : "pausada"}</p>
            <SubmitButton pendingLabel="Salvando…" aria-label={`${feature.actionLabel}: ${feature.title}`} className={`rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-60 ${feature.enabled ? "border border-[#d9d6cf] bg-white text-[#526873]" : "bg-[#193848] text-white"}`}>{feature.actionLabel}</SubmitButton>
          </form>
        </article>)}
      </div>
    </section>)}

    <section aria-labelledby="local-worker-title" className="mb-7 rounded-[22px] border border-[#d9e3e7] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#dce8f6] text-[#425d91]"><Computer size={19} /></span><div><h2 id="local-worker-title" className="text-lg font-semibold">Worker local</h2><p className="mt-1 text-xs leading-5 text-[#718088]">Programa que executa buscas e envios pelo navegador no computador operacional.</p></div></div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${stateStyles[workerState]}`}>{worker.statusLabel}</span>
      </div>
      <p className="mt-5 rounded-xl bg-[#f7f5ee] p-4 text-sm leading-6 text-[#526873]">{worker.reason}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold text-[#526873]">Tarefas locais: {worker.enabled ? "permitidas pelo painel" : "pausadas pelo painel"}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-[#7c8a90]"><Clock3 size={13} />Última comunicação: {worker.lastSeenAt ? formatDateTime(worker.lastSeenAt) : "nenhuma registrada"}</p></div>
        <form action={updateAutomationSetting}>
          <input type="hidden" name="key" value="local_worker_enabled" />
          <input type="hidden" name="value" value={worker.enabled ? "false" : "true"} />
          <input type="hidden" name="returnTo" value="/admin/automacao" />
          <SubmitButton pendingLabel="Salvando…" className="rounded-xl border border-[#d9e3e7] bg-white px-4 py-2.5 text-xs font-bold text-[#415967] disabled:opacity-60">{worker.enabled ? "Pausar tarefas locais" : "Permitir tarefas locais"}</SubmitButton>
        </form>
      </div>
      <details className="mt-5 rounded-xl border border-[#e1e1db] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#415967]">Como o worker é iniciado e pausado?</summary>
        <div className="mt-3 space-y-2 text-xs leading-6 text-[#718088]"><p>Para operar, ele precisa de duas condições: tarefas locais permitidas neste painel e o programa aberto no computador operacional. Permitir tarefas aqui não inicia o programa nem liga o computador.</p><p>O responsável pela máquina deve iniciar o worker com acesso ao banco e ao navegador dedicado. A próxima comunicação aparecerá acima. Sem comunicação recente, o painel não confirma que ele está funcionando.</p><p>Pausar pelo painel impede o início da próxima tarefa. Uma tarefa que já começou pode terminar. Para encerrar o programa e impedir sua inicialização automática, o responsável deve fazê-lo na própria máquina.</p></div>
      </details>
    </section>

    <section aria-labelledby="automation-history-title" className="overflow-hidden rounded-[22px] border border-[#e1e1db] bg-white">
      <div className="flex items-center gap-3 border-b border-[#ecece7] px-5 py-4"><History size={18} className="text-[#7c8a90]" /><div><h2 id="automation-history-title" className="text-base font-semibold">Últimas alterações nos controles</h2><p className="mt-1 text-xs text-[#7c8a90]">As mudanças ficam registradas para consulta.</p></div></div>
      {history.length ? <ul className="divide-y divide-[#ecece7]">{history.map((entry) => {
        const allowed = entry.key.endsWith("_paused") ? entry.value === "false" : entry.value === "true";
        return <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"><p className="text-xs text-[#526873]"><strong>{featureLabels[entry.key] || "Controle operacional"}</strong> · {entry.value !== "true" && entry.value !== "false" ? "Atualizado" : allowed ? "Permissão liberada" : "Pausado"}</p><time className="text-xs text-[#7c8a90]" dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time></li>;
      })}</ul> : <p className="px-5 py-5 text-sm text-[#7c8a90]">Ainda não há alterações registradas nesses controles.</p>}
    </section>
  </>;
}
