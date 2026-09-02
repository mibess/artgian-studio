import Link from "next/link";
import { Filter, Search, SlidersHorizontal, UserPlus } from "lucide-react";
import { getLeads } from "../../../src/db/commercial";
import { PIPELINE_LABELS } from "../../../src/features/leads/domain";
import { Avatar, PageHeader, StatusBadge, formatBrl, formatDateTime } from "../_components";

type LeadsPageProps = { searchParams: Promise<{ busca?: string; etapa?: string }> };

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const allLeads = await getLeads();
  const query = (params.busca || "").toLocaleLowerCase("pt-BR");
  const filtered = allLeads.filter((lead) => {
    const matchesQuery = !query || `${lead.name} ${lead.instagramUsername} ${lead.productInterest} ${lead.segment}`.toLocaleLowerCase("pt-BR").includes(query);
    const matchesStage = !params.etapa || params.etapa === "all" || lead.pipelineStage === params.etapa;
    return matchesQuery && matchesStage;
  });

  return <>
    <PageHeader eyebrow="Relacionamento" title="Leads" description="Priorize intenção real, acompanhe a origem e mantenha cada conversa no contexto certo." action={<Link href="/comercial/conversas" className="inline-flex items-center gap-2 rounded-xl bg-[#173244] px-4 py-3 text-xs font-bold text-white"><UserPlus size={15}/> Entrada manual</Link>} />
    <section className="rounded-[22px] border border-[#e1e1db] bg-white shadow-[0_8px_28px_rgba(32,52,60,.04)]">
      <form className="flex flex-col gap-3 border-b border-[#ecece7] p-4 sm:flex-row sm:items-center" method="get">
        <label className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#95a0a5]" size={15}/><input name="busca" defaultValue={params.busca} placeholder="Buscar por nome, @perfil, produto ou segmento" className="h-11 w-full rounded-xl border border-[#dfe2de] bg-[#faf9f6] pl-10 pr-4 text-xs outline-none transition focus:border-[#e07a5f] focus:bg-white"/></label>
        <label className="relative"><Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#95a0a5]" size={14}/><select name="etapa" defaultValue={params.etapa || "all"} className="h-11 appearance-none rounded-xl border border-[#dfe2de] bg-[#faf9f6] pl-10 pr-9 text-xs font-semibold text-[#4f6570] outline-none"><option value="all">Todas as etapas</option>{Object.entries(PIPELINE_LABELS).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#e56e50] px-4 text-xs font-bold text-white" type="submit"><SlidersHorizontal size={14}/>Filtrar</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead><tr className="border-b border-[#ecece7] text-[9px] font-bold uppercase tracking-[0.13em] text-[#8e999e]"><th className="px-5 py-4">Contato</th><th className="px-4 py-4">Interesse</th><th className="px-4 py-4">Origem</th><th className="px-4 py-4">Etapa</th><th className="px-4 py-4">Score</th><th className="px-4 py-4">Último contato</th><th className="px-5 py-4 text-right">Potencial</th></tr></thead>
          <tbody className="divide-y divide-[#efefea]">{filtered.map((lead,index)=><tr className="group transition hover:bg-[#faf9f6]" key={lead.id}>
            <td className="px-5 py-4"><Link href={`/comercial/leads/${lead.id}`} className="flex items-center gap-3"><Avatar name={lead.name} username={lead.instagramUsername} index={index}/><span><span className="block text-xs font-bold text-[#294653] group-hover:text-[#d96245]">{lead.name || `@${lead.instagramUsername}`}</span><span className="mt-0.5 block text-[10px] text-[#8a959b]">@{lead.instagramUsername}</span></span></Link></td>
            <td className="px-4 py-4"><span className="block max-w-[190px] truncate text-xs font-semibold text-[#425966]">{lead.productInterest || "Ainda não identificado"}</span><span className="mt-0.5 block text-[10px] text-[#9aa3a7]">{lead.segment || "Sem segmento"}</span></td>
            <td className="px-4 py-4 text-[11px] text-[#657780]">{lead.source}</td>
            <td className="px-4 py-4"><StatusBadge status={lead.pipelineStage}/></td>
            <td className="px-4 py-4"><div className="flex items-center gap-2"><strong className="w-7 text-xs text-[#d96245]">{lead.score}</strong><span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#eceeea]"><span className="block h-full rounded-full bg-[#e8795d]" style={{width:`${lead.score}%`}}/></span></div></td>
            <td className="px-4 py-4 text-[10px] text-[#7e8b91]">{formatDateTime(lead.lastContactAt)}</td>
            <td className="px-5 py-4 text-right text-xs font-bold text-[#415967]">{formatBrl(lead.confirmedOrderValueCents || lead.estimatedOrderValueCents)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="flex items-center justify-between border-t border-[#ecece7] px-5 py-4 text-[10px] text-[#889398]"><span>{filtered.length} de {allLeads.length} leads</span><span>Ordenados por prioridade comercial</span></footer>
    </section>
  </>;
}
