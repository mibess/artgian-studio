import { Bot, CircleDollarSign, Cpu, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { getOperationsData } from "../../../src/db/commercial";
import { PageHeader, formatDateTime } from "../_components";
import { JOB_TYPE_LABELS } from "../../../src/features/leads/domain";

export default async function AiPage() {
  const { aiUsage } = await getOperationsData();
  const inputTokens=aiUsage.reduce((sum,row)=>sum+row.inputTokens,0);
  const outputTokens=aiUsage.reduce((sum,row)=>sum+row.outputTokens,0);
  const cost=aiUsage.reduce((sum,row)=>sum+row.estimatedCostUsdMicros/1_000_000,0);
  const budget=Number(process.env.OPENAI_MONTHLY_BUDGET_USD||0);
  const percentage=budget>0?Math.min(100,cost/budget*100):0;
  return <>
    <PageHeader eyebrow="Rastreabilidade" title="Inteligência artificial" description="Cada chamada, decisão, token e custo fica registrado. Claims comerciais permanecem sob controle humano." />
    <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      {label:"Chamadas registradas",value:aiUsage.length,icon:Bot,color:"bg-[#eee2f0] text-[#74527b]"},
      {label:"Tokens de entrada",value:inputTokens.toLocaleString("pt-BR"),icon:Cpu,color:"bg-[#dce8f6] text-[#425d91]"},
      {label:"Tokens de saída",value:outputTokens.toLocaleString("pt-BR"),icon:Zap,color:"bg-[#fff0c9] text-[#8b6718]"},
      {label:"Custo estimado",value:`US$ ${cost.toFixed(4).replace(".",",")}`,icon:CircleDollarSign,color:"bg-[#d8ede4] text-[#2b7258]"},
    ].map(item=>{const Icon=item.icon;return <article className="rounded-[20px] border border-[#e1e1db] bg-white p-5" key={item.label}><span className={`grid size-9 place-items-center rounded-xl ${item.color}`}><Icon size={16}/></span><p className="mt-4 text-[9px] font-bold uppercase tracking-wide text-[#8b979d]">{item.label}</p><p className="mt-1 text-xl font-semibold tracking-[-0.035em]">{item.value}</p></article>})}</section>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="overflow-hidden rounded-[22px] border border-[#e1e1db] bg-white"><header className="border-b border-[#ecece7] px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b979d]">Registro de uso</p><h2 className="mt-1 text-base font-semibold">Chamadas recentes</h2></header><div className="divide-y divide-[#efefea]">{aiUsage.map(row=><div className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_.8fr_.7fr] sm:items-center" key={row.id}><div><p className="text-xs font-bold text-[#415967]">{JOB_TYPE_LABELS[row.purpose] || "Decisão da inteligência artificial"}</p><p className="mt-0.5 text-[9px] text-[#8a959b]">{row.model}</p></div><p className="text-[10px] text-[#718088]">{row.inputTokens} entrada · {row.outputTokens} saída</p><p className="text-right text-[9px] text-[#8a959b]">{formatDateTime(row.createdAt)}</p></div>)}</div></section>
      <aside className="space-y-5"><section className="rounded-[22px] bg-[#193848] p-6 text-white"><div className="flex items-center gap-3"><Sparkles className="text-[#f1c865]" size={19}/><h2 className="text-base font-semibold">Orçamento mensal</h2></div><p className="mt-4 text-3xl font-semibold">US$ {cost.toFixed(2).replace(".",",")} <span className="text-sm font-normal text-white/45">/ {budget?budget.toFixed(2).replace(".",","):"não definido"}</span></p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#f1c865]" style={{width:`${percentage}%`}}/></div><p className="mt-3 text-[10px] leading-4 text-white/50">{budget>0?`${Math.round(percentage)}% do teto configurado. Ao atingir 100%, novas chamadas serão pausadas.`:"Defina OPENAI_MONTHLY_BUDGET_USD para liberar chamadas reais."}</p></section><section className="rounded-[22px] border border-[#cfe4dc] bg-[#edf7f3] p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#3f8b6d]" size={18}/><div><p className="text-xs font-bold text-[#355e50]">Claims protegidos</p><p className="mt-1 text-[10px] leading-4 text-[#688178]">A IA não altera afirmações comerciais, preços ou prazos automaticamente.</p></div></div></section></aside>
    </div>
  </>;
}
