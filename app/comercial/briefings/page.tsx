import Link from "next/link";
import { CalendarClock, CheckCircle2, MapPin, Package, Palette, UserRound } from "lucide-react";
import { getBriefingsOverview } from "../../../src/db/commercial";
import { Avatar, EmptyState, PageHeader, StatusBadge, formatDateTime } from "../_components";

export default async function BriefingsPage() {
  const rows = await getBriefingsOverview();
  return <>
    <PageHeader eyebrow="Personalização" title="Briefings" description="Informações construídas gradualmente a partir da conversa, sem transformar o atendimento em interrogatório." />
    {!rows.length?<EmptyState title="Nenhum briefing ainda" description="Os briefings aparecem quando uma conversa traz detalhes úteis para personalização ou orçamento."/>:<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{rows.map(({briefing,lead},index)=><Link href={`/comercial/leads/${lead.id}`} key={briefing.id} className="group rounded-[22px] border border-[#e1e1db] bg-white p-5 shadow-[0_8px_28px_rgba(32,52,60,.04)] transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3"><Avatar name={lead.name} username={lead.instagramUsername} index={index}/><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#294653]">{lead.name}</p><p className="mt-0.5 truncate text-[10px] text-[#8a959b]">@{lead.instagramUsername}</p></div><StatusBadge status={briefing.status}/></div>
      <div className="mt-5 rounded-[16px] bg-[#f7f5ee] p-4"><div className="flex items-center gap-2"><Package className="text-[#d96245]" size={15}/><p className="text-xs font-bold text-[#415967]">{briefing.productInterest || lead.productInterest || "Ideia personalizada"}</p></div><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#7d8a90]">{briefing.referenceDescription || briefing.additionalNotes || "Detalhes sendo coletados conforme a conversa."}</p></div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-[9px] text-[#718088]"><span className="flex items-center gap-1.5"><UserRound size={12}/>{briefing.recipient || "Destinatário pendente"}</span><span className="flex items-center gap-1.5"><Palette size={12}/>{briefing.customizationText || briefing.preferredColors || "Personalização pendente"}</span><span className="flex items-center gap-1.5"><CalendarClock size={12}/>{briefing.desiredDeadline || "Prazo pendente"}</span><span className="flex items-center gap-1.5"><MapPin size={12}/>{[briefing.city,briefing.state].filter(Boolean).join("/") || "Local pendente"}</span></div>
      <div className="mt-4 flex items-center justify-between border-t border-[#eeeae3] pt-3"><span className="text-[9px] text-[#9aa3a7]">Atualizado {formatDateTime(briefing.updatedAt)}</span><span className="flex items-center gap-1 text-[9px] font-bold text-[#d96245]"><CheckCircle2 size={12}/>{briefing.needsQuote?"Precisa de orçamento":"Preço validado"}</span></div>
    </Link>)}</div>}
  </>;
}
