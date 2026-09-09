"use client";

import { Building2, Search, Users } from "lucide-react";
import { useState } from "react";
import type { DiscoveryStrategy } from "../../../src/features/outbound/discovery-domain";
import { SubmitButton } from "../../components/PendingButton";
import { saveCampaignDiscoverySettings } from "../actions";

const strategies: Array<{
  value: DiscoveryStrategy;
  title: string;
  description: string;
  icon: typeof Search;
}> = [
  {
    value: "instagram_search",
    title: "Termos no Instagram",
    description: "Alterna palavras, hashtags e regiões.",
    icon: Search,
  },
  {
    value: "instagram_followers",
    title: "Seguidores de perfis-base",
    description: "Busca pessoas que seguem referências grandes.",
    icon: Users,
  },
  {
    value: "local_business",
    title: "Empresas locais",
    description: "Pesquisa Google Maps por nicho e cidade.",
    icon: Building2,
  },
];

type Props = {
  campaignId: string;
  enabled: boolean;
  strategy: DiscoveryStrategy;
  keywords: string[];
  hashtags: string[];
  locations: string[];
  baseProfiles: string[];
  minimumBaseFollowers: number;
  localNiche: string;
  localLocation: string;
  dailyLimit: number;
  minimumScore: number;
  intervalHours: number;
};

const inputClass = "h-10 w-full rounded-xl border border-[#dfe2de] bg-white px-3 text-xs outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4]";

export function DiscoverySettingsForm(props: Props) {
  const [strategy, setStrategy] = useState<DiscoveryStrategy>(props.strategy);

  return (
    <form action={saveCampaignDiscoverySettings} className="mt-4 space-y-4">
      <input type="hidden" name="campaignId" value={props.campaignId} />
      <input type="hidden" name="selectedCampaign" value={props.campaignId} />
      <input type="hidden" name="returnTab" value="busca" />
      <input type="hidden" name="discoveryEnabled" value={props.enabled ? "true" : "false"} />

      <fieldset>
        <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#718088]">
          Como encontrar oportunidades
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {strategies.map((item) => {
            const Icon = item.icon;
            const selected = strategy === item.value;
            return (
              <label
                className={`cursor-pointer focus-within:ring-2 focus-within:ring-[#193848] rounded-xl border p-3 transition ${selected ? "border-[#4f9678] bg-[#eef8f3] ring-1 ring-[#4f9678]" : "border-[#dfe2de] bg-white hover:border-[#b9ccc3]"}`}
                key={item.value}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  name="discoveryStrategy"
                  onChange={() => setStrategy(item.value)}
                  type="radio"
                  value={item.value}
                />
                <Icon aria-hidden size={15} className={selected ? "text-[#2f7c60]" : "text-[#819097]"} />
                <span className="mt-2 block text-xs font-bold text-[#294653]">{item.title}</span>
                <span className="mt-1 block text-[11px] leading-4 text-[#7c8a90]">{item.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className={strategy === "instagram_search" ? "space-y-3" : "hidden"}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#718088]">Palavras-chave</span>
          <textarea name="discoveryKeywords" rows={2} defaultValue={props.keywords.join(", ")} placeholder="presente personalizado, decoração geek" className="w-full resize-y rounded-xl border border-[#dfe2de] bg-white p-3 text-xs leading-4 outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4]" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#718088]">Hashtags</span>
            <input name="discoveryHashtags" defaultValue={props.hashtags.join(", ")} placeholder="decoracaogeek" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#718088]">Regiões</span>
            <input name="discoveryLocations" defaultValue={props.locations.join(", ")} placeholder="Brasil, São Paulo" className={inputClass} />
          </label>
        </div>
      </div>

      <div className={strategy === "instagram_followers" ? "space-y-3 rounded-xl bg-[#eef4fb] p-3" : "hidden"}>
        <p className="text-xs leading-4 text-[#526b78]">
          O sistema valida publicamente cada perfil-base e só abre a lista de seguidores quando ele supera o limite abaixo.
        </p>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#587184]">Perfis-base</span>
          <textarea name="discoveryBaseProfiles" rows={3} defaultValue={props.baseProfiles.map((item) => `@${item}`).join("\n")} placeholder={"@perfil_referencia\nhttps://instagram.com/outra_referencia"} className="w-full resize-y rounded-xl border border-[#cedce7] bg-white p-3 text-xs leading-4 outline-none focus:border-[#6a91ad] focus:ring-2 focus:ring-[#dce8f6]" />
          <span className="mt-1 block text-[11px] text-[#718088]">Até 8 perfis, um por linha. Links do Instagram também são aceitos.</span>
        </label>
        <label className="block sm:max-w-[240px]">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#587184]">Mínimo de seguidores</span>
          <input name="discoveryMinimumBaseFollowers" type="number" min="10000" max="1000000000" step="10000" defaultValue={props.minimumBaseFollowers} className={inputClass} />
          <span className="mt-1 block text-[11px] text-[#718088]">A regra é “maior que”, não “maior ou igual”.</span>
        </label>
      </div>

      <div className={strategy === "local_business" ? "space-y-3 rounded-xl bg-[#fff7df] p-3" : "hidden"}>
        <p className="text-xs leading-4 text-[#715d2a]">
          Pesquisa por nicho e cidade no Google Maps, incluindo Resultados da Web e site da empresa. Os perfis qualificados aparecem na aba Público.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#78652f]">Nicho</span>
            <input name="discoveryLocalNiche" defaultValue={props.localNiche} placeholder="Mecânica automotiva" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#78652f]">Cidade ou região</span>
            <input name="discoveryLocalLocation" defaultValue={props.localLocation} placeholder="Brodowski, SP" className={inputClass} />
          </label>
        </div>
        <p className="text-[11px] leading-4 text-[#806f43]">Campanhas locais usam automaticamente o funil de parceiros/empresas.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#718088]">Resultados/dia</span>
          <input name="discoveryDailyLimit" type="number" min="1" max="30" defaultValue={props.dailyLimit} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#718088]">Score mínimo</span>
          <input name="discoveryMinimumScore" type="number" min="0" max="100" defaultValue={props.minimumScore} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#718088]">Intervalo (h)</span>
          <input name="discoveryIntervalHours" type="number" min="6" max="168" defaultValue={props.intervalHours} className={inputClass} />
        </label>
      </div>
      <SubmitButton pendingLabel="Salvando…" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#193848] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">
        Salvar estratégia e critérios
      </SubmitButton>
    </form>
  );
}
