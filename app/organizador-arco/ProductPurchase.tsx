"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { announceProductColor } from "../components/ProductColorImage";

const colors = [
  {
    name: "Rosa & Marfim",
    value: "rosa-marfim",
    colors: ["#e9a3b5", "#fff7ed"],
  },
  {
    name: "Marrom & Branco",
    value: "marrom-branco",
    colors: ["#6e4d3d", "#f7f3ea"],
  },
  {
    name: "Areia & Branco",
    value: "areia-branco",
    colors: ["#c7a889", "#fffaf2"],
  },
];

export default function ProductPurchase() {
  const router = useRouter();
  const [color, setColor] = useState("rosa-marfim");
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  function buyNow() {
    const params = new URLSearchParams({
      produto: "organizador-arco",
      cor: color,
      quantidade: String(quantity),
    });
    startTransition(() => router.push(`/comprar?${params.toString()}`));
  }

  return (
    <div className="mt-9">
      <fieldset>
        <legend className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#321d2c]/60">
          Escolha a combinação
        </legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {colors.map((item) => (
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-full border py-2 pr-4 pl-2 transition ${
                color === item.value
                  ? "border-[#762638] bg-white shadow-sm"
                  : "border-[#762638]/15 bg-white/35 hover:bg-white/70"
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
                  announceProductColor("organizador-arco", item.value);
                }}
              />
              <span
                className="relative size-6 overflow-hidden rounded-full border border-black/10 shadow-inner"
                aria-hidden="true"
              >
                <i
                  className="absolute inset-y-0 left-0 w-1/2"
                  style={{ backgroundColor: item.colors[0] }}
                />
                <i
                  className="absolute inset-y-0 right-0 w-1/2"
                  style={{ backgroundColor: item.colors[1] }}
                />
              </span>
              <span className="text-xs font-semibold">{item.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-14 w-full items-center justify-between rounded-full border border-[#762638]/20 bg-white/45 px-2 sm:w-36">
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
          className="group flex h-14 flex-1 items-center justify-between rounded-full bg-[#762638] pr-2 pl-6 font-semibold text-white shadow-[0_14px_35px_rgba(118,38,56,.22)] transition hover:-translate-y-0.5 hover:bg-[#8f3148] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b]"
          type="button"
          onClick={buyNow}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? <span className="flex items-center gap-2"><span className="ui-spinner" aria-hidden="true" />Abrindo checkout…</span> : "Comprar agora"}
          <span className="grid size-10 place-items-center rounded-full bg-[#f2b7c5] text-xl text-[#762638] transition group-hover:rotate-[-8deg]">
            →
          </span>
        </button>
      </div>
      <p className="mt-4 text-center text-[0.66rem] leading-5 text-[#321d2c]/55 sm:text-left">
        Produção sob encomenda · Envio calculado no checkout
      </p>
    </div>
  );
}
