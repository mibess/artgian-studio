"use client";

import { FormEvent, useState } from "react";

type CheckoutFormProps = {
  productId: string;
  color: string;
  quantity: number;
  personalization: string | null;
};

export default function CheckoutForm({
  productId,
  color,
  quantity,
  personalization,
}: CheckoutFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

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
    <form className="space-y-9" onSubmit={handleSubmit}>
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
            <input
              className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
              name="customerName"
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
              autoComplete="email"
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
              placeholder="(00) 00000-0000"
              required
            />
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
          <label>
            <span className="mb-2 block text-xs font-semibold">CEP</span>
            <input
              className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
              name="postalCode"
              autoComplete="postal-code"
              placeholder="00000-000"
              required
            />
          </label>
          <label className="sm:col-span-4">
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
            <span className="mb-2 block text-xs font-semibold">Complemento</span>
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
              <strong className="text-sm">Pagamento seguro pelo Mercado Pago</strong>
              <p className="mt-1 text-xs leading-5 text-[#647087]">
                Você será direcionado ao ambiente de testes para escolher Pix,
                cartão ou outro meio disponível. Nenhuma cobrança real será feita.
              </p>
            </div>
          </div>
        </div>
      </section>

      <label className="flex items-start gap-3 text-xs leading-5 text-[#647087]">
        <input className="mt-1 accent-[#0b2447]" type="checkbox" required />
        Confirmo que estou usando o ambiente de testes e que nenhuma cobrança
        real será realizada.
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
        className="flex h-14 w-full items-center justify-between rounded-full bg-[#0b2447] pr-2 pl-6 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#173b68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b]"
        type="submit"
        disabled={submitting}
      >
        {submitting ? "Abrindo o Mercado Pago…" : "Pagar com Mercado Pago"}
        <span className="grid size-10 place-items-center rounded-full bg-[#d8bc7b] text-xl text-[#0b2447]">
          →
        </span>
      </button>
    </form>
  );
}
