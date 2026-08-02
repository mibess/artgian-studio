"use client";

import { FormEvent, useState } from "react";
import { formatBrl } from "../../lib/catalog";
import type { ShippingOption } from "../../lib/melhor-envio";
import ProductColorImage from "../components/ProductColorImage";

type CheckoutFormProps = {
  productId: string;
  productName: string;
  productImage: string;
  productAlt: string;
  subtotalCents: number;
  color: string;
  colorName: string;
  quantity: number;
  personalization: string | null;
};

type QuoteResponse = {
  postalCode?: string;
  options?: ShippingOption[];
  error?: string;
};

function onlyPostalCodeDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export default function CheckoutForm({
  productId,
  productName,
  productImage,
  productAlt,
  subtotalCents,
  color,
  colorName,
  quantity,
  personalization,
}: CheckoutFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [quotedPostalCode, setQuotedPostalCode] = useState("");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");

  const selectedShipping = shippingOptions.find(
    (option) => option.serviceId === selectedServiceId,
  );
  const totalCents = subtotalCents + (selectedShipping?.priceCents ?? 0);

  function handlePostalCodeChange(value: string) {
    setPostalCode(value);
    if (onlyPostalCodeDigits(value) !== quotedPostalCode) {
      setShippingOptions([]);
      setSelectedServiceId("");
    }
  }

  async function calculateQuote() {
    const normalizedPostalCode = onlyPostalCodeDigits(postalCode);
    if (normalizedPostalCode.length !== 8) {
      setShippingError("Informe um CEP válido para calcular a entrega.");
      return;
    }

    setQuoting(true);
    setShippingError("");
    setError("");

    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          color,
          quantity,
          personalization,
          postalCode: normalizedPostalCode,
        }),
      });
      const result = (await response.json()) as QuoteResponse;

      if (!response.ok || !result.options?.length || !result.postalCode) {
        throw new Error(result.error || "Não encontramos entrega para esse CEP.");
      }

      setShippingOptions(result.options);
      setQuotedPostalCode(result.postalCode);
      setSelectedServiceId(result.options[0].serviceId);
    } catch (quoteError) {
      setShippingOptions([]);
      setSelectedServiceId("");
      setShippingError(
        quoteError instanceof Error
          ? quoteError.message
          : "Não foi possível calcular a entrega.",
      );
    } finally {
      setQuoting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedShipping || quotedPostalCode !== onlyPostalCodeDigits(postalCode)) {
      setShippingError("Calcule e escolha uma modalidade de entrega.");
      return;
    }

    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          productId,
          color,
          quantity,
          personalization,
          shippingServiceId: selectedShipping.serviceId,
          shippingPriceCents: selectedShipping.priceCents,
        }),
      });
      const result = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.error || "Não foi possível iniciar o pagamento.");
      }

      window.location.assign(result.checkoutUrl);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível iniciar o pagamento.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.08fr_.72fr]">
      <form
        className="space-y-9 rounded-[2rem] border border-white bg-white/70 p-6 shadow-[0_20px_60px_rgba(11,36,71,.07)] sm:p-9"
        onSubmit={handleSubmit}
      >
        <section>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#b88a3b] font-serif text-sm text-[#b88a3b]">
              1
            </span>
            <h2 className="font-serif text-2xl font-normal">Seus dados</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold">Nome completo</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" name="customerName" autoComplete="name" required />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">E-mail</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" type="email" name="customerEmail" autoComplete="email" required />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">Telefone</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" type="tel" name="customerPhone" autoComplete="tel" placeholder="(00) 00000-0000" required />
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#b88a3b] font-serif text-sm text-[#b88a3b]">
              2
            </span>
            <h2 className="font-serif text-2xl font-normal">Entrega</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-6">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold">CEP</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="postalCode"
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="00000-000"
                value={postalCode}
                onChange={(event) => handlePostalCodeChange(event.target.value)}
                required
              />
            </label>
            <div className="flex items-end sm:col-span-4">
              <button
                className="h-12 rounded-full border border-[#0b2447]/20 px-5 text-xs font-semibold transition hover:border-[#b88a3b] disabled:cursor-wait disabled:opacity-60"
                type="button"
                onClick={calculateQuote}
                disabled={quoting}
              >
                {quoting ? "Calculando…" : "Calcular entrega"}
              </button>
            </div>

            {shippingError && (
              <p className="sm:col-span-6 rounded-xl border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {shippingError}
              </p>
            )}

            {shippingOptions.length > 0 && (
              <fieldset className="sm:col-span-6 space-y-2">
                <legend className="mb-2 text-xs font-semibold">Escolha a modalidade</legend>
                {shippingOptions.map((option) => (
                  <label
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition ${
                      selectedServiceId === option.serviceId
                        ? "border-[#b88a3b] bg-[#d8bc7b]/10"
                        : "border-[#0b2447]/10 bg-[#f7f3ea] hover:border-[#0b2447]/25"
                    }`}
                    key={option.serviceId}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        className="accent-[#0b2447]"
                        type="radio"
                        name="shippingOption"
                        value={option.serviceId}
                        checked={selectedServiceId === option.serviceId}
                        onChange={() => setSelectedServiceId(option.serviceId)}
                      />
                      <span>
                        <strong className="block text-sm">{option.companyName} · {option.serviceName}</strong>
                        <span className="mt-1 block text-xs text-[#647087]">Até {option.deliveryTimeDays} dias úteis após a postagem</span>
                      </span>
                    </span>
                    <strong className="shrink-0 text-sm">{formatBrl(option.priceCents)}</strong>
                  </label>
                ))}
              </fieldset>
            )}

            <label className="sm:col-span-5">
              <span className="mb-2 block text-xs font-semibold">Endereço</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" name="streetAddress" autoComplete="address-line1" required />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">Número</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" name="addressNumber" required />
            </label>
            <label className="sm:col-span-3">
              <span className="mb-2 block text-xs font-semibold">Complemento</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" name="addressComplement" autoComplete="address-line2" />
            </label>
            <label className="sm:col-span-3">
              <span className="mb-2 block text-xs font-semibold">Bairro</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" name="neighborhood" required />
            </label>
            <label className="sm:col-span-5">
              <span className="mb-2 block text-xs font-semibold">Cidade</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" name="city" autoComplete="address-level2" required />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">UF</span>
              <input className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 uppercase outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15" name="state" autoComplete="address-level1" maxLength={2} required />
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#b88a3b] font-serif text-sm text-[#b88a3b]">3</span>
            <h2 className="font-serif text-2xl font-normal">Pagamento</h2>
          </div>
          <div className="mt-5 rounded-2xl border border-dashed border-[#0b2447]/20 bg-[#f7f3ea] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d8bc7b]/30">◇</span>
              <div>
                <strong className="text-sm">Pagamento seguro pelo Mercado Pago</strong>
                <p className="mt-1 text-xs leading-5 text-[#647087]">Você será direcionado ao Mercado Pago para escolher Pix, cartão ou outro meio disponível.</p>
              </div>
            </div>
          </div>
        </section>

        <label className="flex items-start gap-3 text-xs leading-5 text-[#647087]">
          <input className="mt-1 accent-[#0b2447]" type="checkbox" required />
          Confirmo que os dados pessoais e de entrega estão corretos.
        </label>

        {error && (
          <p className="rounded-xl border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
        )}

        <button
          className="flex h-14 w-full items-center justify-between rounded-full bg-[#0b2447] pr-2 pl-6 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#173b68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          type="submit"
          disabled={submitting || !selectedShipping}
        >
          {submitting ? "Abrindo o Mercado Pago…" : selectedShipping ? "Pagar com Mercado Pago" : "Calcule a entrega para continuar"}
          <span className="grid size-10 place-items-center rounded-full bg-[#d8bc7b] text-xl text-[#0b2447]">→</span>
        </button>
      </form>

      <aside className="rounded-[2rem] bg-[#0b2447] p-5 text-white shadow-[0_24px_70px_rgba(11,36,71,.16)] lg:sticky lg:top-6">
        <div className="overflow-hidden rounded-[1.4rem] bg-white">
          <ProductColorImage className="aspect-square w-full object-cover" product={productId} src={productImage} alt={productAlt} initialColor={color} />
        </div>
        <div className="px-2 pt-6 pb-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#d8bc7b]">Resumo do pedido</span>
          <div className="mt-3 flex items-start justify-between gap-5">
            <div>
              <h2 className="font-serif text-2xl font-normal">{productName}</h2>
              <p className="mt-1 text-xs text-white/55">Cor {colorName} · Quantidade {quantity}</p>
              {personalization && <p className="mt-1 text-xs text-[#d8bc7b]">Personalização: “{personalization}”</p>}
            </div>
            <strong className="shrink-0 text-sm">{formatBrl(subtotalCents)}</strong>
          </div>
          <dl className="mt-7 space-y-3 border-y border-white/15 py-5 text-xs">
            <div className="flex justify-between"><dt className="text-white/55">Subtotal</dt><dd>{formatBrl(subtotalCents)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-white/55">Entrega</dt><dd className="text-right">{selectedShipping ? formatBrl(selectedShipping.priceCents) : "Calcule pelo CEP"}</dd></div>
            {selectedShipping && <div className="flex justify-between gap-4"><dt className="text-white/55">Modalidade</dt><dd className="text-right">{selectedShipping.companyName} · {selectedShipping.serviceName}</dd></div>}
          </dl>
          <div className="mt-5 flex items-end justify-between">
            <span className="text-xs text-white/55">Total</span>
            <strong className="font-serif text-3xl font-normal text-[#d8bc7b]">{selectedShipping ? formatBrl(totalCents) : "—"}</strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
