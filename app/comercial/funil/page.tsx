import Link from "next/link";
import { Clock3, MessageCircle, MoreHorizontal } from "lucide-react";
import { getLeads } from "../../../src/db/commercial";
import { PIPELINE_LABELS, type ConsumerPipelineStage } from "../../../src/features/leads/domain";
import { Avatar, PageHeader } from "../_components";

const columns: Array<{ title: string; stages: ConsumerPipelineStage[]; dot: string }> = [
  { title: "Entrada", stages: ["discovered", "qualified", "contacted"], dot: "bg-[#9fb8c3]" },
  { title: "Conversa", stages: ["replied", "interest_identified"], dot: "bg-[#efc568]" },
  { title: "Entendimento", stages: ["requirements_collection"], dot: "bg-[#e9a17f]" },
  { title: "Negociação", stages: ["quote_requested", "whatsapp_handoff", "quote_sent", "order_pending"], dot: "bg-[#e46e51]" },
  { title: "Convertido", stages: ["order_confirmed"], dot: "bg-[#73b294]" },
];

export default async function FunnelPage() {
  const leadRows = await getLeads();
  return <>
    <PageHeader eyebrow="Pipeline visual" title="Funil de consumidores" description="Uma visão do avanço comercial — separada do estado técnico de cada canal." action={<span className="rounded-full border border-[#dcded9] bg-white px-3 py-2 text-[10px] font-bold text-[#61747e]">{leadRows.filter(l=>l.pipelineStage!=="closed").length} oportunidades ativas</span>}/>
    <div className="commercial-scrollbar overflow-x-auto pb-4"><div className="grid min-w-[1320px] grid-cols-5 gap-3">
      {columns.map((column)=><section className="rounded-[20px] bg-[#ebeae4] p-3" key={column.title}>
        <header className="flex items-center justify-between px-1 py-2"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${column.dot}`}/><h2 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#425966]">{column.title}</h2></div><span className="grid size-6 place-items-center rounded-full bg-white text-[10px] font-bold text-[#657780]">{leadRows.filter(lead=>column.stages.includes(lead.pipelineStage as ConsumerPipelineStage)).length}</span></header>
        <div className="mt-2 space-y-3">{leadRows.filter(lead=>column.stages.includes(lead.pipelineStage as ConsumerPipelineStage)).map((lead,index)=><Link href={`/comercial/leads/${lead.id}`} key={lead.id} className="block rounded-[17px] border border-[#dedfd9] bg-white p-4 shadow-[0_5px_14px_rgba(30,50,58,.04)] transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start gap-3"><Avatar name={lead.name} username={lead.instagramUsername} index={index} size="sm"/><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#294653]">{lead.name}</p><p className="mt-0.5 truncate text-[9px] text-[#8a959b]">@{lead.instagramUsername}</p></div><MoreHorizontal size={14} className="text-[#a0a9ac]"/></div>
          <p className="mt-3 line-clamp-2 text-[11px] font-semibold leading-4 text-[#526873]">{lead.productInterest || "Interesse ainda não identificado"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{JSON.parse(lead.tags).slice(0,2).map((tag:string)=><span className="rounded-full bg-[#f5f2e9] px-2 py-1 text-[8px] font-semibold text-[#7c6a3a]" key={tag}>{tag}</span>)}</div>
          <div className="mt-4 flex items-center justify-between border-t border-[#eeeae3] pt-3"><span className="flex items-center gap-1 text-[8px] font-semibold text-[#8d989c]"><Clock3 size={10}/>{PIPELINE_LABELS[lead.pipelineStage as ConsumerPipelineStage]}</span><span className="flex items-center gap-1 text-[10px] font-extrabold text-[#d96245]"><MessageCircle size={11}/>{lead.score}</span></div>
        </Link>)}</div>
      </section>)}
    </div></div>
  </>;
}
