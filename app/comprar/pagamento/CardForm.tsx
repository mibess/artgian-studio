"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { formatBrl } from "../../../lib/catalog";
import type { CardPaymentData } from "../../../lib/payment-types";

const inputClass = "mt-2 h-12 w-full min-w-0 rounded-xl border border-[#0b2447]/20 bg-white px-4 text-base text-[#0b2447] outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#d8bc7b]/25 disabled:opacity-60";
const secureClass = `${inputClass} py-3 [&_iframe]:h-6 [&_iframe]:w-full focus-within:border-[#b88a3b] focus-within:ring-2 focus-within:ring-[#d8bc7b]/25`;

export default function CardForm({ publicKey, sdkReady, totalCents, payer, busy, onSubmit, onBusy }: {
  publicKey: string;
  sdkReady: boolean;
  totalCents: number;
  payer: { name: string; email: string; document: string };
  busy: boolean;
  onSubmit: (card: CardPaymentData) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tokenizing, setTokenizing] = useState(false);
  const instance = useRef<MercadoPagoCardForm | null>(null);
  const send = useEffectEvent(async (data: MercadoPagoCardFormData) => {
    setTokenizing(false);
    onBusy(false);
    if (!data.token) { setError("Confira os dados do cartão antes de continuar."); return; }
    await onSubmit({ token: data.token, paymentMethodId: data.paymentMethodId, issuerId: data.issuerId || undefined, installments: Number(data.installments), identificationNumber: data.identificationNumber.replace(/\D/g, "") });
  });
  const fail = useEffectEvent(() => {
    setTokenizing(false);
    onBusy(false);
    setError("Confira os campos do cartão. Se o problema continuar, tente novamente ou escolha Pix ou boleto.");
  });

  useEffect(() => {
    if (!sdkReady || !window.MercadoPago) return;
    let active = true;
    const style = { fontSize: "16px", fontFamily: "Arial, sans-serif", color: "#0b2447", placeholderColor: "#8792a3", height: "24px" };
    const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
    try {
      const form = mp.cardForm({
        amount: (totalCents / 100).toFixed(2), iframe: true,
        form: {
          id: "artgian-card-form",
          cardNumber: { id: "card-number", placeholder: "0000 0000 0000 0000", style },
          expirationDate: { id: "card-expiration", placeholder: "MM/AA", style },
          securityCode: { id: "card-security", placeholder: "CVV", style },
          cardholderName: { id: "card-name", placeholder: "Como está no cartão" },
          cardholderEmail: { id: "card-email" },
          issuer: { id: "card-issuer", placeholder: "Banco do cartão" },
          installments: { id: "card-installments", placeholder: "Selecione as parcelas" },
          identificationType: { id: "card-document-type" },
          identificationNumber: { id: "card-document", placeholder: "CPF do titular" },
        },
        callbacks: {
          onFormMounted(error) { if (active && error) fail(); },
          onReady() {
            if (!active) return;
            const documentType = document.getElementById("card-document-type") as HTMLSelectElement | null;
            if (documentType) { documentType.value = "CPF"; documentType.dispatchEvent(new Event("change", { bubbles: true })); }
            setReady(true);
          },
          onSubmit(event) { event.preventDefault(); if (active) void send(form.getCardFormData()); },
          onError() { if (active) fail(); },
        },
      });
      instance.current = form;
      return () => { active = false; instance.current = null; form.unmount(); };
    } catch { queueMicrotask(() => { if (active) fail(); }); }
    return () => { active = false; };
  }, [publicKey, sdkReady, totalCents]);

  return (
    <form id="artgian-card-form" onSubmitCapture={event => {
      // CardForm submits again after tokenization. Let that SDK event reach its
      // listener; the disabled button and server idempotency prevent duplicates.
      if (!ready || busy) { event.preventDefault(); event.stopPropagation(); return; }
      setError(""); setTokenizing(true); onBusy(true);
    }} className="mt-7" aria-label="Pagamento com cartão">
      {!ready && <p role="status" className="mb-5 flex items-center gap-2 text-sm text-[#647087]"><span className="ui-spinner" /> Carregando os campos seguros…</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <div className="col-span-2">
          <p id="card-number-label" className="text-xs font-semibold">Número do cartão</p>
          <div id="card-number" data-mp-secure-field="cardNumber" role="group" aria-labelledby="card-number-label" className={secureClass} />
        </div>
        <div>
          <p id="card-expiration-label" className="text-xs font-semibold">Validade</p>
          <div id="card-expiration" data-mp-secure-field="expirationDate" role="group" aria-labelledby="card-expiration-label" className={secureClass} />
        </div>
        <div>
          <p id="card-security-label" className="text-xs font-semibold">Código de segurança</p>
          <div id="card-security" data-mp-secure-field="securityCode" role="group" aria-labelledby="card-security-label" className={secureClass} />
        </div>
        <label htmlFor="card-name" className="col-span-2 text-xs font-semibold">Nome do titular
          <input id="card-name" autoComplete="cc-name" defaultValue={payer.name} required className={inputClass} />
        </label>
        <label htmlFor="card-document" className="col-span-2 text-xs font-semibold">CPF do titular
          <input id="card-document" inputMode="numeric" maxLength={14} pattern="[0-9]{11}" onInput={event => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 11); }} defaultValue={payer.document} required className={inputClass} />
        </label>
        <label htmlFor="card-issuer" className="col-span-2 text-xs font-semibold">Banco emissor
          <select id="card-issuer" required className={inputClass} />
        </label>
        <label htmlFor="card-installments" className="col-span-2 text-xs font-semibold">Parcelamento
          <select id="card-installments" required className={inputClass} />
          <span className="mt-2 block text-xs font-normal leading-5 text-[#647087]">As opções e eventuais juros aparecem após informar o cartão.</span>
        </label>
      </div>
      <input id="card-email" type="hidden" value={payer.email} />
      <select id="card-document-type" aria-label="Tipo de documento do titular" className="hidden" />
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={!ready || busy || tokenizing} aria-busy={busy || tokenizing} className="mt-7 flex min-h-14 w-full items-center justify-between gap-3 rounded-full bg-[#0b2447] py-2 pr-2 pl-6 text-sm font-semibold text-white transition hover:bg-[#173b68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:opacity-60">
        <span>{busy || tokenizing ? "Processando pagamento…" : `Pagar ${formatBrl(totalCents)}`}</span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#d8bc7b] text-[#0b2447]">{busy || tokenizing ? <span className="ui-spinner" /> : <ArrowRight size={20} />}</span>
      </button>
    </form>
  );
}
