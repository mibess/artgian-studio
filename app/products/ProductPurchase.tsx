"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "../../lib/catalog";
import { getProductSelection } from "../../lib/catalog";
import AddToCartButton from "../components/AddToCartButton";
import { announceProductColor } from "../components/ProductColorImage";
export default function ProductPurchase({ product }: { product: Product }) {
  const [color, setColor] = useState(product.variants[0]?.key || "");
  const [quantity, setQuantity] = useState(product.minimumQuantity);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!product.active)
    return (
      <p className="mt-8 rounded-xl bg-white/60 p-5">
        Este produto está indisponível no momento.
      </p>
    );
  if (!product.purchasable || product.pricingType !== "fixed")
    return (
      <div className="mt-8">
        <p>
          Produto sob orçamento. Confirme as opções e a produção com a Artgian.
        </p>
        {product.presentation.contactUrl && (
          <a
            href={product.presentation.contactUrl}
            className="mt-5 inline-flex rounded-full bg-current/10 px-6 py-4 font-semibold"
          >
            Solicitar orçamento →
          </a>
        )}
      </div>
    );
  const item = {
    productId: product.id,
    color,
    quantity,
    personalization: product.customizable ? name.trim() : null,
  };
  const valid = Boolean(
    getProductSelection(
      { ...item, personalization: item.personalization ?? undefined },
      { [product.id]: product },
    ),
  );
  function buy() {
    if (!valid) return;
    const query = new URLSearchParams({
      produto: product.id,
      cor: color,
      quantidade: String(quantity),
    });
    if (product.customizable) query.set("personalizacao", name.trim());
    startTransition(() => router.push(`/comprar?${query}`));
  }
  return (
    <div className="mt-9">
      {product.customizable && (
        <label className="mb-6 block text-sm font-semibold">
          {product.personalization.label}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={product.personalization.maxLength}
            required={product.personalization.required}
            placeholder="Seu Nome"
            className="mt-3 h-12 w-full rounded-xl border border-current/20 bg-white/60 px-4"
          />
          <span className="mt-2 block text-xs font-normal opacity-65">
            Até {product.personalization.maxLength} caracteres.
          </span>
        </label>
      )}
      <fieldset>
        <legend className="text-[.65rem] font-bold uppercase tracking-[.2em] opacity-65">
          {product.variants.some((v) => v.swatches.length > 1)
            ? "Escolha a combinação"
            : "Escolha a cor"}
        </legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {product.variants.map((v) => (
            <label
              key={v.key}
              className={`flex cursor-pointer items-center gap-2 rounded-full border py-2 pl-2 pr-4 ${color === v.key ? "border-current bg-white shadow-sm" : "border-current/15 bg-white/35"}`}
            >
              <input
                type="radio"
                name="cor"
                value={v.key}
                checked={color === v.key}
                onChange={() => {
                  setColor(v.key);
                  announceProductColor(product.id, v.key);
                }}
                className="sr-only"
              />
              <span
                className="flex size-6 overflow-hidden rounded-full border border-black/10"
                aria-hidden="true"
              >
                {v.swatches.map((c, i) => (
                  <i
                    key={i}
                    className="h-full flex-1"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="text-xs font-semibold">{v.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-14 items-center justify-between rounded-full border border-current/20 bg-white/45 px-2 sm:w-36">
          <button
            type="button"
            aria-label="Diminuir quantidade"
            disabled={quantity <= product.minimumQuantity}
            onClick={() => setQuantity((q) => q - 1)}
            className="size-10 text-xl disabled:opacity-30"
          >
            −
          </button>
          <output aria-live="polite" className="font-semibold">
            {quantity}
          </output>
          <button
            type="button"
            aria-label="Aumentar quantidade"
            disabled={quantity >= product.maximumQuantity}
            onClick={() => setQuantity((q) => q + 1)}
            className="size-10 text-xl disabled:opacity-30"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={buy}
          disabled={!valid || pending}
          aria-busy={pending}
          className="flex h-14 flex-1 items-center justify-between rounded-full bg-[#193244] px-6 font-semibold text-white shadow-lg disabled:opacity-45"
        >
          {pending
            ? "Abrindo checkout…"
            : product.customizable
              ? "Comprar personalizado"
              : "Comprar agora"}
          <span>→</span>
        </button>
      </div>
      <AddToCartButton item={item} disabled={!valid} />
      <p className="mt-4 text-xs opacity-65">
        {product.productionTime || "Produção sob encomenda"} · Envio calculado
        no checkout
      </p>
    </div>
  );
}
