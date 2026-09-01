import Link from "next/link";
import { MessageCircleWarning, ShieldQuestion } from "lucide-react";
import { getOperationsData } from "../../../src/db/commercial";
import { PageHeader, StatusBadge, formatDateTime } from "../_components";

export default async function ExceptionsPage() {
  const { exceptions } = await getOperationsData();
  return <>
    <PageHeader eyebrow="Controle humano" title="Revisão humana" description="Dúvidas técnicas, negociações, informação ausente e situações sensíveis ficam visíveis antes de qualquer resposta." action={<span className="grid size-10 place-items-center rounded-full bg-[#f8ddd7] text-sm font-extrabold text-[#9c4031]">{exceptions.filter(e=>e.status==="open").length}</span>}/>
    <div className="space-y-4">{exceptions.map((item,index)=><article className="rounded-[22px] border border-[#e1e1db] bg-white p-5 sm:p-6" key={item.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><span className={`grid size-11 shrink-0 place-items-center rounded-[14px] ${item.severity==="high"?"bg-[#f8ddd7] text-[#9c4031]":"bg-[#fff0c9] text-[#8b6718]"}`}>{index%2?<ShieldQuestion size={19}/>:<MessageCircleWarning size={19}/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-[#294653]">{item.title}</h2><StatusBadge status={item.status}/><span className="text-[8px] font-bold uppercase tracking-wide text-[#9aa3a7]">{item.severity==="high"?"Alta":"Média"}</span></div><p className="mt-2 text-[11px] leading-5 text-[#718088]">{item.description}</p><p className="mt-3 text-[9px] text-[#9aa3a7]">Aberto em {formatDateTime(item.createdAt)}</p></div>{item.leadId&&<Link href={`/comercial/leads/${item.leadId}`} className="rounded-xl bg-[#193848] px-4 py-2.5 text-center text-[10px] font-bold text-white">Revisar conversa</Link>}</div></article>)}</div>
  </>;
}
