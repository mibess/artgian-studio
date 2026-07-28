"use client";

import { useEffect, useState } from "react";

type ProductColorImageProps = {
  product: string;
  src: string;
  alt: string;
  initialColor: string;
  className?: string;
};

const filters: Record<string, Record<string, string>> = {
  "bandeja-aurora": {
    areia: "none",
    preto: "grayscale(1) brightness(.38) contrast(1.25)",
    branco: "grayscale(1) brightness(1.18) contrast(.82)",
    rosa: "sepia(.24) saturate(1.3) hue-rotate(312deg) brightness(1.03)",
  },
  "organizador-arco": {
    "rosa-marfim": "none",
    "marrom-branco": "sepia(.5) saturate(.72) hue-rotate(338deg) brightness(.78)",
    "areia-branco": "sepia(.4) saturate(.62) hue-rotate(355deg) brightness(1.05)",
  },
  "porta-palhetas-solo": {
    terracota: "none",
    preto: "grayscale(1) brightness(.42) contrast(1.22)",
    branco: "grayscale(1) brightness(1.16) contrast(.8)",
  },
  "suporte-pocket": {
    preto: "none",
    branco: "grayscale(1) invert(.78) brightness(1.18) contrast(.72)",
    rosa: "sepia(.7) saturate(1.05) hue-rotate(300deg) brightness(1.28)",
  },
};

const PRODUCT_COLOR_CHANGE_EVENT = "artgian:product-color-change";

export function announceProductColor(product: string, color: string) {
  window.dispatchEvent(
    new CustomEvent(PRODUCT_COLOR_CHANGE_EVENT, {
      detail: { product, color },
    }),
  );
}

export default function ProductColorImage({
  product,
  src,
  alt,
  initialColor,
  className = "",
}: ProductColorImageProps) {
  const [color, setColor] = useState(initialColor);

  useEffect(() => {
    function handleColorChange(event: Event) {
      const detail = (event as CustomEvent<{ product: string; color: string }>)
        .detail;

      if (detail?.product === product) setColor(detail.color);
    }

    window.addEventListener(PRODUCT_COLOR_CHANGE_EVENT, handleColorChange);
    return () =>
      window.removeEventListener(PRODUCT_COLOR_CHANGE_EVENT, handleColorChange);
  }, [product]);

  return (
    <img
      className={`${className} transition-[filter] duration-500 ease-out`}
      src={src}
      alt={alt}
      style={{ filter: filters[product]?.[color] ?? "none" }}
      data-product-color={color}
    />
  );
}
