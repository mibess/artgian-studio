"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import type { campaigns } from "../../../db/schema";
import { updateCampaignDetails } from "../actions";

type Details = Pick<
  typeof campaigns.$inferSelect,
  | "id"
  | "name"
  | "source"
  | "segment"
  | "funnelType"
  | "dailyLimit"
  | "operatingHours"
  | "operatingTimezone"
  | "discoveryStrategy"
>;
const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-[#dfe2de] bg-white px-3 text-sm outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4] disabled:bg-[#f3f5f2]";

export function CampaignDetailsForm({ campaign }: { campaign: Details }) {
  const [state, action, pending] = useActionState(updateCampaignDetails, {});
  const local = campaign.discoveryStrategy === "local_business";
  const [values, setValues] = useState({
    name: campaign.name,
    source: campaign.source,
    segment: campaign.segment || "",
    funnelType: local ? "partner" : campaign.funnelType,
    dailyLimit: String(campaign.dailyLimit),
    operatingHours: campaign.operatingHours,
    operatingTimezone: campaign.operatingTimezone,
  });
  const field = (name: keyof typeof values) => ({
    value: values[name],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });
  return (
    <form
      action={action}
      aria-label="Editar dados da campanha"
      className="mt-5 space-y-5"
    >
      <input type="hidden" name="campaignId" value={campaign.id} />
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {state.success}
        </p>
      )}
      <label className="block text-xs font-semibold text-[#526b78]">
        Nome da campanha
        <input
          name="name"
          required
          minLength={3}
          maxLength={120}
          {...field("name")}
          className={inputClass}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#526b78]">
          Origem
          <input
            name="source"
            required
            minLength={2}
            maxLength={120}
            {...field("source")}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold text-[#526b78]">
          Segmento
          <input
            name="segment"
            maxLength={120}
            {...field("segment")}
            placeholder="Manicure e pedicure"
            className={inputClass}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#526b78]">
          Funil
          <select
            name="funnelType"
            {...field("funnelType")}
            disabled={local}
            className={inputClass}
          >
            <option value="consumer">Clientes</option>
            <option value="partner">Parceiros</option>
          </select>
        </label>
        {local && <input type="hidden" name="funnelType" value="partner" />}
        <label className="block text-xs font-semibold text-[#526b78]">
          Limite de contatos por dia
          <input
            name="dailyLimit"
            type="number"
            required
            min={1}
            max={30}
            step={1}
            {...field("dailyLimit")}
            className={inputClass}
          />
        </label>
      </div>
      {local && (
        <p className="text-xs leading-5 text-[#73858c]">
          Empresas locais usam o funil de parceiros. Para mudar o tipo de busca,
          abra a aba Busca.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#526b78]">
          Horário de contatos
          <input
            name="operatingHours"
            required
            {...field("operatingHours")}
            placeholder="09:00-18:00"
            pattern="[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold text-[#526b78]">
          Fuso horário
          <input
            name="operatingTimezone"
            required
            maxLength={120}
            {...field("operatingTimezone")}
            list="campaign-timezones"
            className={inputClass}
          />
          <datalist id="campaign-timezones">
            <option value="America/Sao_Paulo" />
            <option value="America/Manaus" />
            <option value="America/Rio_Branco" />
            <option value="America/Noronha" />
          </datalist>
        </label>
      </div>
      <p className="text-xs leading-5 text-[#73858c]">
        Segmento e funil orientam as próximas validações; os prospectos e
        rascunhos existentes não são reclassificados. Limite e horário valem
        para os próximos contatos, respeitando também as travas globais.
      </p>
      <button
        disabled={pending}
        className="rounded-xl bg-[#193848] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Salvar configurações"}
      </button>
    </form>
  );
}
