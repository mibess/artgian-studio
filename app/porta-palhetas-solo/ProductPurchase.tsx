"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { announceProductColor } from "../components/ProductColorImage";

const colors = [
  { name: "Terracota", value: "terracota", color: "#c96f47" },
  { name: "Preto", value: "preto", color: "#1d1d1b" },
  { name: "Branco", value: "branco", color: "#f8f4ec" },
];

export default function ProductPurchase() {
  const router = useRouter();
  const [color, setColor] = useState("terracota");
  const [name, setName] = useState("Seu Nome");
  const [quantity, setQuantity] = useState(1);

  function buyNow() {
    const personalization = name.trim();
    if (!personalization) return;

    const params = new URLSearchParams({
      produto: "porta-palhetas-solo",
      cor: color,
      quantidade: String(quantity),
      personalizacao: personalization,
    });
    router.push(`/comprar?${params.toString()}`);
  }

  return (
    <div className="mt-9">
      <label className="block">
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#182645]/60">
          Nome na peça
        </span>
        <span className="mt-3 flex h-14 items-center rounded-2xl border border-[#182645]/20 bg-white/45 px-4 transition focus-within:border-[#b88a3b] focus-within:bg-white/70">
          <span className="mr-3 text-[#b88a3b]" aria-hidden="true">
            ✦
          </span>
          <input
            className="min-w-0 flex-1 bg-transparent font-serif text-xl outline-none placeholder:text-[#182645]/35"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={18}
            required
            aria-describedby="name-hint"
          />
          <span className="text-[0.6rem] font-semibold text-[#182645]/40">
            {name.length}/18
          </span>
        </span>
        <small
          className="mt-2 block text-[0.62rem] text-[#182645]/55"
          id="name-hint"
        >
          Confira acentos e letras maiúsculas antes de comprar.
        </small>
      </label>

      <fieldset className="mt-6">
        <legend className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#182645]/60">
          Escolha a cor
        </legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {colors.map((item) => (
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-full border py-2 pr-4 pl-2 transition ${
                color === item.value
                  ? "border-[#182645] bg-white shadow-sm"
                  : "border-[#182645]/15 bg-white/35 hover:bg-white/70"
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
                  announceProductColor("porta-palhetas-solo", item.value);
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
        <div className="flex h-14 w-full items-center justify-between rounded-full border border-[#182645]/20 bg-white/45 px-2 sm:w-36">
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
          className="group flex h-14 flex-1 items-center justify-between rounded-full bg-[#182645] pr-2 pl-6 font-semibold text-white shadow-[0_14px_35px_rgba(24,38,69,.22)] transition hover:-translate-y-0.5 hover:bg-[#243b69] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          onClick={buyNow}
          disabled={!name.trim()}
        >
          Comprar personalizado
          <span className="grid size-10 place-items-center rounded-full bg-[#c96f47] text-xl text-white transition group-hover:rotate-[-8deg]">
            →
          </span>
        </button>
      </div>
      <p className="mt-4 text-center text-[0.66rem] leading-5 text-[#182645]/55 sm:text-left">
        Produção sob encomenda · Personalização incluída
      </p>
    </div>
  );
}
