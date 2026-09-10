"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cartSelections, type CartItem } from "../../lib/cart";
import { formatCpf, formatPhone } from "../../lib/brazil";
import { formatBrl } from "../../lib/catalog";
import type { ShippingOption } from "../../lib/melhor-envio";
import ProductColorImage from "../components/ProductColorImage";

type CheckoutFormProps = {
  customer: { name: string; email: string };
  items: CartItem[];
  fromCart?: boolean;
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
  customer,
  items,
  fromCart = false,
}: CheckoutFormProps) {
  const router = useRouter();
  const selections = cartSelections(items);
  const subtotalCents = selections.reduce(
    (sum, selection) => sum + selection.subtotalCents,
    0,
  );
  const quoteVersion = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const couponVersion = useRef(0);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{
    code: string;
    discountCents: number;
    subtotalCents: number;
    expiresAt: string | null;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [error, setError] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [quotedPostalCode, setQuotedPostalCode] = useState("");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");

  const selectedShipping = shippingOptions.find(
    (option) => option.serviceId === selectedServiceId,
  );
  const appliedCoupon = coupon?.subtotalCents === subtotalCents ? coupon : null;
  const totalCents =
    subtotalCents -
    (appliedCoupon?.discountCents ?? 0) +
    (selectedShipping?.priceCents ?? 0);

  async function applyCoupon() {
    const version = ++couponVersion.current;
    setApplyingCoupon(true);
    setCouponError("");
    setCoupon(null);
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, items }),
      });
      const result = await response.json();
      if (version !== couponVersion.current) return;
      if (!response.ok)
        throw new Error(result.error || "Não foi possível aplicar o cupom.");
      setCoupon(result);
      setCouponCode(result.code);
    } catch (error) {
      if (version === couponVersion.current)
        setCouponError(
          error instanceof Error
            ? error.message
            : "Não foi possível aplicar o cupom.",
        );
    } finally {
      if (version === couponVersion.current) setApplyingCoupon(false);
    }
  }

  function handlePostalCodeChange(value: string) {
    setPostalCode(value);
    quoteVersion.current += 1;
    setQuoting(false);
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

    const version = ++quoteVersion.current;
    setQuoting(true);
    setShippingError("");
    setError("");

    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          postalCode: normalizedPostalCode,
        }),
      });
      const result = (await response.json()) as QuoteResponse;

      if (version !== quoteVersion.current) return;
      if (!response.ok || !result.options?.length || !result.postalCode) {
        throw new Error(
          result.error || "Não encontramos entrega para esse CEP.",
        );
      }

      setShippingOptions(result.options);
      setQuotedPostalCode(result.postalCode);
      setSelectedServiceId(result.options[0].serviceId);
    } catch (quoteError) {
      if (version !== quoteVersion.current) return;
      setShippingOptions([]);
      setSelectedServiceId("");
      setShippingError(
        quoteError instanceof Error
          ? quoteError.message
          : "Não foi possível calcular a entrega.",
      );
    } finally {
      if (version === quoteVersion.current) setQuoting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (
      !selectedShipping ||
      quotedPostalCode !== onlyPostalCodeDigits(postalCode)
    ) {
      setShippingError("Calcule e escolha uma modalidade de entrega.");
      return;
    }

    if (couponCode.trim() && !appliedCoupon) {
      setCouponError("Aplique o cupom ou limpe o código antes de pagar.");
      return;
    }
    if (
      appliedCoupon?.expiresAt &&
      Date.parse(appliedCoupon.expiresAt) <= Date.now()
    ) {
      setCoupon(null);
      setCouponError(
        "Este cupom expirou. Remova o código ou informe outro cupom.",
      );
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
          couponCode: appliedCoupon?.code,
          items,
          shippingServiceId: selectedShipping.serviceId,
          shippingPriceCents: selectedShipping.priceCents,
        }),
      });
      const result = (await response.json()) as {
        checkoutUrl?: string;
        orderId?: string;
        error?: string;
      };

      if (response.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (!response.ok || !result.checkoutUrl) {
        throw new Error(
          result.error || "Não foi possível iniciar o pagamento.",
        );
      }

      if (fromCart && result.orderId) {
        try {
          sessionStorage.setItem(
            `artgian:checkout:${result.orderId}`,
            JSON.stringify(items),
          );
        } catch {
          /* Cart remains available when storage is blocked. */
        }
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
        <p className="text-sm text-[#647087]">
          Comprando como{" "}
          <strong className="text-[#0b2447]">{customer.name}</strong>
        </p>
        <section>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#b88a3b] font-serif text-sm text-[#b88a3b]">
              1
            </span>
            <h2 className="font-serif text-2xl font-normal">Seus dados</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold">
                Nome completo
              </span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="customerName"
                defaultValue={customer.name}
                autoComplete="name"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">E-mail</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                type="email"
                name="customerEmail"
                value={customer.email}
                autoComplete="email"
                readOnly
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">Telefone</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                type="tel"
                name="customerPhone"
                autoComplete="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                maxLength={15}
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(formatPhone(event.target.value))
                }
                required
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold">
                CPF para emissão da etiqueta
              </span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="customerDocument"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                maxLength={14}
                value={customerDocument}
                onChange={(event) =>
                  setCustomerDocument(formatCpf(event.target.value))
                }
                required
              />
              <span className="mt-2 block text-[0.7rem] leading-4 text-[#647087]">
                Usado somente no processamento do pedido e da entrega.
              </span>
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
                className="flex h-12 items-center gap-2 rounded-full border border-[#0b2447]/20 px-5 text-xs font-semibold transition hover:border-[#b88a3b] disabled:opacity-60"
                type="button"
                onClick={calculateQuote}
                disabled={quoting}
                aria-busy={quoting}
              >
                {quoting ? (
                  <>
                    <span className="ui-spinner" aria-hidden="true" />
                    Calculando…
                  </>
                ) : (
                  "Calcular entrega"
                )}
              </button>
            </div>

            {shippingError && (
              <p
                className="sm:col-span-6 rounded-xl border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {shippingError}
              </p>
            )}

            {shippingOptions.length > 0 && (
              <fieldset className="sm:col-span-6 space-y-2">
                <legend className="mb-2 text-xs font-semibold">
                  Escolha a modalidade
                </legend>
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
                        <strong className="block text-sm">
                          {option.companyName} · {option.serviceName}
                        </strong>
                        <span className="mt-1 block text-xs text-[#647087]">
                          Até {option.deliveryTimeDays} dias úteis após a
                          postagem
                        </span>
                      </span>
                    </span>
                    <strong className="shrink-0 text-sm">
                      {formatBrl(option.priceCents)}
                    </strong>
                  </label>
                ))}
              </fieldset>
            )}

            <label className="sm:col-span-5">
              <span className="mb-2 block text-xs font-semibold">Endereço</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="streetAddress"
                autoComplete="address-line1"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">Número</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="addressNumber"
                required
              />
            </label>
            <label className="sm:col-span-3">
              <span className="mb-2 block text-xs font-semibold">
                Complemento
              </span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="addressComplement"
                autoComplete="address-line2"
              />
            </label>
            <label className="sm:col-span-3">
              <span className="mb-2 block text-xs font-semibold">Bairro</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="neighborhood"
                required
              />
            </label>
            <label className="sm:col-span-5">
              <span className="mb-2 block text-xs font-semibold">Cidade</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="city"
                autoComplete="address-level2"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">UF</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 uppercase outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="state"
                autoComplete="address-level1"
                maxLength={2}
                required
              />
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#b88a3b] font-serif text-sm text-[#b88a3b]">
              3
            </span>
            <h2 className="font-serif text-2xl font-normal">Pagamento</h2>
          </div>
          <div className="mt-5 rounded-2xl border border-dashed border-[#0b2447]/20 bg-[#f7f3ea] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d8bc7b]/30">
                ◇
              </span>
              <div>
                <strong className="text-sm">
                  Pagamento seguro pelo Mercado Pago
                </strong>
                <p className="mt-1 text-xs leading-5 text-[#647087]">
                  Você será direcionado ao Mercado Pago para escolher Pix,
                  cartão ou outro meio disponível.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="coupon-title"
          className="rounded-2xl border border-[#b88a3b]/25 bg-[#f7f3ea] p-5"
        >
          <h2 id="coupon-title" className="font-serif text-2xl">
            Cupom de desconto
          </h2>
          <label
            className="mt-4 block text-xs font-semibold"
            htmlFor="coupon-code"
          >
            Código do cupom
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="coupon-code"
              autoComplete="off"
              maxLength={40}
              disabled={submitting}
              value={couponCode}
              placeholder="Digite seu cupom"
              className="h-12 min-w-0 flex-1 rounded-xl border border-[#0b2447]/20 bg-white px-4 text-sm uppercase"
              onChange={(event) => {
                couponVersion.current += 1;
                setApplyingCoupon(false);
                setCouponCode(event.target.value.toUpperCase());
                setCoupon(null);
                setCouponError("");
              }}
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={applyingCoupon || submitting || !couponCode.trim()}
              className="rounded-full bg-[#0b2447] px-5 text-xs font-bold text-white disabled:opacity-60"
            >
              {applyingCoupon ? "Aplicando…" : "Aplicar cupom"}
            </button>
            {couponCode && (
              <button
                type="button"
                disabled={submitting}
                className="text-xs font-semibold underline"
                onClick={() => {
                  couponVersion.current += 1;
                  setCouponCode("");
                  setCoupon(null);
                  setCouponError("");
                  setApplyingCoupon(false);
                }}
              >
                Remover cupom
              </button>
            )}
          </div>
          {appliedCoupon && (
            <p
              role="status"
              className="mt-3 break-words text-sm text-emerald-800"
            >
              Cupom {appliedCoupon.code} aplicado: −
              {formatBrl(appliedCoupon.discountCents)}.
              {appliedCoupon.expiresAt &&
                ` Válido até ${new Date(appliedCoupon.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} (Brasília).`}
            </p>
          )}
          {couponError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {couponError}{" "}
              <Link href="/conta" className="underline">
                Ver meus pedidos
              </Link>
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-[#647087]">
            Um cupom por pedido. O desconto vale para os produtos; o frete
            permanece igual. A disponibilidade será confirmada ao iniciar o
            pagamento.
          </p>
        </section>

        <label className="flex items-start gap-3 text-xs leading-5 text-[#647087]">
          <input className="mt-1 accent-[#0b2447]" type="checkbox" required />
          Confirmo que os dados pessoais e de entrega estão corretos.
        </label>

        {error && (
          <p
            className="rounded-xl border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          className="flex h-14 w-full items-center justify-between rounded-full bg-[#0b2447] pr-2 pl-6 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#173b68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          type="submit"
          disabled={submitting || applyingCoupon || !selectedShipping}
          aria-busy={submitting}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="ui-spinner" aria-hidden="true" />
              Abrindo o Mercado Pago…
            </span>
          ) : selectedShipping ? (
            "Pagar com Mercado Pago"
          ) : (
            "Calcule a entrega para continuar"
          )}
          <span className="grid size-10 place-items-center rounded-full bg-[#d8bc7b] text-xl text-[#0b2447]">
            →
          </span>
        </button>
      </form>

      <aside className="rounded-[2rem] bg-[#0b2447] p-5 text-white shadow-[0_24px_70px_rgba(11,36,71,.16)] lg:sticky lg:top-6">
        <div className="px-2 pt-3 pb-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#d8bc7b]">
            Resumo do pedido
          </span>
          <div className="mt-5 space-y-5">
            {selections.map((selection, index) => (
              <div key={index} className="flex items-start gap-4">
                <ProductColorImage
                  className="size-16 shrink-0 rounded-xl object-cover"
                  product={selection.productId}
                  src={selection.product.image}
                  alt={`${selection.product.name} — ${selection.color}`}
                  initialColor={selection.colorKey}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-xl font-normal">
                    {selection.product.name}
                  </h2>
                  <p className="mt-1 text-xs text-white/65">
                    Cor {selection.color} · Quantidade {selection.quantity}
                  </p>
                  {selection.personalization && (
                    <p className="mt-1 break-words text-xs text-[#d8bc7b]">
                      Personalização: “{selection.personalization}”
                    </p>
                  )}
                  <p className="mt-2 text-sm font-semibold">
                    {formatBrl(selection.subtotalCents)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <dl className="mt-7 space-y-3 border-y border-white/15 py-5 text-xs">
            <div className="flex justify-between">
              <dt className="text-white/55">Subtotal</dt>
              <dd>{formatBrl(subtotalCents)}</dd>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between gap-4 text-[#d8bc7b]">
                <dt className="min-w-0 break-all">
                  Desconto · {appliedCoupon.code}
                </dt>
                <dd className="shrink-0">
                  −{formatBrl(appliedCoupon.discountCents)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Entrega</dt>
              <dd className="text-right">
                {selectedShipping
                  ? formatBrl(selectedShipping.priceCents)
                  : "Calcule pelo CEP"}
              </dd>
            </div>
            {selectedShipping && (
              <div className="flex justify-between gap-4">
                <dt className="text-white/55">Modalidade</dt>
                <dd className="text-right">
                  {selectedShipping.companyName} ·{" "}
                  {selectedShipping.serviceName}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex items-end justify-between">
            <span className="text-xs text-white/55">Total</span>
            <strong className="font-serif text-3xl font-normal text-[#d8bc7b]">
              {selectedShipping ? formatBrl(totalCents) : "—"}
            </strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
