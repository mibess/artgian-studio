"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Clock3, Truck } from "lucide-react";
import { formatBrl, type Product } from "../../lib/catalog";
import type { CartItem } from "../../lib/cart";
import type { ShippingOption } from "../../lib/shipping-provider";
import { formatPostalCode } from "../../lib/addresses/schema";
import { deliveryEstimate, fulfillmentSummary } from "../../lib/product-fulfillment";
import { whatsappHref } from "../../lib/custom-order";

type Quote = {
  options: ShippingOption[];
  preparationDays: number | null;
};

export default function ProductDelivery({
  product,
  item,
  valid,
}: {
  product: Product;
  item: CartItem;
  valid: boolean;
}) {
  const summary = fulfillmentSummary(product);
  const [postalCode, setPostalCode] = useState("");
  const StatusIcon = summary.readyToShip ? CheckCircle2 : Clock3;

  return (
    <section
      aria-label="Entrega e disponibilidade"
      className="mb-7 rounded-2xl border border-[#193244]/15 bg-white/80 p-4 text-[#193244] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <StatusIcon
          size={21}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 ${summary.readyToShip ? "text-emerald-700" : "text-[#9b7332]"}`}
        />
        <div>
          <p className="text-sm font-bold">{summary.label}</p>
          <p className="mt-1 text-sm leading-6">{summary.detail}</p>
          <p className="mt-1 text-xs leading-5 text-[#526273]">
            O transporte é somado ao prazo de envio e depende do seu CEP.
          </p>
          {summary.readyToShip === null && (
            <a
              href={whatsappHref(`Olá, Artgian! Qual é o prazo para envio de ${product.name}?`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-8 items-center text-xs font-semibold underline underline-offset-4"
            >
              Consultar prazo pelo WhatsApp
            </a>
          )}
        </div>
      </div>
      <DeliveryQuote
        key={JSON.stringify(item)}
        item={item}
        valid={valid}
        postalCode={postalCode}
        onPostalCodeChange={setPostalCode}
      />
    </section>
  );
}

function DeliveryQuote({
  item,
  valid,
  postalCode,
  onPostalCodeChange,
}: {
  item: CartItem;
  valid: boolean;
  postalCode: string;
  onPostalCodeChange: (value: string) => void;
}) {
  const id = useId();
  const request = useRef<AbortController | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // A changed variant, quantity or personalization remounts this calculator.
  // The CEP remains in the parent; obsolete requests and quotes are discarded.
  useEffect(() => () => request.current?.abort(), []);

  function changePostalCode(value: string) {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setQuote(null);
    setError("");
    onPostalCodeChange(formatPostalCode(value));
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) {
      setError("Confira as opções e preencha a personalização antes de calcular.");
      return;
    }
    const normalizedPostalCode = postalCode.replace(/\D/g, "");
    if (normalizedPostalCode.length !== 8) {
      setError("Informe um CEP com 8 dígitos.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setQuote(null);
    setError("");
    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [item], postalCode: normalizedPostalCode }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      const result = await response.json();
      if (request.current !== controller || controller.signal.aborted) return;
      if (!response.ok) {
        throw new Error(
          response.status < 500 && result.error
            ? result.error
            : "Não foi possível calcular a entrega agora. Tente novamente em instantes.",
        );
      }
      if (!Array.isArray(result.options) || !result.options.length) {
        throw new Error("Não encontramos uma modalidade de entrega para este CEP. Confira o número e tente novamente.");
      }
      setQuote({
        options: result.options,
        // Older responses must never turn an unknown preparation time into zero.
        preparationDays: Number.isInteger(result.preparationDays) && result.preparationDays >= 0
          ? result.preparationDays
          : null,
      });
    } catch (cause) {
      if (request.current !== controller || controller.signal.aborted) return;
      setError(cause instanceof Error && cause.name === "TimeoutError"
        ? "O cálculo demorou mais que o esperado. Tente novamente."
        : cause instanceof Error && cause.name !== "TypeError"
          ? cause.message
          : "Não foi possível calcular a entrega agora. Tente novamente em instantes.");
    } finally {
      if (request.current === controller && !controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[#193244]/10 pt-4">
      <form onSubmit={calculate} noValidate>
        <label htmlFor={id} className="flex items-center gap-2 text-xs font-semibold">
          <Truck size={16} aria-hidden="true" />
          Calcule quando chega no seu CEP
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id={id}
            value={postalCode}
            onChange={event => changePostalCode(event.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            maxLength={9}
            aria-describedby={!valid ? `${id}-hint` : undefined}
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#193244]/20 bg-white px-3 text-sm outline-none focus:border-[#9b7332] focus:ring-2 focus:ring-[#9b7332]/20"
          />
          <button
            type="submit"
            disabled={loading || !valid}
            aria-busy={loading}
            className="h-11 shrink-0 rounded-xl bg-[#193244] px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Calculando…" : "Calcular entrega"}
          </button>
        </div>
        {!valid && (
          <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-[#526273]">
            Preencha a personalização abaixo para calcular a entrega.
          </p>
        )}
      </form>
      <div aria-live="polite" aria-atomic="true">
        {error && <p role="alert" className="mt-3 text-xs leading-5 text-red-800">{error}</p>}
        {quote && (
          <div className="mt-4 space-y-3">
            {quote.options.map(option => {
              const estimate = deliveryEstimate(quote.preparationDays, option.deliveryTimeDays);
              return (
                <div key={option.serviceId} className="rounded-xl bg-[#f7f3ea] p-3">
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span>{option.companyName} · {option.serviceName}</span>
                    <strong>{option.priceCents === 0 ? "Frete grátis" : formatBrl(option.priceCents)}</strong>
                  </div>
                  <p className="mt-2 text-sm font-bold">{estimate.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#526273]">{estimate.detail}</p>
                </div>
              );
            })}
            <p className="text-xs leading-5 text-[#526273]">
              Estimativa para as opções escolhidas. Frete e prazo são conferidos novamente no checkout.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
