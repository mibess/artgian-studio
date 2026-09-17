"use client";
import { useEffect, useState } from "react";
import { formatBrl, type Product } from "../../lib/catalog";
export function ProductPrice({ product }: { product: Product }) {
  const [key, setKey] = useState(product.variants[0]?.key);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ product: string; color: string }>)
        .detail;
      if (detail.product === product.id) setKey(detail.color);
    };
    window.addEventListener("artgian:product-color-change", listener);
    return () =>
      window.removeEventListener("artgian:product-color-change", listener);
  }, [product.id]);
  if (product.pricingType === "quote") return <>Sob orçamento</>;
  if (product.pricingType === "from")
    return <>A partir de {formatBrl(product.priceFromCents || 0)}</>;
  return (
    <>
      {formatBrl(
        product.variants.find((v) => v.key === key)?.priceCents ??
          product.basePriceCents ??
          0,
      )}
    </>
  );
}
