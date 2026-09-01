import { AtSign as Instagram, PauseCircle, Radio, ShieldOff, Target } from "lucide-react";
import { getOperationsData } from "../../../src/db/commercial";
import { EmptyState, PageHeader, StatusBadge, formatDateTime } from "../_components";

export default async function CampaignsPage() {
  const { campaigns } = await getOperationsData();
  return <>
    <PageHeader eyebrow="Origem e estratégia" title="Campanhas" description="Acompanhe a origem das oportunidades sem otimizar para volume de mensagens." action={<span className="inline-flex items-center gap-2 rounded-full bg-[#fff0c9] px-3 py-2 text-[9px] font-bold text-[#846214]"><ShieldOff size={13}/>Outbound desativado</span>}/>
    {!campaigns.length?<EmptyState title="Nenhuma campanha" description="Campanhas futuras poderão organizar origem, segmento e abordagem."/>:<div className="grid gap-4 lg:grid-cols-2">{campaigns.map((campaign,index)=><article className="rounded-[22px] border border-[#e1e1db] bg-white p-5" key={campaign.id}><div className="flex items-start justify-between"><span className={`grid size-10 place-items-center rounded-[13px] ${index%2?"bg-[#fff0c9] text-[#8b6718]":"bg-[#dce8f6] text-[#425d91]"}`}>{campaign.source==="Instagram"?<Instagram size={18}/>:<Target size={18}/>}</span><StatusBadge status={campaign.status}/></div><h2 className="mt-5 text-base font-semibold text-[#294653]">{campaign.name}</h2><p className="mt-1 text-[10px] text-[#859197]">{campaign.source} · {campaign.segment||"Sem segmento"}</p><div className="mt-5 flex items-center justify-between border-t border-[#eeeae3] pt-4"><span className="flex items-center gap-1.5 text-[9px] text-[#8a959b]">{campaign.status==="active"?<Radio size={11}/>:<PauseCircle size={11}/>}Atualizado {formatDateTime(campaign.updatedAt)}</span><span className={`text-[9px] font-bold ${campaign.outboundEnabled?"text-[#b74a31]":"text-[#5c9a7c]"}`}>Outbound {campaign.outboundEnabled?"ativo":"bloqueado"}</span></div></article>)}</div>}
  </>;
}
