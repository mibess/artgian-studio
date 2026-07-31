"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const kitItems = [
  "Suporte para lata 350 ml",
  "Chaveiro",
  "Cartão",
  "Caixa presente",
];

export default function ProductPurchase() {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);

  function buyNow() {
    const params = new URLSearchParams({
      produto: "kit-dia-dos-pais",
      cor: "preto",
      quantidade: String(quantity),
    });
    router.push(`/comprar?${params.toString()}`);
  }

  return (
    <div className="mt-9">
      <div className="rounded-2xl border border-[#132746]/12 bg-white/40 px-4 py-4">
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#132746]/50">
          O kit inclui
        </span>
        <div className="mt-3 flex flex-wrap gap-2">
          {kitItems.map((item) => (
            <span
              className="rounded-full border border-[#132746]/12 bg-white/55 px-3 py-1.5 text-[0.65rem] font-semibold"
              key={item}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-14 w-full items-center justify-between rounded-full border border-[#132746]/20 bg-white/45 px-2 sm:w-36">
          <button
            className="grid size-10 place-items-center rounded-full text-xl transition hover:bg-white disabled:opacity-30"
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={quantity === 1}
            aria-label="Diminuir quantidade"
          >
            −
          </button>
          <output className="font-semibold" aria-live="polite">
            {quantity}
          </output>
          <button
            className="grid size-10 place-items-center rounded-full text-xl transition hover:bg-white"
            type="button"
            onClick={() => setQuantity((value) => Math.min(9, value + 1))}
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>
        <button
          className="group flex h-14 flex-1 items-center justify-between rounded-full bg-[#132746] pr-2 pl-6 font-semibold text-white shadow-[0_14px_35px_rgba(19,39,70,.22)] transition hover:-translate-y-0.5 hover:bg-[#203c67] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b57455]"
          type="button"
          onClick={buyNow}
        >
          Comprar o kit
          <span className="grid size-10 place-items-center rounded-full bg-[#b57455] text-xl text-white transition group-hover:rotate-[-8deg]">
            →
          </span>
        </button>
      </div>
      <p className="mt-4 text-center text-[0.66rem] leading-5 text-[#132746]/55 sm:text-left">
        Feito sob encomenda · Embalagem para presente incluída
      </p>
    </div>
  );
}
