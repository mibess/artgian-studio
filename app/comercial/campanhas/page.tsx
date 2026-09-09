import Link from "next/link";
import {
  AtSign as Instagram,
  Bot,
  Building2,
  CalendarSearch,
  ExternalLink,
  PauseCircle,
  Play,
  Radio,
  Search,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Target,
  UserPlus,
} from "lucide-react";
import { SubmitButton } from "../../components/PendingButton";
import { getOperationsData, getOutboundProspects } from "../../../src/db/commercial";
import {
  normalizeDiscoveryStrategy,
  parseInstagramBaseProfiles,
  parseStoredDiscoveryTerms,
} from "../../../src/features/outbound/discovery-domain";
import { OUTBOUND_PIPELINE_LABELS } from "../../../src/features/outbound/domain";
import { EmptyState, PageHeader, StatusBadge, formatDateTime } from "../_components";
import {
  addOutboundProspect,
  createCampaign,
  prepareOutboundProspectDraft,
  queueCampaignDiscoveryNow,
  queueOutboundFirstContact,
  saveOutboundProspectDraft,
  setCampaignDiscoveryEnabled,
  setOutboundCampaignEnabled,
} from "../actions";
import { DiscoverySettingsForm } from "./DiscoverySettingsForm";

type SearchParams = {
  salvo?: string;
  erro?: string;
  prospecto?: string;
  rascunho?: string;
  revisado?: string;
  campanha?: string;
  agendado?: string;
  descoberta?: string;
  busca?: string;
};

const policyLabels: Record<string, string> = {
  inbound_window: "DM inbound dentro de 24h",
  manual_only: "Primeiro contato somente manual",
  comment_private_reply: "Resposta privada a comentário",
};

const strategyLabels = {
  instagram_search: "Termos no Instagram",
  instagram_followers: "Seguidores de perfis-base",
  local_business: "Empresas locais no Google Maps",
} as const;

