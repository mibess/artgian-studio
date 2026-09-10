import Link from "next/link";
import { followersProgressSummary } from "../../../src/features/outbound/followers-discovery-domain";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Settings2,
} from "lucide-react";
import { SubmitButton } from "../../components/PendingButton";
import {
  getOperationsData,
  getOutboundProspects,
} from "../../../src/db/commercial";
import {
  normalizeDiscoveryStrategy,
  parseInstagramBaseProfiles,
  parseStoredDiscoveryTerms,
} from "../../../src/features/outbound/discovery-domain";
import { OUTBOUND_PIPELINE_LABELS } from "../../../src/features/outbound/domain";
import {
  localProgressSummary,
  localStopLabel,
} from "../../../src/features/outbound/local-discovery-domain";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  formatDateTime,
} from "../_components";
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
import { CampaignDetailsForm } from "./CampaignDetailsForm";
import {
  isPendingLocalOpportunity,
  parseInstagramImportPayload,
} from "../../../src/features/outbound/instagram-import-domain";
import {
  ImportInstagramForm,
  InstagramImportHistory,
} from "./InstagramImports";

type SearchParams = {
  importacao?: string;
  id?: string;
  aba?: string;
  nova?: string;
  q?: string;
  filtro?: string;
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
const tabs = [
  ["resumo", "Resumo"],
  ["publico", "Público"],
  ["mensagens", "Mensagens"],
  ["busca", "Busca"],
  ["historico", "Histórico"],
  ["configuracoes", "Configurações"],
] as const;
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
const messageStatus: Record<string, string> = {
  identified: "Sem rascunho",
  waiting_review: "Aguardando revisão",
  approved_manual: "Revisada",
  queued: "Agendada",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Falha no envio",
  send_uncertain: "Conferir envio",
};
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#193848] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2c5264] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7c60] disabled:opacity-40";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8dfdb] bg-white px-4 py-2.5 text-xs font-semibold text-[#365767] hover:bg-[#f3f7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7c60] disabled:opacity-40";
function ContextFields({
  campaignId,
  tab,
}: {
  campaignId: string;
  tab: string;
}) {
  return (
    <>
      <input type="hidden" name="selectedCampaign" value={campaignId} />
      <input type="hidden" name="returnTab" value={tab} />
    </>
  );
}
function jobBelongsToCampaign(payload: string, campaignId: string) {
  try {
    return (
      (JSON.parse(payload) as { campaignId?: string }).campaignId === campaignId
    );
  } catch {
    return false;
  }
}
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [data, prospects, params] = await Promise.all([
    getOperationsData(),
    getOutboundProspects(),
    searchParams,
  ]);
  const {
    campaigns,
    settings,
    jobs,
    discoveryRuns,
    discoveryQueryStats,
    localBusinessOpportunities,
  } = data;
  const globallyReady =
    process.env.OUTBOUND_AUTOMATION_ENABLED === "true" &&
    process.env.BROWSER_SEND_ENABLED === "true" &&
    settings.automation_paused !== "true" &&
    settings.outbound_paused === "false";
  const discoveryPaused =
    settings.automation_paused === "true" ||
    settings.discovery_paused === "true";
  const selected = campaigns.find((c) => c.id === params.id);
  const tab = tabs.some(([key]) => key === params.aba) ? params.aba! : "resumo";
  const href = (nextTab: string) =>
    `/comercial/campanhas?id=${encodeURIComponent(selected?.id || "")}&aba=${nextTab}`;
  const reviewProspects = prospects.filter(
    ({ prospect }) =>
      prospect.status !== "disqualified" &&
      prospect.campaignId === selected?.id,
  );
  const knownProspectUsernames = new Set(
    prospects
      .filter(({ prospect }) => prospect.status !== "disqualified")
      .map(({ prospect }) => prospect.instagramUsername.toLowerCase()),
  );
  const opportunities = localBusinessOpportunities.filter(
    (o) =>
      o.campaignId === selected?.id &&
      isPendingLocalOpportunity(o, knownProspectUsernames),
  );
  const importJobs = jobs
    .filter(
      (job) =>
        job.type === "import_instagram_profile" &&
        parseInstagramImportPayload(job.payload)?.campaignId === selected?.id,
    )
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const campaignRuns = discoveryRuns.filter(
    (r) => r.campaignId === selected?.id,
  );
  const latestRun = campaignRuns[0];
  const campaignJobs = jobs.filter(
    (j) =>
      j.type === "discover_prospects" &&
      selected &&
      jobBelongsToCampaign(j.payload, selected.id),
  );
  const running = campaignJobs.some((j) => j.status === "running");
  const nextPending = campaignJobs
    .filter((j) => j.status === "pending")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const withoutDraft = reviewProspects.filter(
    ({ prospect }) => !prospect.draftBody,
  );
  const drafts = reviewProspects.filter(({ prospect }) =>
    Boolean(prospect.draftBody),
  );
  const toReview = drafts.filter(
    ({ prospect }) => prospect.status === "waiting_review",
  );
  const approved = drafts.filter(
    ({ prospect }) => prospect.status === "approved_manual",
  );
  const nextStep = toReview.length
    ? {
        title: "Revise suas mensagens",
        description: `${toReview.length} rascunhos aguardam sua revisão. Abra cada mensagem, ajuste o texto e aprove.`,
        label: "Revisar mensagens",
        tab: "mensagens",
      }
    : approved.length
      ? {
          title: "Suas mensagens já estão revisadas",
          description:
            globallyReady && selected?.outboundEnabled
              ? "Confira as mensagens aprovadas e agende os próximos contatos."
              : "Os textos estão aprovados. Para agendar, os envios precisam estar liberados nas configurações globais e na aba Busca desta campanha.",
          label: "Ver mensagens revisadas",
          tab: "mensagens",
        }
      : withoutDraft.length
        ? {
            title: "Seu público está pronto para uma abordagem",
            description: `${withoutDraft.length} prospectos ainda não têm mensagem. Abra o público e clique em Preparar rascunho no perfil escolhido.`,
            label: "Ver público e preparar rascunhos",
            tab: "publico",
          }
        : drafts.length
          ? {
              title: "Acompanhe suas abordagens",
              description:
                "Confira o status das mensagens e veja se algum contato precisa da sua atenção.",
              label: "Acompanhar mensagens",
              tab: "mensagens",
            }
          : {
              title: "Encontre seu próximo cliente ou parceiro",
              description:
                "Configure os critérios de busca e acompanhe os perfis que correspondem à campanha.",
              label: "Configurar busca",
              tab: "busca",
            };
  const sent = reviewProspects.filter(
    ({ prospect }) => prospect.status === "sent",
  );
  const query = (params.q || "").trim().toLocaleLowerCase("pt-BR");
  const showOpportunities = tab === "publico" && params.filtro === "empresas";
  const visibleProspects = (
    tab === "mensagens" ? drafts : reviewProspects
  ).filter(
    ({ prospect }) =>
      (!query ||
        `${prospect.name || ""} ${prospect.instagramUsername}`
          .toLocaleLowerCase("pt-BR")
          .includes(query)) &&
      (tab !== "mensagens" ||
        !params.filtro ||
        params.filtro === "todos" ||
        prospect.status === params.filtro),
  );
  const listedCampaigns = campaigns.filter(
    (c) =>
      !query ||
      `${c.name} ${c.segment || ""}`.toLocaleLowerCase("pt-BR").includes(query),
  );
  const hasSuccess =
    params.importacao ||
    params.salvo ||
    params.prospecto ||
    params.rascunho ||
    params.revisado ||
    params.campanha ||
    params.agendado ||
    params.descoberta ||
    params.busca;
  const successMessage = params.importacao
    ? params.importacao === "resolved"
      ? "Esta empresa já tem um Instagram conciliado."
      : "Importação agendada. Acompanhe a leitura do perfil e a validação abaixo. Nenhuma mensagem será enviada."
    : params.rascunho
      ? "Rascunho preparado. Revise o texto abaixo."
      : params.revisado
        ? "Revisão salva. A mensagem está pronta para agendar."
        : params.agendado
          ? "Mensagem agendada. Acompanhe o status na aba Mensagens."
          : params.busca
            ? "Busca agendada. Acompanhe a execução no Histórico."
            : params.descoberta
              ? "Configuração de busca atualizada."
              : params.prospecto
                ? "Prospecto adicionado ao público desta campanha."
                : params.campanha
                  ? "Configuração de envio atualizada."
                  : "Campanha salva. Configure a busca para começar.";
  return (
    <>
      <PageHeader
        eyebrow="Prospecção"
        title="Campanhas e prospecção"
        description="Organize seu público, encontre oportunidades e prepare cada abordagem."
        action={
          <Link href="/comercial/campanhas?nova=1" className={primaryButton}>
            <Plus size={15} />
            Nova campanha
          </Link>
        }
      />
      {hasSuccess && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {successMessage}
        </p>
      )}
      {params.erro && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {params.erro}
        </p>
      )}
      {params.id && !selected && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          Campanha não encontrada. Selecione uma campanha abaixo.
        </p>
      )}
      {params.nova === "1" ? (
        <section className="mx-auto max-w-2xl rounded-2xl border border-[#e1e1db] bg-white p-6 sm:p-8">
          <Link
            href="/comercial/campanhas"
            className="inline-flex items-center gap-2 text-xs text-[#657780]"
          >
            <ArrowLeft size={14} />
            Todas as campanhas
          </Link>
          <h2 className="mt-5 text-xl font-semibold">Nova campanha</h2>
          <p className="mt-2 text-sm leading-6 text-[#657780]">
            Defina quem você quer alcançar. No próximo passo, escolha como
            encontrar esse público.
          </p>
          <form action={createCampaign} className="mt-5 space-y-3">
            {[
              { name: "name", label: "Nome", placeholder: "Parcerias locais" },
              { name: "source", label: "Origem", placeholder: "Instagram" },
              {
                name: "segment",
                label: "Segmento",
                placeholder: "Arquitetura e decoração",
              },
            ].map((field) => (
              <label className="block" key={field.name}>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#657780]">
                  {field.label}
                </span>
                <input
                  name={field.name}
                  required={field.name !== "segment"}
                  placeholder={field.placeholder}
                  className="h-10 w-full rounded-xl border border-[#dfe2de] bg-white px-3 text-xs text-[#294653] outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4] outline-none placeholder:text-[#87969d]"
                />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#657780]">
                  Funil
                </span>
                <select
                  name="funnelType"
                  className="h-10 w-full rounded-xl border border-[#dfe2de] bg-white px-3 text-xs text-[#294653] outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4]"
                >
                  <option value="consumer">Clientes</option>
                  <option value="partner">Parceiros</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#657780]">
                  Limite diário
                </span>
                <input
                  name="dailyLimit"
                  type="number"
                  min="1"
                  max="30"
                  defaultValue="5"
                  className="h-10 w-full rounded-xl border border-[#dfe2de] bg-white px-3 text-xs text-[#294653] outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4]"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#657780]">
                Estratégia inicial
              </span>
              <select
                name="discoveryStrategy"
                defaultValue="instagram_search"
                className="h-10 w-full rounded-xl border border-[#dfe2de] bg-white px-3 text-xs text-[#294653] outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4]"
              >
                <option value="instagram_search">Termos no Instagram</option>
                <option value="instagram_followers">
                  Seguidores de perfis-base
                </option>
                <option value="local_business">
                  Empresas locais no Google Maps
                </option>
              </select>
              <span className="mt-1.5 block text-[11px] leading-3 text-[#657780]">
                Depois de criar, configure os critérios na aba Busca.
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#657780]">
                Janela operacional
              </span>
              <input
                name="operatingHours"
                defaultValue="09:00-18:00"
                pattern="[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}"
                className="h-10 w-full rounded-xl border border-[#dfe2de] bg-white px-3 text-xs text-[#294653] outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4]"
              />
            </label>
            <SubmitButton
              pendingLabel="Criando…"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f1c865] px-4 py-3 text-xs font-extrabold text-[#193848] disabled:opacity-60"
            >
              Criar campanha
            </SubmitButton>
          </form>
        </section>
      ) : !selected ? (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              ["Campanhas", campaigns.length],
              [
                "Buscas ativas",
                campaigns.filter((c) => c.discoveryEnabled).length,
              ],
              [
                "Rascunhos para revisar",
                prospects.filter(
                  ({ prospect }) => prospect.status === "waiting_review",
                ).length,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-[#e1e1db] bg-white p-4 sm:p-5"
              >
                <p className="text-xs text-[#73858c]">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-2xl border border-[#e1e1db] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9ece8] p-5">
              <div>
                <h2 className="font-semibold">Todas as campanhas</h2>
                <p className="mt-1 text-xs text-[#73858c]">
                  Abra uma campanha para gerenciar público, mensagens e busca.
                </p>
              </div>
              <form
                className="flex max-w-full gap-2"
                action="/comercial/campanhas"
              >
                <input
                  aria-label="Pesquisar campanhas"
                  name="q"
                  defaultValue={params.q}
                  placeholder="Pesquisar campanhas"
                  className="min-w-0 rounded-lg border border-[#dfe2de] px-3 py-2 text-sm"
                />
                <button className={secondaryButton} aria-label="Pesquisar">
                  <Search size={15} />
                </button>
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-[#f8f9f6] text-xs text-[#73858c]">
                  <tr>
                    {[
                      "Campanha",
                      "Busca",
                      "Público",
                      "Mensagens",
                      "Última busca",
                      "",
                    ].map((label, i) => (
                      <th key={i} className="px-5 py-3 font-medium" scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ec]">
                  {listedCampaigns.map((campaign) => {
                    const people = prospects.filter(
                      ({ prospect }) =>
                        prospect.campaignId === campaign.id &&
                        prospect.status !== "disqualified",
                    );
                    const pending = people.filter(
                      ({ prospect }) => prospect.status === "waiting_review",
                    ).length;
                    return (
                      <tr key={campaign.id} className="hover:bg-[#f7faf8]">
                        <td className="px-5 py-5">
                          <Link
                            className="font-semibold text-[#294653] hover:underline"
                            href={`/comercial/campanhas?id=${campaign.id}`}
                          >
                            {campaign.name}
                          </Link>
                          <p className="mt-1 max-w-xs text-xs text-[#73858c]">
                            {campaign.segment || "Sem segmento"}
                          </p>
                        </td>
                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs ${campaign.discoveryEnabled ? "bg-[#d8ede4] text-[#2b7258]" : "bg-[#edf0ed] text-[#65746c]"}`}
                          >
                            {campaign.discoveryEnabled ? "Ativa" : "Inativa"}
                          </span>
                          <p className="mt-2 text-xs text-[#73858c]">
                            {
                              strategyLabels[
                                normalizeDiscoveryStrategy(
                                  campaign.discoveryStrategy,
                                )
                              ]
                            }
                          </p>
                        </td>
                        <td className="px-5 py-5 tabular-nums">
                          {people.length}
                          <span className="block text-xs text-[#73858c]">
                            prospectos
                          </span>
                        </td>
                        <td className="px-5 py-5">
                          {pending ? (
                            <Link
                              className="font-medium text-[#2f7c60] hover:underline"
                              href={`/comercial/campanhas?id=${campaign.id}&aba=mensagens`}
                            >
                              {pending} para revisar
                            </Link>
                          ) : (
                            <span className="text-xs text-[#73858c]">
                              Sem revisão pendente
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-5 text-xs text-[#73858c]">
                          {campaign.lastDiscoveryAt
                            ? formatDateTime(campaign.lastDiscoveryAt)
                            : "Ainda não executada"}
                        </td>
                        <td className="px-5 py-5">
                          <Link
                            className={secondaryButton}
                            aria-label={`Abrir campanha ${campaign.name}`}
                            href={`/comercial/campanhas?id=${campaign.id}`}
                          >
                            Abrir <ArrowRight size={14} />
                          </Link>
                          <Link
                            className="mt-2 flex items-center gap-1 text-xs font-medium text-[#657780] hover:underline"
                            aria-label={`Editar campanha ${campaign.name}`}
                            href={`/comercial/campanhas?id=${campaign.id}&aba=configuracoes`}
                          >
                            <Settings2 size={13} />
                            Editar
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!listedCampaigns.length && (
              <div className="p-8">
                <EmptyState
                  title={
                    campaigns.length
                      ? "Nenhuma campanha encontrada"
                      : "Sua primeira campanha começa aqui"
                  }
                  description={
                    campaigns.length
                      ? "Tente outro nome ou segmento."
                      : "Clique em Nova campanha para definir o público que você quer alcançar."
                  }
                />
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/comercial/campanhas"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#657780]"
            >
              <ArrowLeft size={14} />
              Todas as campanhas
            </Link>
            <span
              className={`inline-flex items-center gap-2 text-xs ${globallyReady ? "text-[#2b7258]" : "text-[#846214]"}`}
            >
              {globallyReady ? (
                <ShieldCheck size={14} />
              ) : (
                <ShieldOff size={14} />
              )}
              {globallyReady
                ? "Envios liberados globalmente"
                : "Envio outbound bloqueado"}
            </span>
          </div>
          <section className="mb-5 overflow-hidden rounded-2xl border border-[#dbe1dc] bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <p className="mt-1 max-w-xl text-sm text-[#73858c]">
                  {selected.segment || "Sem segmento"} ·{" "}
                  {selected.funnelType === "partner" ? "Parceiros" : "Clientes"}
                </p>
                <p className="mt-2 text-xs text-[#73858c]">
                  {running
                    ? "Busca em execução"
                    : nextPending
                      ? `Próxima busca: ${formatDateTime(nextPending.scheduledAt)}`
                      : "Nenhuma busca agendada"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={href("configuracoes")} className={secondaryButton}>
                  <Settings2 size={14} />
                  Editar campanha
                </Link>
                <StatusBadge status={selected.status} />
                {selected.discoveryEnabled ? (
                  <form action={queueCampaignDiscoveryNow}>
                    <ContextFields campaignId={selected.id} tab="historico" />
                    <input
                      type="hidden"
                      name="campaignId"
                      value={selected.id}
                    />
                    <SubmitButton
                      className={primaryButton}
                      pendingLabel="Agendando…"
                      disabled={running || discoveryPaused}
                    >
                      <Search size={14} />
                      {running ? "Buscando…" : "Buscar agora"}
                    </SubmitButton>
                  </form>
                ) : (
                  <Link className={primaryButton} href={href("busca")}>
                    Configurar busca <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>
            {discoveryPaused && (
              <p className="px-6 pb-4 text-xs text-[#846214]">
                A descoberta está pausada nas configurações gerais.
              </p>
            )}
            <nav
              aria-label="Etapas da campanha"
              className="flex overflow-x-auto border-t border-[#edf0ec] px-3 sm:px-5"
            >
              {tabs.map(([key, label]) => (
                <Link
                  key={key}
                  href={href(key)}
                  scroll={false}
                  aria-current={tab === key ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold transition ${tab === key ? "border-[#2f7c60] text-[#2f7c60]" : "border-transparent text-[#73858c] hover:text-[#294653]"}`}
                >
                  {label}
                  {key === "publico" && (
                    <span className="rounded-md bg-[#eef2ef] px-1.5 text-xs">
                      {reviewProspects.length}
                    </span>
                  )}
                  {key === "mensagens" && toReview.length > 0 && (
                    <span className="rounded-md bg-[#fff0c9] px-1.5 text-xs text-[#846214]">
                      {toReview.length}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </section>
          {tab === "resumo" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Público qualificado", reviewProspects.length, "publico"],
                  ["Sem rascunho", withoutDraft.length, "publico"],
                  ["Para revisar", toReview.length, "mensagens"],
                  ["Mensagens enviadas", sent.length, "mensagens"],
                ].map(([label, count, target]) => (
                  <Link
                    key={label}
                    href={href(String(target))}
                    className="rounded-2xl border border-[#e1e1db] bg-white p-5 hover:border-[#6ba68d]"
                  >
                    <p className="text-xs text-[#73858c]">{label}</p>
                    <p className="mt-3 text-3xl font-semibold tabular-nums">
                      {count}
                    </p>
                  </Link>
                ))}
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <section className="rounded-2xl border border-[#cfe2d6] bg-[#edf7f1] p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#2f7c60]">
                    Próximo passo
                  </p>
                  <h3 className="mt-3 text-xl font-semibold">
                    {nextStep.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#657780]">
                    {nextStep.description}
                  </p>
                  <Link
                    className={primaryButton + " mt-5"}
                    href={href(nextStep.tab)}
                  >
                    {nextStep.label}
                    <ArrowRight size={14} />
                  </Link>
                </section>
                <section className="rounded-2xl border border-[#e1e1db] bg-white p-6">
                  <h3 className="font-semibold">Como esta campanha funciona</h3>
                  <ol className="mt-5 space-y-4 text-sm">
                    {[
                      [
                        "Defina a busca",
                        "Escolha o público e a região na aba Busca.",
                      ],
                      [
                        "Revise o público",
                        "Confira os perfis qualificados e prepare os rascunhos.",
                      ],
                      [
                        "Aprove a abordagem",
                        "Revise a mensagem e agende o primeiro contato.",
                      ],
                    ].map(([title, description], i) => (
                      <li key={title} className="flex gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#edf2ef] text-xs font-bold text-[#2f7c60]">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-medium">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-[#73858c]">
                            {description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e1e1db] bg-white p-5">
                <div>
                  <h3 className="text-sm font-semibold">Última busca</h3>
                  <p className="mt-1 text-sm text-[#73858c]">
                    {latestRun
                      ? latestRun.status === "completed"
                        ? `${latestRun.profilesInspected} analisados · ${latestRun.profilesCreated} novos prospectos · ${latestRun.websiteOpportunitiesCreated} oportunidades de site`
                        : latestRun.status === "failed"
                          ? `Falha: ${latestRun.error || "Confira o histórico"}`
                          : "Busca em andamento; resultados disponíveis ao concluir."
                      : "Esta campanha ainda não realizou uma busca."}
                  </p>
                  {latestRun?.stopReason && (
                    <p className="mt-2 text-xs text-[#73858c]">
                      {localStopLabel(latestRun.stopReason)}
                    </p>
                  )}
                </div>
                <Link href={href("historico")} className={secondaryButton}>
                  Ver histórico <ArrowRight size={14} />
                </Link>
              </section>
            </div>
          )}
          {(tab === "publico" || tab === "mensagens") && (
            <section>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {tab === "publico"
                      ? "Público da campanha"
                      : "Mensagens e rascunhos"}
                  </h3>
                  <p className="mt-1 text-sm text-[#73858c]">
                    {tab === "publico"
                      ? "Escolha um perfil para preparar a primeira mensagem."
                      : "Revise, aprove e acompanhe cada abordagem."}
                  </p>
                </div>
                <form
                  action="/comercial/campanhas"
                  className="flex max-w-full flex-wrap gap-2"
                >
                  <input type="hidden" name="id" value={selected.id} />
                  <input type="hidden" name="aba" value={tab} />
                  <input
                    aria-label={
                      showOpportunities
                        ? "Pesquisar empresas"
                        : "Pesquisar perfis"
                    }
                    name="q"
                    defaultValue={params.q}
                    placeholder={
                      showOpportunities ? "Nome da empresa" : "Nome ou @perfil"
                    }
                    className="min-w-0 rounded-lg border border-[#dfe2de] bg-white px-3 py-2 text-sm"
                  />
                  {tab === "mensagens" ? (
                    <select
                      aria-label="Status da mensagem"
                      name="filtro"
                      defaultValue={params.filtro || "todos"}
                      className="rounded-lg border border-[#dfe2de] bg-white px-3 text-sm"
                    >
                      <option value="todos">Todos os status</option>
                      {Object.entries(messageStatus)
                        .filter(([key]) => key !== "identified")
                        .map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="hidden"
                      name="filtro"
                      value={params.filtro || ""}
                    />
                  )}
                  <button className={secondaryButton}>Filtrar</button>
                </form>
              </div>
              {tab === "publico" && (
                <div className="mb-5 flex flex-wrap gap-2">
                  <Link
                    aria-current={!showOpportunities ? "page" : undefined}
                    className={
                      !showOpportunities ? primaryButton : secondaryButton
                    }
                    href={href("publico")}
                  >
                    Perfis qualificados · {reviewProspects.length}
                  </Link>
                  <Link
                    aria-current={showOpportunities ? "page" : undefined}
                    className={
                      showOpportunities ? primaryButton : secondaryButton
                    }
                    href={href("publico") + "&filtro=empresas"}
                  >
                    <Building2 size={14} />
                    Empresas sem Instagram · {opportunities.length}
                  </Link>
                </div>
              )}
              {showOpportunities ? (
                <>
                  <InstagramImportHistory
                    campaignId={selected.id}
                    imports={importJobs}
                  />
                  <div className="grid gap-4 lg:grid-cols-2">
                    {opportunities
                      .filter(
                        (o) =>
                          !query ||
                          o.businessName
                            .toLocaleLowerCase("pt-BR")
                            .includes(query),
                      )
                      .map((opportunity) => (
                        <article
                          className="rounded-2xl border border-[#e1e1db] bg-white p-5"
                          key={opportunity.id}
                        >
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${opportunity.status === "website_opportunity" ? "bg-[#fff0c9] text-[#846214]" : "bg-[#e8eef2] text-[#526b78]"}`}
                          >
                            {opportunity.status === "website_opportunity"
                              ? "Oportunidade de criação de site"
                              : "Site encontrado · Instagram não localizado"}
                          </span>
                          <h3 className="mt-3 text-sm font-bold text-[#294653]">
                            {opportunity.businessName}
                          </h3>
                          <p className="mt-1 text-xs text-[#7c8a90]">
                            {opportunity.niche} · {opportunity.location}
                          </p>
                          {opportunity.address && (
                            <p className="mt-3 text-xs leading-4 text-[#5f7078]">
                              {opportunity.address}
                            </p>
                          )}
                          {opportunity.phone && (
                            <p className="mt-1 text-xs font-bold text-[#5f7078]">
                              {opportunity.phone}
                            </p>
                          )}
                          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold">
                            <Link
                              href={opportunity.googleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#2f7c60]"
                            >
                              Abrir no Maps <ExternalLink size={10} />
                            </Link>
                            {opportunity.websiteUrl && (
                              <Link
                                href={opportunity.websiteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#587795]"
                              >
                                Abrir site <ExternalLink size={10} />
                              </Link>
                            )}
                          </div>
                          <ImportInstagramForm
                            opportunity={opportunity}
                            job={importJobs.find(
                              (job) =>
                                parseInstagramImportPayload(job.payload)
                                  ?.opportunityId === opportunity.id,
                            )}
                          />
                        </article>
                      ))}
                    {!opportunities.filter(
                      (o) =>
                        !query ||
                        o.businessName
                          .toLocaleLowerCase("pt-BR")
                          .includes(query),
                    ).length && (
                      <EmptyState
                        title="Nenhuma empresa pendente"
                        description="Empresas sem Instagram aparecerão aqui para revisão da presença digital."
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  {!visibleProspects.length ? (
                    <div className="rounded-2xl border border-[#e1e1db] bg-white p-8">
                      <EmptyState
                        title={
                          query || params.filtro
                            ? "Nenhum resultado para este filtro"
                            : tab === "mensagens"
                              ? "Nenhum rascunho preparado"
                              : "Seu público aparecerá aqui"
                        }
                        description={
                          tab === "mensagens"
                            ? "Abra Público, escolha um perfil e clique em Preparar rascunho."
                            : "Inicie uma busca ou adicione um prospecto manualmente."
                        }
                      />
                      <Link
                        href={href(tab === "mensagens" ? "publico" : "busca")}
                        className={secondaryButton + " mt-4"}
                      >
                        {tab === "mensagens"
                          ? "Ver público"
                          : "Configurar busca"}
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  ) : (
                    <div className="grid items-start gap-4 xl:grid-cols-2">
                      {visibleProspects.map(({ prospect, campaign, lead }) => (
                        <div key={prospect.id}>
                          {tab === "mensagens" && (
                            <p className="mb-2 px-1 text-xs font-semibold text-[#73858c]">
                              {messageStatus[prospect.status] ||
                                prospect.status}
                            </p>
                          )}
                          <article
                            className="rounded-2xl border border-[#e1e1db] bg-white p-5"
                            id={`prospect-${prospect.id}`}
                            key={prospect.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-[#294653]">
                                  {prospect.name ||
                                    `@${prospect.instagramUsername}`}
                                </p>
                                <p className="mt-1 text-xs text-[#859197]">
                                  @{prospect.instagramUsername} ·{" "}
                                  {campaign.name} ·{" "}
                                  {prospect.funnelType === "partner"
                                    ? "Parceiros"
                                    : "Clientes"}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${prospect.contactPolicy === "inbound_window" ? "bg-[#d8ede4] text-[#2b7258]" : "bg-[#fff0c9] text-[#846214]"}`}
                              >
                                {policyLabels[prospect.contactPolicy] ||
                                  prospect.contactPolicy}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {prospect.discoverySource !== "manual" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f2ec] px-2.5 py-1 font-bold text-[#2f7c60]">
                                  <Sparkles size={10} />
                                  Descoberto automaticamente
                                  {prospect.discoveryQuery
                                    ? ` · ${prospect.discoveryQuery}`
                                    : ""}
                                </span>
                              )}
                              {prospect.qualificationReason.includes(
                                "Validado pela IA rápida",
                              ) && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#eee2f0] px-2.5 py-1 font-bold text-[#74527b]">
                                  <Bot size={10} />
                                  Aderência validada pela IA rápida
                                </span>
                              )}
                              <span className="rounded-full bg-[#edf0ed] px-2.5 py-1 font-bold text-[#52656d]">
                                ICP {prospect.icpScore}
                              </span>
                              <span className="rounded-full bg-[#edf0ed] px-2.5 py-1 font-bold text-[#52656d]">
                                {OUTBOUND_PIPELINE_LABELS[
                                  prospect.pipelineStage
                                ] || prospect.pipelineStage}
                              </span>
                              <span className="rounded-full bg-[#edf0ed] px-2.5 py-1 font-bold text-[#52656d]">
                                Prioridade{" "}
                                {prospect.priority === "high"
                                  ? "alta"
                                  : prospect.priority === "low"
                                    ? "baixa"
                                    : "normal"}
                              </span>
                              {prospect.experimentVariant && (
                                <span className="rounded-full bg-[#e8e1f2] px-2.5 py-1 font-bold text-[#6b5481]">
                                  Teste{" "}
                                  {prospect.experimentVariant === "control"
                                    ? "controle"
                                    : "variante"}
                                </span>
                              )}
                            </div>
                            <details className="mt-3 text-xs leading-5 text-[#657780]">
                              <summary className="cursor-pointer font-semibold">
                                Por que este perfil foi qualificado?
                              </summary>
                              <p className="mt-2">
                                {prospect.qualificationReason}
                              </p>
                            </details>
                            {tab === "publico" && prospect.draftBody ? (
                              <Link
                                href={
                                  href("mensagens") + `#prospect-${prospect.id}`
                                }
                                className={primaryButton + " mt-4"}
                              >
                                Revisar mensagem <ArrowRight size={14} />
                              </Link>
                            ) : prospect.draftBody ? (
                              <div className="mt-4 rounded-xl bg-[#f7f5ee] p-3">
                                <form action={saveOutboundProspectDraft}>
                                  <ContextFields
                                    campaignId={selected.id}
                                    tab="mensagens"
                                  />
                                  <input
                                    type="hidden"
                                    name="prospectId"
                                    value={prospect.id}
                                  />
                                  <textarea
                                    name="draftBody"
                                    aria-label={`Mensagem para @${prospect.instagramUsername}`}
                                    readOnly={
                                      ![
                                        "identified",
                                        "waiting_review",
                                        "approved_manual",
                                        "failed",
                                      ].includes(prospect.status)
                                    }
                                    defaultValue={prospect.draftBody}
                                    maxLength={1000}
                                    rows={4}
                                    className="w-full resize-y rounded-lg border border-[#dfe2de] bg-white p-3 text-[11px] leading-5 outline-none"
                                  />
                                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs text-[#8a959b]">
                                      Aprovação registra o texto; não envia.
                                    </span>
                                    <SubmitButton
                                      disabled={
                                        ![
                                          "identified",
                                          "waiting_review",
                                          "approved_manual",
                                          "failed",
                                        ].includes(prospect.status)
                                      }
                                      pendingLabel="Salvando…"
                                      className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2f7c60] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                                    >
                                      Salvar revisão
                                    </SubmitButton>
                                  </div>
                                </form>
                                {prospect.status === "approved_manual" && (
                                  <form
                                    action={queueOutboundFirstContact}
                                    className="mt-2"
                                  >
                                    <ContextFields
                                      campaignId={selected.id}
                                      tab="mensagens"
                                    />
                                    <input
                                      type="hidden"
                                      name="prospectId"
                                      value={prospect.id}
                                    />
                                    <SubmitButton
                                      disabled={
                                        !globallyReady ||
                                        !selected.outboundEnabled ||
                                        Boolean(lead?.doNotContact)
                                      }
                                      pendingLabel="Agendando…"
                                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#e56e50] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                                    >
                                      Agendar mensagem
                                    </SubmitButton>
                                  </form>
                                )}
                              </div>
                            ) : (
                              <form
                                action={prepareOutboundProspectDraft}
                                className="mt-4"
                              >
                                <ContextFields
                                  campaignId={selected.id}
                                  tab="mensagens"
                                />
                                <input
                                  type="hidden"
                                  name="prospectId"
                                  value={prospect.id}
                                />
                                <SubmitButton
                                  pendingLabel="Preparando…"
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#193848] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                                >
                                  <Bot size={13} />
                                  Preparar rascunho
                                </SubmitButton>
                              </form>
                            )}
                            {prospect.lastError && (
                              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                                {prospect.lastError}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                              {prospect.sourceUrl && (
                                <Link
                                  href={prospect.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[#587795]"
                                >
                                  Ver fonte <ExternalLink size={10} />
                                </Link>
                              )}
                              {lead && (
                                <Link
                                  href={`/comercial/leads/${lead.id}`}
                                  className="text-[#2f7c60]"
                                >
                                  Abrir lead relacionado
                                </Link>
                              )}
                            </div>
                          </article>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {tab === "publico" && !showOpportunities && (
                <details className="mt-5 rounded-2xl border border-[#e1e1db] bg-white p-5">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Adicionar prospecto manualmente
                  </summary>
                  <p className="mt-2 text-xs text-[#73858c]">
                    O perfil será adicionado a {selected.name}.
                  </p>
                  <form
                    action={addOutboundProspect}
                    className="mt-5 max-w-2xl space-y-3"
                  >
                    <ContextFields campaignId={selected!.id} tab="publico" />
                    <input
                      type="hidden"
                      name="campaignId"
                      value={selected!.id}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        name="instagramUsername"
                        aria-label="Perfil do Instagram"
                        required
                        placeholder="@perfil"
                        className="h-11 rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none"
                      />
                      <input
                        name="name"
                        aria-label="Nome do prospecto"
                        placeholder="Nome (opcional)"
                        className="h-11 rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none"
                      />
                    </div>
                    <input
                      name="sourceUrl"
                      aria-label="Link do perfil no Instagram"
                      type="url"
                      placeholder="https://www.instagram.com/perfil"
                      className="h-11 w-full rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        name="profileCategory"
                        aria-label="Categoria pública"
                        placeholder="Categoria pública"
                        className="h-11 rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none"
                      />
                      <input
                        name="profileLocation"
                        aria-label="Localização pública"
                        placeholder="Localização pública"
                        className="h-11 rounded-xl border border-[#dfe2de] bg-[#faf9f6] px-3 text-xs outline-none"
                      />
                    </div>
                    <textarea
                      name="profileBio"
                      aria-label="Bio pública do perfil"
                      maxLength={500}
                      rows={2}
                      placeholder="Bio pública do perfil"
                      className="w-full resize-y rounded-xl border border-[#dfe2de] bg-[#faf9f6] p-3 text-xs leading-5 outline-none"
                    />
                    <textarea
                      name="publicSignal"
                      aria-label="Sinal público verdadeiro"
                      maxLength={300}
                      rows={2}
                      placeholder="Sinal público verdadeiro"
                      className="w-full resize-y rounded-xl border border-[#dfe2de] bg-[#faf9f6] p-3 text-xs leading-5 outline-none"
                    />
                    <textarea
                      name="qualificationReason"
                      aria-label="Motivo da qualificação"
                      required
                      minLength={10}
                      maxLength={500}
                      rows={3}
                      placeholder="Por que este perfil é relevante para a campanha?"
                      className="w-full resize-y rounded-xl border border-[#dfe2de] bg-[#faf9f6] p-3 text-xs leading-5 outline-none"
                    />
                    <SubmitButton
                      pendingLabel="Adicionando…"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#193848] px-4 py-3 text-xs font-bold text-white disabled:opacity-60"
                    >
                      Adicionar sem contatar
                    </SubmitButton>
                  </form>
                </details>
              )}
            </section>
          )}
          {tab === "configuracoes" && (
            <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
              <section className="rounded-2xl border border-[#e1e1db] bg-white p-5 sm:p-6">
                <h3 className="text-lg font-semibold">
                  Configurações da campanha
                </h3>
                <p className="mt-2 text-sm text-[#73858c]">
                  Veja e altere os dados de {selected.name}.
                </p>
                <CampaignDetailsForm key={selected.id} campaign={selected} />
              </section>
              <aside className="space-y-5">
                <section className="rounded-2xl border border-[#e1e1db] bg-white p-5">
                  <h3 className="font-semibold">Busca e automação</h3>
                  <p className="mt-2 text-sm leading-6 text-[#73858c]">
                    Estratégia atual:{" "}
                    {
                      strategyLabels[
                        normalizeDiscoveryStrategy(selected.discoveryStrategy)
                      ]
                    }
                    . Altere nicho, região, perfis-base, critérios e recorrência
                    na aba Busca.
                  </p>
                  <Link
                    href={href("busca")}
                    className={secondaryButton + " mt-4"}
                  >
                    Editar critérios de busca
                    <ArrowRight size={14} />
                  </Link>
                </section>
                <section className="rounded-2xl border border-[#cfe2d6] bg-[#edf7f1] p-5">
                  <h3 className="font-semibold">Salvar não inicia uma ação</h3>
                  <p className="mt-2 text-sm leading-6 text-[#657780]">
                    Editar estes dados não ativa a campanha, não faz uma nova
                    busca e não envia mensagens. Os controles de busca
                    automática e de envio ficam na aba Busca.
                  </p>
                </section>
              </aside>
            </div>
          )}
          {tab === "busca" && (
            <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
              <section className="rounded-2xl border border-[#e1e1db] bg-white p-5 sm:p-6">
                <h3 className="text-lg font-semibold">
                  Estratégia e critérios
                </h3>
                <p className="mt-1 text-sm text-[#73858c]">
                  Configure como encontrar o público de {selected.name}.
                </p>
                <DiscoverySettingsForm
                  key={selected.id}
                  campaignId={selected.id}
                  enabled={selected.discoveryEnabled}
                  strategy={normalizeDiscoveryStrategy(
                    selected.discoveryStrategy,
                  )}
                  keywords={parseStoredDiscoveryTerms(
                    selected.discoveryKeywords,
                  )}
                  hashtags={parseStoredDiscoveryTerms(
                    selected.discoveryHashtags,
                  )}
                  locations={parseStoredDiscoveryTerms(
                    selected.discoveryLocations,
                  )}
                  baseProfiles={parseInstagramBaseProfiles(
                    parseStoredDiscoveryTerms(
                      selected.discoveryBaseProfiles,
                    ).join("\n"),
                  )}
                  minimumBaseFollowers={selected.discoveryMinimumBaseFollowers}
                  localNiche={selected.discoveryLocalNiche || ""}
                  localLocation={selected.discoveryLocalLocation || ""}
                  dailyLimit={selected.discoveryDailyLimit}
                  minimumScore={selected.discoveryMinimumScore}
                  intervalHours={selected.discoveryIntervalHours}
                />
              </section>
              <aside className="space-y-5">
                <section className="rounded-2xl border border-[#e1e1db] bg-white p-5">
                  <h3 className="font-semibold">Busca automática</h3>
                  <p className="mt-2 text-sm leading-6 text-[#73858c]">
                    {selected.discoveryEnabled
                      ? `Ativa · intervalo de ${selected.discoveryIntervalHours} horas.`
                      : "Inativa. Salve os critérios antes de ativar."}
                  </p>
                  <form action={setCampaignDiscoveryEnabled} className="mt-4">
                    <ContextFields campaignId={selected.id} tab="busca" />
                    <input
                      type="hidden"
                      name="campaignId"
                      value={selected.id}
                    />
                    <input
                      type="hidden"
                      name="enabled"
                      value={selected.discoveryEnabled ? "false" : "true"}
                    />
                    <SubmitButton
                      className={secondaryButton}
                      pendingLabel="Alterando…"
                    >
                      {selected.discoveryEnabled
                        ? "Pausar busca automática"
                        : "Ativar busca automática"}
                    </SubmitButton>
                  </form>
                </section>
                <section className="rounded-2xl border border-[#e1e1db] bg-white p-5">
                  <h3 className="font-semibold">Envio de mensagens</h3>
                  <p className="mt-2 text-sm leading-6 text-[#73858c]">
                    {selected.outboundEnabled
                      ? "Habilitado para mensagens revisadas e agendadas."
                      : "Desativado nesta campanha."}
                  </p>
                  <p className="mt-2 text-xs text-[#73858c]">
                    Descobrir perfis e preparar rascunhos não envia mensagens.
                  </p>
                  <form action={setOutboundCampaignEnabled} className="mt-4">
                    <ContextFields campaignId={selected.id} tab="busca" />
                    <input
                      type="hidden"
                      name="campaignId"
                      value={selected.id}
                    />
                    <input
                      type="hidden"
                      name="enabled"
                      value={selected.outboundEnabled ? "false" : "true"}
                    />
                    <SubmitButton
                      className={secondaryButton}
                      pendingLabel="Alterando…"
                      disabled={!selected.outboundEnabled && !globallyReady}
                    >
                      {selected.outboundEnabled
                        ? "Pausar envios"
                        : "Habilitar envios"}
                    </SubmitButton>
                  </form>
                  {!globallyReady && (
                    <p className="mt-3 text-xs text-[#846214]">
                      A liberação global de envios está desativada.
                    </p>
                  )}
                </section>
              </aside>
            </div>
          )}
          {tab === "historico" && (
            <div className="space-y-5">
              <section className="overflow-hidden rounded-2xl border border-[#e1e1db] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ec] p-5">
                  <div>
                    <h3 className="font-semibold">Histórico de buscas</h3>
                    <p className="mt-1 text-xs text-[#73858c]">
                      As métricas são consolidadas ao concluir cada execução.
                    </p>
                  </div>
                  <form action="/comercial/campanhas" method="get">
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="aba" value="historico" />
                    <button className={secondaryButton} type="submit">
                      Atualizar resultados
                    </button>
                  </form>
                </div>
                {campaignRuns.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-[#f8f9f6] text-xs text-[#73858c]">
                        <tr>
                          {[
                            "Início",
                            "Status",
                            "Analisados",
                            "Qualificados",
                            "Novos perfis",
                            "Sites",
                            "Descartados",
                          ].map((label) => (
                            <th
                              scope="col"
                              className="px-4 py-3 font-medium"
                              key={label}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf0ec]">
                        {campaignRuns.map((run) => (
                          <tr key={run.id}>
                            <td className="px-4 py-4 text-xs">
                              {formatDateTime(run.startedAt)}
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge status={run.status} />
                              {run.stopReason && (
                                <p className="mt-2 max-w-xs text-xs text-[#73858c]">
                                  {localStopLabel(run.stopReason)}
                                </p>
                              )}
                              {run.followerSearchProgress && (
                                <p className="mt-2 max-w-xs text-xs text-[#73858c]">
                                  {followersProgressSummary(
                                    run.followerSearchProgress,
                                  )}
                                </p>
                              )}
                              {run.localSearchProgress && (
                                <p className="mt-2 max-w-xs text-xs text-[#73858c]">
                                  {localProgressSummary(
                                    run.localSearchProgress,
                                  )}
                                </p>
                              )}
                              {run.error && (
                                <p className="mt-2 max-w-xs text-xs text-red-700">
                                  {run.error}
                                </p>
                              )}
                            </td>
                            {[
                              run.profilesInspected,
                              run.profilesQualified,
                              run.profilesCreated,
                              run.websiteOpportunitiesCreated,
                              run.skippedLowScore +
                                run.skippedBlocked +
                                run.skippedDuplicates,
                            ].map((value, i) => (
                              <td key={i} className="px-4 py-4 tabular-nums">
                                {run.status === "running" ? "—" : value}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8">
                    <EmptyState
                      title="Nenhuma busca realizada"
                      description="Ative a busca na aba Busca para encontrar os primeiros perfis."
                    />
                  </div>
                )}
              </section>
              <section className="rounded-2xl border border-[#e1e1db] bg-white p-5">
                <h3 className="font-semibold">Desempenho dos critérios</h3>
                <div className="mt-4 space-y-3">
                  {discoveryQueryStats
                    .filter((i) => i.campaignId === selected.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap justify-between gap-2 border-b border-[#edf0ec] pb-3 text-sm"
                      >
                        <span>{item.query}</span>
                        <span className="text-[#73858c]">
                          {item.profilesCreated} novos /{" "}
                          {item.profilesInspected} perfis analisados
                        </span>
                      </div>
                    ))}
                </div>
                {!discoveryQueryStats.some(
                  (i) => i.campaignId === selected.id,
                ) && (
                  <p className="mt-3 text-sm text-[#73858c]">
                    Os critérios aparecerão após a primeira execução.
                  </p>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
