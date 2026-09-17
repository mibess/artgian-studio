"use client";

import { useEffect, useState, useMemo } from "react";

import { useProductCatalog } from "../../lib/products/context";

type ProductColorImageProps = {
  product: string;
  src: string;
  alt: string;
  initialColor: string;
  className?: string;
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
  const catalog = useProductCatalog();
  const imageSources = useMemo(
    () =>
      Object.fromEntries(
        Object.values(catalog).map((p) => [
          p.id,
          Object.fromEntries(p.variants.map((v) => [v.key, v.image])),
        ]),
      ),
    [catalog],
  );
  const [color, setColor] = useState(initialColor);

  useEffect(() => {
    Object.values(imageSources[product] ?? {})
      .filter(Boolean)
      .forEach((source) => {
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
  }, [product, imageSources]);

  return (
    <img
      className={className}
      src={imageSources[product]?.[color] || src || undefined}
      alt={alt}
      data-product-color={color}
    />
  );
}
