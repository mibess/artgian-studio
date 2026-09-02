import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  ChevronRight,
  Clock3,
  MessageCircle,
  MoreHorizontal,
  MoveUpRight,
  PackageCheck,
  RefreshCcw,
  Target,
  UserRoundCheck,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { getBusinessConfig } from "../../src/config/business";
import { getDashboardData } from "../../src/db/commercial";
import { JOB_TYPE_LABELS, PIPELINE_LABELS, type ConsumerPipelineStage } from "../../src/features/leads/domain";

const formatBrl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const formatDate = () => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
const initials = (name: string | null, username: string) => (name || username).split(/[\s._-]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const avatarColors = ["bg-[#f2c86b] text-[#46330d]", "bg-[#aed8cf] text-[#173f39]", "bg-[#e9a994] text-[#5c2113]", "bg-[#b9c9eb] text-[#25365c]", "bg-[#d8bfd8] text-[#4f2c50]"];

export default async function CommercialDashboard() {
  const [business, data] = await Promise.all([getBusinessConfig(), getDashboardData()]);
  const interested = data.leads.filter((lead) => !["discovered", "qualified", "contacted", "closed"].includes(lead.pipelineStage)).length;
  const handoffs = data.leads.filter((lead) => lead.whatsappHandoffAt).length;
  const confirmedValue = data.orders.reduce((sum, order) => sum + order.amountCents, 0);
  const conversion = data.leads.length ? (data.orders.length / data.leads.length) * 100 : 0;
  const today = new Date();
  const activityDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const responses = data.leads.filter((lead) => lead.lastContactAt?.slice(0, 10) === key).length;
    const interests = data.leads.filter((lead) => lead.updatedAt.slice(0, 10) === key && !["discovered", "qualified", "contacted", "closed"].includes(lead.pipelineStage)).length;
    return { label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""), responses, interests };
  });
  const activityMax = Math.max(1, ...activityDays.flatMap((day) => [day.responses, day.interests]));
  const pipelineGroups: Array<{ title: string; stages: ConsumerPipelineStage[]; color: string }> = [
    { title: "Novas oportunidades", stages: ["discovered", "qualified", "contacted"], color: "#9fb8c3" },
    { title: "Em conversa", stages: ["replied", "interest_identified", "requirements_collection"], color: "#f2c86b" },
    { title: "Em negociação", stages: ["quote_requested", "whatsapp_handoff", "quote_sent", "order_pending"], color: "#ee8d70" },
    { title: "Convertidos", stages: ["order_confirmed"], color: "#79b99f" },
  ];
  const topLeads = data.leads.filter((lead) => lead.pipelineStage !== "order_confirmed").slice(0, 4);
  const topLead = topLeads[0];
  const topBriefing = data.briefings.find((briefing) => briefing.leadId === topLead?.id);
  const knownSignals = [
    topBriefing?.referenceDescription ? "referência" : null,
    topBriefing?.quantity ? "quantidade" : null,
    topBriefing?.desiredDeadline ? "prazo desejado" : null,
    topBriefing?.customizationText ? "personalização" : null,
  ].filter(Boolean) as string[];
  const radarTitle = topLead
    ? knownSignals.length
      ? `${topLead.name?.split(" ")[0] || `@${topLead.instagramUsername}`} já informou ${new Intl.ListFormat("pt-BR").format(knownSignals)}.`
      : `${topLead.name?.split(" ")[0] || `@${topLead.instagramUsername}`} tem uma conversa ativa aguardando o próximo passo.`
    : "Nenhuma oportunidade ativa no momento.";
  const radarDescription = topLead
    ? topBriefing?.needsProductionReview
      ? "A próxima ação segura é validar a viabilidade e completar o briefing antes de confirmar prazo ou orçamento."
      : "Use os dados registrados no briefing para avançar sem repetir perguntas já respondidas."
    : "Novas mensagens inbound aparecerão aqui quando forem recebidas pelo Instagram.";
  const nextActions = data.jobs
    .filter((job) => ["pending", "waiting_review", "dead_letter"].includes(job.status))
    .slice(0, 4)
    .map((job) => {
      let lead = null;
      try {
        const payload = JSON.parse(job.payload) as { leadId?: string };
        lead = data.leads.find((item) => item.id === payload.leadId) || null;
      } catch {
        lead = null;
      }
      return {
        job,
        lead,
        title: JOB_TYPE_LABELS[job.type] || "Automação interna",
        detail: lead?.name || (lead ? `@${lead.instagramUsername}` : "Registro operacional"),
        time: job.status === "waiting_review" ? "Revisar" : job.status === "dead_letter" ? "Falha" : "Pendente",
      };
    });

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#71808a]">
            <CalendarDays size={13} /><span className="capitalize">{formatDate()}</span>
          </div>
          <h1 className="text-[clamp(1.8rem,3vw,2.6rem)] font-semibold leading-tight tracking-[-0.04em] text-[#173244]">Olá, {business.owner.name.split(" ")[0]}.</h1>
          <p className="mt-1 text-sm text-[#6f7e86]">Aqui está o pulso comercial da {business.company.name} hoje.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d9dedb] bg-white px-3.5 py-2 text-xs font-semibold text-[#48606c] shadow-sm"><span className="size-2 rounded-full bg-[#69b894] shadow-[0_0_0_4px_rgba(105,184,148,.13)]" />Inbound monitorado</span>
          <button aria-label="Atualizar painel" className="grid size-9 place-items-center rounded-full border border-[#d9dedb] bg-white text-[#6c7b83] shadow-sm"><RefreshCcw size={14} /></button>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[24px] bg-[#193848] px-6 py-6 text-white shadow-[0_16px_50px_rgba(25,56,72,.12)] sm:px-8 sm:py-7">
        <div className="absolute -right-20 -top-24 size-72 rounded-full border-[42px] border-[#f1c865]/10" />
        <div className="absolute bottom-5 right-12 hidden grid-cols-5 gap-2 opacity-30 sm:grid">{Array.from({ length: 20 }).map((_, index) => <span className="size-1 rounded-full bg-[#f1c865]" key={index} />)}</div>
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#f1c865]"><WandSparkles size={14} /> Radar de oportunidades</div>
            <h2 className="max-w-2xl text-xl font-semibold tracking-[-0.025em] sm:text-2xl">{radarTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">{radarDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {topLead&&<Link href={`/comercial/leads/${topLead.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#f1c865] px-4 py-3 text-xs font-bold text-[#193244] transition hover:-translate-y-0.5">Ver oportunidade <ArrowRight size={15} /></Link>}
            <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/65"><strong className="text-white">Score {topLead?.score || 0}</strong> · {topLead&&topLead.score>=70?"prioridade alta":topLead?"acompanhar":"sem dados"}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Oportunidades ativas", value: data.leads.filter((lead) => !["closed", "order_confirmed"].includes(lead.pipelineStage)).length, detail: `${data.leads.filter((lead) => today.getTime() - new Date(lead.createdAt).getTime() <= 7 * 86_400_000).length} em 7 dias`, icon: UsersRound, accent: "bg-[#dbe9e6] text-[#2e7160]" },
          { label: "Interesse real", value: interested, detail: `${data.leads.length?Math.round((interested / data.leads.length) * 100):0}% dos contatos`, icon: Target, accent: "bg-[#fff0c9] text-[#8b6718]" },
          { label: "Handoffs qualificados", value: handoffs, detail: "WhatsApp pendente", icon: MessageCircle, accent: "bg-[#f8ded5] text-[#a24d36]" },
          { label: "Pedidos confirmados", value: formatBrl(confirmedValue), detail: `${conversion.toFixed(1).replace(".", ",")}% de conversão`, icon: PackageCheck, accent: "bg-[#dce5f5] text-[#425d91]" },
        ].map((metric) => {
          const Icon = metric.icon;
          return <article key={metric.label} className="rounded-[20px] border border-[#e2e2dc] bg-white p-5 shadow-[0_8px_28px_rgba(32,52,60,.045)]">
            <div className="flex items-start justify-between"><span className={`grid size-10 place-items-center rounded-[13px] ${metric.accent}`}><Icon size={18} /></span><span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5c9a7c]"><MoveUpRight size={12} /> Atual</span></div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#849098]">{metric.label}</p>
            <div className="mt-1 flex items-end justify-between gap-3"><strong className="text-2xl font-semibold tracking-[-0.04em] text-[#173244]">{metric.value}</strong><span className="pb-1 text-[10px] text-[#8a959b]">{metric.detail}</span></div>
          </article>;
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_.9fr]">
        <section className="rounded-[22px] border border-[#e2e2dc] bg-white p-5 shadow-[0_8px_28px_rgba(32,52,60,.04)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b979d]">Movimento comercial</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Intenção vale mais que volume</h2></div>
            <div className="flex rounded-lg bg-[#f3f1eb] p-1 text-[10px] font-bold text-[#71808a]"><span className="rounded-md bg-white px-2.5 py-1.5 shadow-sm">7 dias</span><span className="px-2.5 py-1.5">30 dias</span></div>
          </div>
          <div className="mt-7 grid h-44 grid-cols-7 items-end gap-3 border-b border-[#e7e8e3] px-2 sm:gap-5">
            {activityDays.map((day)=><div className="group flex h-full items-end justify-center gap-1" key={day.label}><span className="w-2.5 rounded-t-full bg-[#d8e2e4] transition group-hover:bg-[#bdcfd4] sm:w-4" style={{height:`${day.responses ? Math.max(14, day.responses / activityMax * 90) : 4}%`}}/><span className="w-2.5 rounded-t-full bg-[#ee8669] transition group-hover:bg-[#e36f50] sm:w-4" style={{height:`${day.interests ? Math.max(14, day.interests / activityMax * 90) : 4}%`}}/></div>)}
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-[9px] font-medium uppercase text-[#9aa3a7]">{activityDays.map(day=><span key={day.label}>{day.label}</span>)}</div>
          <div className="mt-5 flex flex-wrap gap-5 text-[10px] text-[#6f7e86]"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#d8e2e4]"/>Respostas</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#ee8669]"/>Interesses reais</span><span className="ml-auto font-semibold text-[#4c6470]">Prioridade: conversas que avançam</span></div>
        </section>

        <section className="rounded-[22px] border border-[#e2e2dc] bg-white p-5 shadow-[0_8px_28px_rgba(32,52,60,.04)] sm:p-6">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b979d]">Próximas ações</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Fila inteligente</h2></div><Link href="/comercial/jobs" className="text-[10px] font-bold text-[#d96245]">Ver todas</Link></div>
          <div className="mt-4 divide-y divide-[#ecece7]">
            {nextActions.map((item)=>{const Icon=item.job.type==="execute_followup"?Clock3:item.job.status==="dead_letter"?UserRoundCheck:MessageCircle;const color=item.job.status==="dead_letter"?"bg-[#f8ded5] text-[#a24d36]":item.job.type==="execute_followup"?"bg-[#dce5f5] text-[#425d91]":"bg-[#dbe9e6] text-[#2e7160]";return <div className="flex items-center gap-3 py-3.5" key={item.job.id}><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${color}`}><Icon size={16}/></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#264252]">{item.title}</p><p className="mt-0.5 truncate text-[10px] text-[#8a959b]">{item.detail}</p></div><span className="text-[9px] font-bold uppercase tracking-wide text-[#9aa3a7]">{item.time}</span></div>})}
            {!nextActions.length&&<p className="py-8 text-center text-[10px] text-[#99a2a6]">Nenhuma ação pendente.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-[22px] border border-[#e2e2dc] bg-white p-5 shadow-[0_8px_28px_rgba(32,52,60,.04)] sm:p-6">
        <div className="mb-5 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b979d]">Funil de consumidores</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Oportunidades em movimento</h2></div><Link href="/comercial/funil" className="flex items-center gap-1 text-[10px] font-bold text-[#d96245]">Abrir kanban <ChevronRight size={13}/></Link></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pipelineGroups.map((group) => {
            const groupLeads=data.leads.filter(lead=>group.stages.includes(lead.pipelineStage as ConsumerPipelineStage));
            return <div className="rounded-[17px] bg-[#f6f5f0] p-3.5" key={group.title}><div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{backgroundColor:group.color}}/><h3 className="text-[11px] font-bold text-[#425966]">{group.title}</h3></div><span className="grid size-6 place-items-center rounded-full bg-white text-[10px] font-bold text-[#657780]">{groupLeads.length}</span></div><div className="mt-3 space-y-2">{groupLeads.slice(0,2).map((lead,index)=><Link href={`/comercial/leads/${lead.id}`} key={lead.id} className="block rounded-[14px] border border-[#e5e5de] bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center gap-2.5"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-[9px] font-extrabold ${avatarColors[index%avatarColors.length]}`}>{initials(lead.name,lead.instagramUsername)}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#294653]">{lead.name||`@${lead.instagramUsername}`}</p><p className="truncate text-[9px] text-[#8b969b]">{lead.productInterest||PIPELINE_LABELS[lead.pipelineStage as ConsumerPipelineStage]}</p></div><span className="text-[10px] font-extrabold text-[#d96245]">{lead.score}</span></div></Link>)}{groupLeads.length===0&&<div className="rounded-[14px] border border-dashed border-[#d8d9d2] px-3 py-6 text-center text-[10px] text-[#99a2a6]">Nenhuma oportunidade</div>}</div></div>;
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[22px] border border-[#e2e2dc] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b979d]">Oportunidades prioritárias</p><h2 className="mt-1 text-lg font-semibold">Onde vale colocar atenção</h2></div><MoreHorizontal className="text-[#9aa3a7]" size={18}/></div>
          <div className="mt-4 divide-y divide-[#ecece7]">{topLeads.map((lead,index)=><Link href={`/comercial/leads/${lead.id}`} key={lead.id} className="flex items-center gap-3 py-3.5"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${avatarColors[index%avatarColors.length]}`}>{initials(lead.name,lead.instagramUsername)}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#294653]">{lead.name}</p><p className="truncate text-[10px] text-[#8b969b]">@{lead.instagramUsername} · {lead.productInterest}</p></div><span className="hidden rounded-full bg-[#f6f1e6] px-2.5 py-1 text-[9px] font-bold text-[#816726] sm:inline">{PIPELINE_LABELS[lead.pipelineStage as ConsumerPipelineStage]}</span><span className="w-7 text-right text-xs font-extrabold text-[#d96245]">{lead.score}</span><ChevronRight size={13} className="text-[#a3abad]"/></Link>)}</div>
        </div>
        <div className="rounded-[22px] bg-[#e56e50] p-6 text-white shadow-[0_14px_38px_rgba(229,110,80,.16)]">
          <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-[13px] bg-white/14"><Bot size={19}/></span><span className="rounded-full bg-white/13 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em]">Aprendizado ativo</span></div>
          <h2 className="mt-6 text-xl font-semibold tracking-[-0.03em]">Aprendizado ainda inicial</h2>
          <p className="mt-2 text-sm leading-6 text-white/72">Há {data.orders.length} {data.orders.length === 1 ? "conversão atribuída" : "conversões atribuídas"}. O sistema já registra origem, categoria e ocasião, mas não generaliza com uma amostra pequena.</p>
          <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-semibold">{data.orders.length}</p><p className="mt-1 text-[9px] uppercase tracking-wide text-white/55">pedidos observados</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-semibold">0</p><p className="mt-1 text-[9px] uppercase tracking-wide text-white/55">claims alterados</p></div></div>
          <Link href="/comercial/ia" className="mt-5 inline-flex items-center gap-2 text-xs font-bold">Ver decisões da IA <ArrowRight size={14}/></Link>
        </div>
      </section>
    </div>
  );
}
