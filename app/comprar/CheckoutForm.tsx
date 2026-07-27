"use client";

import { useState } from "react";
import Link from "next/link";

export default function CheckoutForm() {
  const [completed, setCompleted] = useState(false);

  if (completed) {
    return (
      <div
        className="rounded-[2rem] border border-[#b88a3b]/25 bg-[#f7f3ea] p-8 text-center sm:p-12"
        role="status"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#0b2447] text-2xl text-[#d8bc7b]">
          ✓
        </span>
        <h2 className="mt-6 font-serif text-3xl font-normal">
          Pedido de demonstração criado.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#647087]">
          Este checkout ainda é uma simulação. Nenhuma cobrança foi realizada e
          os dados informados não foram enviados.
        </p>
        <Link
          className="mt-7 inline-flex rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white"
          href="/"
        >
          Voltar ao estúdio
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-9"
      onSubmit={(event) => {
        event.preventDefault();
        setCompleted(true);
      }}
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
            <input
              className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
              name="name"
              autoComplete="name"
              required
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold">E-mail</span>
            <input
              className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold">Telefone</span>
            <input
              className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
              type="tel"
              name="phone"
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
        <div className="mt-5 grid gap-4 sm:grid-cols-[.45fr_1.55fr]">
          <label>
            <span className="mb-2 block text-xs font-semibold">CEP</span>
            <input
              className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
              name="postal-code"
              autoComplete="postal-code"
              placeholder="00000-000"
              required
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold">Endereço</span>
            <input
              className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
              name="address"
              autoComplete="street-address"
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
              <strong className="text-sm">Pagamento será integrado em breve</strong>
              <p className="mt-1 text-xs leading-5 text-[#647087]">
                Para esta versão, o botão abaixo apenas confirma um pedido de
                demonstração.
              </p>
            </div>
          </div>
        </div>
      </section>

      <label className="flex items-start gap-3 text-xs leading-5 text-[#647087]">
        <input className="mt-1 accent-[#0b2447]" type="checkbox" required />
        Confirmo que entendi que esta é uma simulação e que nenhuma cobrança
        será realizada.
      </label>

      <button
        className="flex h-14 w-full items-center justify-between rounded-full bg-[#0b2447] pr-2 pl-6 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#173b68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b]"
        type="submit"
      >
        Criar pedido de demonstração
        <span className="grid size-10 place-items-center rounded-full bg-[#d8bc7b] text-xl text-[#0b2447]">
          →
        </span>
      </button>
    </form>
  );
}
