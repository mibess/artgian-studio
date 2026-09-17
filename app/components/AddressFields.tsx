"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { BRAZIL_STATES, formatPostalCode, type AddressDraft } from "../../lib/addresses/schema";

const inputClass = "h-12 w-full min-w-0 rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 text-sm outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15 read-only:opacity-75";
export default function AddressFields({ value, onChange, readOnly = false, includePostalCode = true, includeLabel = false }: {
  value: AddressDraft;
  onChange: (value: AddressDraft) => void;
  readOnly?: boolean;
  includePostalCode?: boolean;
  includeLabel?: boolean;
}) {
  const cep = value.postalCode.replace(/\D/g, "");
  const previousCep = useRef(cep);
  const [lookup, setLookup] = useState({ cep: "", message: "" });
  const currentAddress = useEffectEvent(() => value);
  const applyResult = useEffectEvent((baseline: AddressDraft, result: Partial<AddressDraft>) => {
    const next = { ...value };
    // Keep any fields the customer edited while the request was in flight.
    for (const field of ["streetAddress", "neighborhood", "city", "state"] as const) {
      if (value[field] === baseline[field] && typeof result[field] === "string") next[field] = result[field];
    }
    onChange(next);
  });
  useEffect(() => {
    if (previousCep.current === cep) return;
    previousCep.current = cep;
    if (readOnly || cep.length !== 8) return;
    const controller = new AbortController();
    const baseline = { ...currentAddress() };
    let active = true;
    const timer = setTimeout(async () => {
      setLookup({ cep, message: "Buscando endereço…" });
      try {
        const response = await fetch(`/api/addresses/lookup?cep=${cep}`, { signal: controller.signal });
        const result = await response.json();
        if (!active) return;
        if (!response.ok || !result.address) throw new Error(result.error || "Consulta de CEP indisponível. Preencha o endereço manualmente.");
        applyResult(baseline, result.address);
        setLookup({ cep, message: "Endereço localizado. Confira os dados e informe número e complemento, se houver." });
      } catch (error) {
        if (active) setLookup({ cep, message: error instanceof Error ? error.message : "Consulta de CEP indisponível. Preencha o endereço manualmente." });
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [cep, readOnly]);
  const fields: { name: keyof AddressDraft; label: string; max: number; span: string; autoComplete?: string; optional?: boolean; placeholder?: string }[] = [
    ...(includeLabel ? [{ name: "label" as const, label: "Identificação (opcional)", max: 40, span: "sm:col-span-6", optional: true, placeholder: "Ex.: Casa, Trabalho" }] : []),
    ...(includePostalCode ? [{ name: "postalCode" as const, label: "CEP", max: 9, span: "sm:col-span-2", autoComplete: "postal-code", placeholder: "00000-000" }] : []),
    { name: "streetAddress", label: "Endereço", max: 180, span: "sm:col-span-5", autoComplete: "address-line1" },
    { name: "addressNumber", label: "Número", max: 20, span: "", placeholder: "Nº ou S/N" },
    { name: "addressComplement", label: "Complemento", max: 80, span: "sm:col-span-3", autoComplete: "address-line2", optional: true },
    { name: "neighborhood", label: "Bairro", max: 80, span: "sm:col-span-3" },
    { name: "city", label: "Cidade", max: 80, span: "sm:col-span-5", autoComplete: "address-level2" },
  ];
  return <>
    {!readOnly && lookup.cep === cep && lookup.message && <p role="status" aria-live="polite" className="sm:col-span-6 text-xs text-[#647087]">{lookup.message}</p>}
    {fields.map(field => <label key={field.name} className={`min-w-0 ${field.span}`}>
      <span className="mb-2 block text-xs font-semibold">{field.label}</span>
      <input className={inputClass} name={field.name} value={field.name === "postalCode" ? formatPostalCode(value[field.name]) : value[field.name]}
        onChange={event => onChange({ ...value, [field.name]: field.name === "postalCode" ? formatPostalCode(event.target.value) : event.target.value })}
        autoComplete={field.autoComplete} required={!field.optional} maxLength={field.max} readOnly={readOnly}
        inputMode={field.name === "postalCode" ? "numeric" : undefined} pattern={field.name === "postalCode" ? "[0-9]{5}-?[0-9]{3}" : undefined} placeholder={field.placeholder} />
    </label>)}
    <label className="min-w-0">
      <span className="mb-2 block text-xs font-semibold">UF</span>
      {readOnly ? <input className={inputClass} name="state" value={value.state} readOnly /> :
        <select aria-label="UF" className={inputClass} name="state" value={value.state} onChange={event => onChange({ ...value, state: event.target.value })} autoComplete="address-level1" required>
          <option value="" disabled>UF</option>
          {BRAZIL_STATES.map(state => <option key={state} value={state}>{state}</option>)}
        </select>}
    </label>
  </>;
}