function jobBelongsToCampaign(payload: string, campaignId: string) {
  try {
    return (JSON.parse(payload) as { campaignId?: string }).campaignId === campaignId;
  } catch {
    return false;
  }
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ campaigns, settings, jobs, discoveryRuns, discoveryQueryStats, localBusinessOpportunities }, prospects, params] = await Promise.all([
    getOperationsData(),
    getOutboundProspects(),
    searchParams,
  ]);
  const globallyReady =
    process.env.OUTBOUND_AUTOMATION_ENABLED === "true" &&
    process.env.BROWSER_SEND_ENABLED === "true" &&
    settings.automation_paused !== "true" &&
    settings.outbound_paused === "false";
  const discoveryPaused =
    settings.automation_paused === "true" || settings.discovery_paused === "true";
  const hasSuccess =
    params.salvo ||
    params.prospecto ||
    params.rascunho ||
    params.revisado ||
    params.campanha ||
    params.agendado ||
    params.descoberta ||
    params.busca;
  const successMessage = params.agendado
    ? "Primeiro contato colocado na fila do worker local."
    : params.busca
      ? "Busca segura agendada. Nenhuma mensagem será enviada."
      : params.descoberta
        ? "Configuração de descoberta salva. Nenhuma mensagem foi enviada."
        : "Alteração salva. Nenhuma mensagem externa foi enviada.";
  const reviewProspects = prospects.filter(
    ({ prospect }) => prospect.status !== "disqualified",
  );
  const reviewLocalBusinessOpportunities = localBusinessOpportunities.filter(
    (opportunity) => opportunity.status !== "instagram_found",
  );

  return (
    <>
      <PageHeader
        eyebrow="Origem e estratégia"
        title="Campanhas e prospecção"
        description="Descubra, qualifique e revise oportunidades antes de autorizar qualquer primeiro contato."
        action={
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[9px] font-bold ${
              globallyReady
                ? "bg-[#d8ede4] text-[#2b7258]"
                : "bg-[#fff0c9] text-[#846214]"
            }`}
          >
            {globallyReady ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
            {globallyReady ? "Liberação global ativa" : "Envio outbound bloqueado"}
          </span>
        }
      />
      {hasSuccess && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {successMessage}
        </p>
      )}
      {params.erro && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {params.erro}
        </p>
      )}

      <section className="mb-5 rounded-[22px] border border-[#d7e6df] bg-[#f2faf6] p-5">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 shrink-0 text-[#2f7c60]" size={18} />
          <div>
            <h2 className="text-sm font-bold text-[#294f40]">Descoberta segura e contato separado</h2>
            <p className="mt-1 max-w-4xl text-[10px] leading-5 text-[#5b756a]">
              Escolha entre termos no Instagram, seguidores de perfis-base ou empresas no Google Maps. O worker lê sinais públicos, elimina duplicados e grava tudo para revisão; descobrir uma oportunidade nunca envia DM.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section>
          {!campaigns.length ? (
            <EmptyState
              title="Nenhuma campanha"
              description="Crie uma campanha para organizar origem e segmento das oportunidades."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {campaigns.map((campaign, index) => (
                <article className="rounded-[22px] border border-[#e1e1db] bg-white p-5" key={campaign.id}>
                  <div className="flex items-start justify-between">
                    <span className={`grid size-10 place-items-center rounded-[13px] ${index % 2 ? "bg-[#fff0c9] text-[#8b6718]" : "bg-[#dce8f6] text-[#425d91]"}`}>
                      {campaign.source === "Instagram" ? <Instagram size={18} /> : <Target size={18} />}
                    </span>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <h2 className="mt-5 text-base font-semibold text-[#294653]">{campaign.name}</h2>
                  <p className="mt-1 text-[10px] text-[#859197]">{campaign.source} · {campaign.segment || "Sem segmento"}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-bold">
                    <span className="rounded-full bg-[#e8eef2] px-2.5 py-1 text-[#4e6977]">
                      {strategyLabels[normalizeDiscoveryStrategy(campaign.discoveryStrategy)]}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 ${campaign.discoveryEnabled ? "bg-[#d8ede4] text-[#2b7258]" : "bg-[#edf0ed] text-[#65746c]"}`}>
                      {campaign.discoveryEnabled ? "Busca automática ativa" : "Busca automática inativa"}
                    </span>
                    {campaign.lastDiscoveryAt && <span className="rounded-full bg-[#edf0ed] px-2.5 py-1 text-[#65746c]">Última busca {formatDateTime(campaign.lastDiscoveryAt)}</span>}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#eeeae3] pt-4">
                    <span className="flex items-center gap-1.5 text-[9px] text-[#8a959b]">
                      {campaign.status === "active" ? <Radio size={11} /> : <PauseCircle size={11} />}
                      Atualizado {formatDateTime(campaign.updatedAt)}
                    </span>
                    <form action={setOutboundCampaignEnabled}>
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <input type="hidden" name="enabled" value={campaign.outboundEnabled ? "false" : "true"} />
                      <SubmitButton pendingLabel="Alterando…" className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-bold disabled:opacity-60 ${campaign.outboundEnabled ? "bg-[#f8ddd7] text-[#9c4031]" : "bg-[#edf0ed] text-[#65746c]"}`}>
                        {campaign.outboundEnabled ? "Pausar outbound" : "Solicitar ativação"}
                      </SubmitButton>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-[22px] bg-[#193848] p-6 text-white">
          <h2 className="text-base font-semibold">Nova campanha</h2>
          <p className="mt-2 text-[10px] leading-4 text-white/55">O cadastro nasce como rascunho e sem autorização de envio.</p>
          <form action={createCampaign} className="mt-5 space-y-3">
            {[
              { name: "name", label: "Nome", placeholder: "Parcerias locais" },
              { name: "source", label: "Origem", placeholder: "Instagram" },
              { name: "segment", label: "Segmento", placeholder: "Arquitetura e decoração" },
            ].map((field) => (
              <label className="block" key={field.name}>
                <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-wide text-white/45">{field.label}</span>
                <input name={field.name} required={field.name !== "segment"} placeholder={field.placeholder} className="h-10 w-full rounded-xl border border-white/10 bg-white/8 px-3 text-xs text-white outline-none placeholder:text-white/25" />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-wide text-white/45">Funil</span>
                <select name="funnelType" className="h-10 w-full rounded-xl border border-white/10 bg-[#294c5c] px-3 text-xs text-white"><option value="consumer">Clientes</option><option value="partner">Parceiros</option></select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-wide text-white/45">Limite diário</span>
                <input name="dailyLimit" type="number" min="1" max="30" defaultValue="5" className="h-10 w-full rounded-xl border border-white/10 bg-white/8 px-3 text-xs text-white" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-wide text-white/45">Estratégia inicial</span>
              <select name="discoveryStrategy" defaultValue="instagram_search" className="h-10 w-full rounded-xl border border-white/10 bg-[#294c5c] px-3 text-xs text-white">
                <option value="instagram_search">Termos no Instagram</option>
                <option value="instagram_followers">Seguidores de perfis-base</option>
                <option value="local_business">Empresas locais no Google Maps</option>
              </select>
              <span className="mt-1.5 block text-[8px] leading-3 text-white/45">Depois de criar, complete os critérios no cartão da campanha.</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-wide text-white/45">Janela operacional</span>
              <input name="operatingHours" defaultValue="09:00-18:00" pattern="[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}" className="h-10 w-full rounded-xl border border-white/10 bg-white/8 px-3 text-xs text-white" />
            </label>
            <SubmitButton pendingLabel="Criando…" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f1c865] px-4 py-3 text-xs font-extrabold text-[#193848] disabled:opacity-60">Criar campanha segura</SubmitButton>
          </form>
        </aside>
      </div>

      <section className="mt-5 rounded-[22px] border border-[#d8e4df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2f7c60]">Motor de descoberta</p>
            <h2 className="mt-1 text-base font-semibold">Critérios e recorrência</h2>
            <p className="mt-1 max-w-3xl text-[10px] leading-5 text-[#7c8a90]">Cada campanha usa uma estratégia clara. Os campos mudam conforme a escolha e o motor evita rever recentemente os mesmos perfis ou estabelecimentos.</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[9px] font-bold ${discoveryPaused ? "bg-[#fff0c9] text-[#846214]" : "bg-[#d8ede4] text-[#2b7258]"}`}>
            <CalendarSearch size={13} />{discoveryPaused ? "Descoberta pausada" : "Descoberta liberada"}
          </span>
        </div>
        {!campaigns.length ? (
          <div className="mt-5"><EmptyState title="Crie uma campanha" description="Os critérios de descoberta são definidos por campanha." /></div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {campaigns.map((campaign) => {
              const latestRun = discoveryRuns.find((run) => run.campaignId === campaign.id);
              const campaignQueryStats = discoveryQueryStats
                .filter((item) => item.campaignId === campaign.id)
                .sort((left, right) => right.profilesCreated - left.profilesCreated || right.profilesQualified - left.profilesQualified)
                .slice(0, 3);
              const campaignDiscoveryJobs = jobs.filter(
                (job) =>
                  job.type === "discover_prospects" &&
                  ["pending", "running"].includes(job.status) &&
                  jobBelongsToCampaign(job.payload, campaign.id),
              );
              const running = campaignDiscoveryJobs.some(
                (job) => job.status === "running",
              );
              const nextPending = campaignDiscoveryJobs
                .filter((job) => job.status === "pending")
                .sort((left, right) =>
                  left.scheduledAt.localeCompare(right.scheduledAt),
                )[0];
              return (
                <article className="rounded-[18px] bg-[#f7f7f2] p-4 sm:p-5" key={campaign.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="text-sm font-bold text-[#294653]">{campaign.name}</h3><p className="mt-1 text-[9px] text-[#859197]">{running ? "Busca em execução" : nextPending ? `Próxima busca agendada para ${formatDateTime(nextPending.scheduledAt)}` : "Nenhuma busca pendente"}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${campaign.discoveryEnabled ? "bg-[#d8ede4] text-[#2b7258]" : "bg-[#e7e9e6] text-[#69756f]"}`}>{campaign.discoveryEnabled ? "Ativa" : "Inativa"}</span>
                  </div>
                  <DiscoverySettingsForm
                    campaignId={campaign.id}
                    enabled={campaign.discoveryEnabled}
                    strategy={normalizeDiscoveryStrategy(campaign.discoveryStrategy)}
                    keywords={parseStoredDiscoveryTerms(campaign.discoveryKeywords)}
                    hashtags={parseStoredDiscoveryTerms(campaign.discoveryHashtags)}
                    locations={parseStoredDiscoveryTerms(campaign.discoveryLocations)}
                    baseProfiles={parseInstagramBaseProfiles(parseStoredDiscoveryTerms(campaign.discoveryBaseProfiles).join("\n"))}
                    minimumBaseFollowers={campaign.discoveryMinimumBaseFollowers}
                    localNiche={campaign.discoveryLocalNiche || ""}
                    localLocation={campaign.discoveryLocalLocation || ""}
                    dailyLimit={campaign.discoveryDailyLimit}
                    minimumScore={campaign.discoveryMinimumScore}
                    intervalHours={campaign.discoveryIntervalHours}
                  />
                  <form action={setCampaignDiscoveryEnabled} className="mt-2">
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <input type="hidden" name="enabled" value={campaign.discoveryEnabled ? "false" : "true"} />
                    <SubmitButton pendingLabel="Alterando…" className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold text-white disabled:opacity-60 ${campaign.discoveryEnabled ? "bg-[#9c4031]" : "bg-[#2f7c60]"}`}>{campaign.discoveryEnabled ? "Desativar busca segura" : "Ativar busca segura"}</SubmitButton>
                  </form>
                  {campaign.discoveryEnabled && (
                    <form action={queueCampaignDiscoveryNow} className="mt-2">
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <SubmitButton disabled={running || discoveryPaused} pendingLabel="Agendando…" className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#bdd6ca] bg-white px-4 py-2.5 text-[10px] font-bold text-[#2f7c60] disabled:opacity-40"><Play size={12} />Buscar agora</SubmitButton>
                    </form>
                  )}
                  {latestRun && <div className="mt-3 rounded-xl bg-white px-3 py-2 text-[9px] leading-4 text-[#6d7c82]"><strong className="text-[#415967]">Última execução:</strong> {latestRun.status === "completed" ? `${latestRun.profilesCreated} perfis e ${latestRun.websiteOpportunitiesCreated} oportunidades de site, em ${latestRun.profilesInspected} analisados` : latestRun.status === "failed" ? `falhou — ${latestRun.error || "verifique o worker"}` : "em andamento"}.</div>}
                  {campaignQueryStats.length > 0 && (
                    <div className="mt-3 rounded-xl bg-white px-3 py-2 text-[9px] leading-4 text-[#6d7c82]">
                      <strong className="text-[#415967]">Desempenho dos critérios</strong>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {campaignQueryStats.map((item) => (
                          <span key={item.id}>{item.query}: {item.profilesCreated} novos/{item.profilesInspected} analisados</span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {reviewLocalBusinessOpportunities.length > 0 && (
        <section className="mt-5 overflow-hidden rounded-[22px] border border-[#ead9a6] bg-white">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0e6c8] bg-[#fffaf0] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[13px] bg-[#fff0c9] text-[#8b6718]"><Building2 size={18} /></span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b7a2e]">Presença digital local</p><h2 className="text-base font-semibold">{reviewLocalBusinessOpportunities.length} empresas para revisão</h2></div>
            </div>
            <span className="text-[9px] text-[#806f43]">Sem contato automático</span>
          </header>
          <div className="grid gap-px bg-[#eee9dd] md:grid-cols-2 xl:grid-cols-3">
            {reviewLocalBusinessOpportunities.map((opportunity) => (
              <article className="bg-white p-5" key={opportunity.id}>
                <span className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${opportunity.status === "website_opportunity" ? "bg-[#fff0c9] text-[#846214]" : "bg-[#e8eef2] text-[#526b78]"}`}>
                  {opportunity.status === "website_opportunity" ? "Oportunidade de criação de site" : "Site encontrado · Instagram não localizado"}
                </span>
                <h3 className="mt-3 text-sm font-bold text-[#294653]">{opportunity.businessName}</h3>
                <p className="mt-1 text-[9px] text-[#7c8a90]">{opportunity.niche} · {opportunity.location}</p>
                {opportunity.address && <p className="mt-3 text-[9px] leading-4 text-[#5f7078]">{opportunity.address}</p>}
                {opportunity.phone && <p className="mt-1 text-[9px] font-bold text-[#5f7078]">{opportunity.phone}</p>}
                <div className="mt-4 flex flex-wrap gap-3 text-[9px] font-bold">
                  <Link href={opportunity.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#2f7c60]">Abrir no Maps <ExternalLink size={10} /></Link>
                  {opportunity.websiteUrl && <Link href={opportunity.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#587795]">Abrir site <ExternalLink size={10} /></Link>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[.7fr_1.3fr]">
        <section className="h-fit rounded-[22px] border border-[#e1e1db] bg-white p-5">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[13px] bg-[#dce8f6] text-[#425d91]"><UserPlus size={18} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b979d]">Qualificação</p><h2 className="text-base font-semibold">Adicionar prospecto</h2></div></div>
          {campaigns.length ? (
            <form action={addOutboundProspect} className="mt-5 space-y-3">
              <select name="campaignId" required className="h-11 w-full rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none"><option value="">Selecione uma campanha</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
              <div className="grid gap-3 sm:grid-cols-2"><input name="instagramUsername" required placeholder="@perfil" className="h-11 rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none" /><input name="name" placeholder="Nome (opcional)" className="h-11 rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none" /></div>
              <input name="sourceUrl" type="url" placeholder="https://www.instagram.com/perfil" className="h-11 w-full rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none" />
              <div className="grid gap-3 sm:grid-cols-2"><input name="profileCategory" placeholder="Categoria pública" className="h-11 rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none" /><input name="profileLocation" placeholder="Localização pública" className="h-11 rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none" /></div>
              <textarea name="profileBio" maxLength={500} rows={2} placeholder="Bio pública do perfil" className="w-full resize-y rounded-xl border border-[#dfe2de] bg-[#faf9f6] p-3 text-xs leading-5 outline-none" />
              <textarea name="publicSignal" maxLength={300} rows={2} placeholder="Sinal público verdadeiro para personalização, por exemplo: seu projeto de organização de bancada" className="w-full resize-y rounded-xl border border-[#dfe2de] bg-[#faf9f6] p-3 text-xs leading-5 outline-none" />
              <textarea name="qualificationReason" required minLength={10} maxLength={500} rows={3} placeholder="Por que este perfil é relevante para a campanha?" className="w-full resize-y rounded-xl border border-[#dfe2de] bg-[#faf9f6] p-3 text-xs leading-5 outline-none" />
              <SubmitButton pendingLabel="Adicionando…" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#193848] px-4 py-3 text-xs font-bold text-white disabled:opacity-60">Adicionar sem contatar</SubmitButton>
            </form>
          ) : <p className="mt-5 text-xs text-[#7c8a90]">Crie uma campanha antes de adicionar prospectos.</p>}
        </section>

        <section className="overflow-hidden rounded-[22px] border border-[#e1e1db] bg-white">
          <header className="border-b border-[#ecece7] px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b979d]">Fila de prospecção</p><h2 className="mt-1 text-base font-semibold">{reviewProspects.length} prospectos para análise</h2></header>
          {!reviewProspects.length ? <div className="p-5"><EmptyState title="Fila vazia" description="Perfis descobertos aparecerão aqui sem receber contato automático." /></div> : (
            <div className="divide-y divide-[#ecece7]">
              {reviewProspects.map(({ prospect, campaign, lead }) => (
                <article className="p-5" key={prospect.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#294653]">{prospect.name || `@${prospect.instagramUsername}`}</p><p className="mt-1 text-[10px] text-[#859197]">@{prospect.instagramUsername} · {campaign.name} · {prospect.funnelType === "partner" ? "Parceiros" : "Clientes"}</p></div><span className={`rounded-full px-3 py-1.5 text-[9px] font-bold ${prospect.contactPolicy === "inbound_window" ? "bg-[#d8ede4] text-[#2b7258]" : "bg-[#fff0c9] text-[#846214]"}`}>{policyLabels[prospect.contactPolicy] || prospect.contactPolicy}</span></div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[9px]">
                    {prospect.discoverySource !== "manual" && <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f2ec] px-2.5 py-1 font-bold text-[#2f7c60]"><Sparkles size={10} />Descoberto automaticamente{prospect.discoveryQuery ? ` · ${prospect.discoveryQuery}` : ""}</span>}
                    {prospect.qualificationReason.includes("Validado pela IA rápida") && <span className="inline-flex items-center gap-1 rounded-full bg-[#eee2f0] px-2.5 py-1 font-bold text-[#74527b]"><Bot size={10} />Aderência validada pela IA rápida</span>}
                    <span className="rounded-full bg-[#edf0ed] px-2.5 py-1 font-bold text-[#52656d]">ICP {prospect.icpScore}</span><span className="rounded-full bg-[#edf0ed] px-2.5 py-1 font-bold text-[#52656d]">{OUTBOUND_PIPELINE_LABELS[prospect.pipelineStage] || prospect.pipelineStage}</span><span className="rounded-full bg-[#edf0ed] px-2.5 py-1 font-bold text-[#52656d]">Prioridade {prospect.priority === "high" ? "alta" : prospect.priority === "low" ? "baixa" : "normal"}</span>{prospect.experimentVariant && <span className="rounded-full bg-[#e8e1f2] px-2.5 py-1 font-bold text-[#6b5481]">Teste {prospect.experimentVariant === "control" ? "controle" : "variante"}</span>}
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-[#657780]">{prospect.qualificationReason}</p>
                  {prospect.draftBody ? (
                    <div className="mt-4 rounded-xl bg-[#f7f5ee] p-3">
                      <form action={saveOutboundProspectDraft}><input type="hidden" name="prospectId" value={prospect.id} /><textarea name="draftBody" defaultValue={prospect.draftBody} maxLength={1000} rows={4} className="w-full resize-y rounded-lg border border-[#dfe2de] bg-white p-3 text-[11px] leading-5 outline-none" /><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[9px] text-[#8a959b]">Aprovação registra o texto; não envia.</span><SubmitButton pendingLabel="Salvando…" className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2f7c60] px-3 py-2 text-[9px] font-bold text-white disabled:opacity-60">Salvar revisão</SubmitButton></div></form>
                      {prospect.status === "approved_manual" && <form action={queueOutboundFirstContact} className="mt-2"><input type="hidden" name="prospectId" value={prospect.id} /><SubmitButton disabled={!globallyReady} pendingLabel="Agendando…" className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#e56e50] px-3 py-2 text-[9px] font-bold text-white disabled:opacity-40">Agendar no worker local</SubmitButton></form>}
                    </div>
                  ) : <form action={prepareOutboundProspectDraft} className="mt-4"><input type="hidden" name="prospectId" value={prospect.id} /><SubmitButton pendingLabel="Preparando…" className="inline-flex items-center gap-2 rounded-xl bg-[#193848] px-4 py-2.5 text-[10px] font-bold text-white disabled:opacity-60"><Bot size={13} />Preparar rascunho</SubmitButton></form>}
                  {prospect.lastError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[9px] text-red-700">{prospect.lastError}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-[9px] font-bold">{prospect.sourceUrl && <Link href={prospect.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#587795]">Ver fonte <ExternalLink size={10} /></Link>}{lead && <Link href={`/comercial/leads/${lead.id}`} className="text-[#2f7c60]">Abrir lead relacionado</Link>}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
