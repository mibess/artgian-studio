"use client";

import AddToCartButton from "../components/AddToCartButton";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function ProductPurchase() {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  function buyNow() {
    const params = new URLSearchParams({
      produto: "porta-incenso-samurai",
      cor: "preto",
      quantidade: String(quantity),
    });
    startTransition(() => router.push(`/comprar?${params.toString()}`));
  }

  return (
    <div className="mt-9">
      <div>
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#211a18]/60">
          Cor disponível
        </span>
        <div className="mt-4 flex w-fit items-center gap-2 rounded-full border border-[#211a18] bg-white/55 py-2 pr-4 pl-2 shadow-sm">
          <span className="size-6 rounded-full border border-white/20 bg-[#171719] shadow-inner" />
          <span className="text-xs font-semibold">Preto</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-14 w-full items-center justify-between rounded-full border border-[#211a18]/20 bg-white/40 px-2 sm:w-36">
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
          className="group flex h-14 flex-1 items-center justify-between rounded-full bg-[#182c3c] pr-2 pl-6 font-semibold text-white shadow-[0_14px_35px_rgba(24,44,60,.22)] transition hover:-translate-y-0.5 hover:bg-[#244457] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b77a4e] disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          onClick={buyNow}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <span className="ui-spinner" aria-hidden="true" />
              Abrindo checkout…
            </span>
          ) : (
            "Comprar agora"
          )}
          <span className="grid size-10 place-items-center rounded-full bg-[#b77a4e] text-xl text-white transition group-hover:rotate-[-8deg]">
            →
          </span>
        </button>
      </div>
      <AddToCartButton item={{ productId: "porta-incenso-samurai", color: "preto", quantity }} />
      <p className="mt-4 text-center text-[0.66rem] leading-5 text-[#211a18]/55 sm:text-left">
        Produção sob encomenda · Envio calculado no checkout
      </p>
    </div>
  );
}
