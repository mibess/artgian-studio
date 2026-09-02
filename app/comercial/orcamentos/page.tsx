import { CircleDollarSign, Clock3, FileQuestion, Send } from "lucide-react";
import { getQuotesOverview } from "../../../src/db/commercial";
import { Avatar, EmptyState, LeadLink, PageHeader, StatusBadge, formatBrl, formatDateTime } from "../_components";

export default async function QuotesPage() {
  const rows = await getQuotesOverview();
  const total = rows.reduce((sum,row)=>sum+(row.quote.amountCents||0),0);
  return <>
    <PageHeader eyebrow="Negociação" title="Orçamentos" description="Solicitações e valores registrados pelo operador. A IA nunca estima preço sem uma fonte cadastrada." />
    <div className="mb-5 grid gap-4 sm:grid-cols-3">{[
      {label:"Solicitados",value:rows.filter(r=>r.quote.status==="requested").length,icon:FileQuestion,color:"bg-[#fff0c9] text-[#8b6718]"},
      {label:"Enviados ou aceitos",value:rows.filter(r=>["sent","accepted"].includes(r.quote.status)).length,icon:Send,color:"bg-[#dce8f6] text-[#425d91]"},
      {label:"Valor em propostas",value:formatBrl(total),icon:CircleDollarSign,color:"bg-[#d8ede4] text-[#2b7258]"},
    ].map(item=>{const Icon=item.icon;return <div className="rounded-[20px] border border-[#e1e1db] bg-white p-5" key={item.label}><span className={`grid size-9 place-items-center rounded-xl ${item.color}`}><Icon size={16}/></span><p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-[#8b979d]">{item.label}</p><p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{item.value}</p></div>})}</div>
    {!rows.length?<EmptyState title="Nenhum orçamento" description="Quando um lead solicitar valor, o pedido de orçamento aparecerá aqui para análise humana."/>:<section className="overflow-hidden rounded-[22px] border border-[#e1e1db] bg-white"><div className="divide-y divide-[#efefea]">{rows.map(({quote,lead},index)=><article className="grid gap-4 p-5 sm:grid-cols-[1.3fr_.8fr_.7fr_auto] sm:items-center" key={quote.id}><div className="flex items-center gap-3"><Avatar name={lead.name} username={lead.instagramUsername} index={index}/><div><p className="text-xs font-bold text-[#294653]">{lead.name}</p><p className="mt-0.5 text-[10px] text-[#8a959b]">{lead.productInterest||"Produto sob análise"}</p></div></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-[#9aa3a7]">Valor</p><p className="mt-1 text-sm font-semibold text-[#415967]">{formatBrl(quote.amountCents)}</p></div><div><StatusBadge status={quote.status}/><p className="mt-1.5 flex items-center gap-1 text-[9px] text-[#9aa3a7]"><Clock3 size={10}/>{formatDateTime(quote.updatedAt)}</p></div><LeadLink id={lead.id}>Abrir</LeadLink></article>)}</div></section>}
  </>;
}
