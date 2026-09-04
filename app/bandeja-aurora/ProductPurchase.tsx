"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { announceProductColor } from "../components/ProductColorImage";

const colors = [
  { name: "Areia", value: "areia", color: "#c69572" },
  { name: "Preto", value: "preto", color: "#222220" },
  { name: "Branco", value: "branco", color: "#f4f0e8" },
  { name: "Rosa", value: "rosa", color: "#cf8f88" },
];

export default function ProductPurchase() {
  const router = useRouter();
  const [color, setColor] = useState("areia");
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  function buyNow() {
    const params = new URLSearchParams({
      produto: "bandeja-aurora",
      cor: color,
      quantidade: String(quantity),
    });
    startTransition(() => router.push(`/comprar?${params.toString()}`));
  }

  return (
    <div className="mt-9">
      <fieldset>
        <legend className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#152849]/60">
          Escolha a cor
        </legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {colors.map((item) => (
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-full border py-2 pr-4 pl-2 transition ${
                color === item.value
                  ? "border-[#152849] bg-white shadow-sm"
                  : "border-[#152849]/15 bg-white/35 hover:bg-white/70"
              }`}
              key={item.value}
            >
              <input
                className="sr-only"
                type="radio"
                name="cor"
                value={item.value}
                checked={color === item.value}
                onChange={() => {
                  setColor(item.value);
                  announceProductColor("bandeja-aurora", item.value);
                }}
              />
              <span
                className="size-6 rounded-full border border-black/10 shadow-inner"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs font-semibold">{item.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-14 w-full items-center justify-between rounded-full border border-[#152849]/20 bg-white/40 px-2 sm:w-36">
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
          className="group flex h-14 flex-1 items-center justify-between rounded-full bg-[#152849] pr-2 pl-6 font-semibold text-white shadow-[0_14px_35px_rgba(21,40,73,.2)] transition hover:-translate-y-0.5 hover:bg-[#203f71] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b]"
          type="button"
          onClick={buyNow}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? <span className="flex items-center gap-2"><span className="ui-spinner" aria-hidden="true" />Abrindo checkout…</span> : "Comprar agora"}
          <span className="grid size-10 place-items-center rounded-full bg-[#dcad5b] text-xl text-[#152849] transition group-hover:rotate-[-8deg]">
            →
          </span>
        </button>
      </div>
      <p className="mt-4 text-center text-[0.66rem] leading-5 text-[#152849]/55 sm:text-left">
        Produção sob encomenda · Envio calculado no checkout
      </p>
    </div>
  );
}
