"use client";

import { useEffect, useState } from "react";

type ProductColorImageProps = {
  product: string;
  src: string;
  alt: string;
  initialColor: string;
  className?: string;
};

const imageSources: Record<string, Record<string, string>> = {
  "bandeja-aurora": {
    areia: "/bandeja-aurora-capa.png",
    preto: "/bandeja-aurora-preto.png",
    branco: "/bandeja-aurora-branco.png",
    rosa: "/bandeja-aurora-rosa.png",
  },
  "organizador-arco": {
    "rosa-marfim": "/organizador-arco-capa.png",
    "marrom-branco": "/organizador-arco-marrom-branco.png",
    "areia-branco": "/organizador-arco-areia-branco.png",
  },
  "porta-palhetas-solo": {
    terracota: "/porta-palhetas-solo-capa.png",
    preto: "/porta-palhetas-solo-preto.png",
    branco: "/porta-palhetas-solo-branco.png",
  },
  "suporte-pocket": {
    preto: "/suporte-pocket-capa.png",
    branco: "/suporte-pocket-branco.png",
    rosa: "/suporte-pocket-rosa.png",
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
    Object.values(imageSources[product] ?? {}).forEach((source) => {
      const image = new Image();
      image.src = source;
    });

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
      className={className}
      src={imageSources[product]?.[color] ?? src}
      alt={alt}
      data-product-color={color}
    />
  );
}
