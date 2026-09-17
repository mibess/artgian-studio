export type ShippingPackage = {
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  weightKg: number;
};
export type ProductVariant = {
  key: string;
  name: string;
  swatches: string[];
  image: string;
  priceCents: number | null;
};
export type ProductPresentation = {
  template:
    | "standard"
    | "kit-dia-dos-pais"
    | "bandeja-aurora"
    | "organizador-arco"
    | "porta-palhetas-solo"
    | "porta-incenso-samurai"
    | "suporte-pocket";
  accent: string;
  background: string;
  copy: Record<string, { label: string; value: string }>;
  media: { src: string; alt: string }[];
  features: string[][];
  specifications: string[][];
  contactUrl: string;
  sections: { title: string; text: string; image: string }[];
};
export type Storefront = {
  slug: string;
  listed: boolean;
  featured: boolean;
  purchasable: boolean;
  variants: ProductVariant[];
  shippingPackage: ShippingPackage | null;
  personalization: {
    enabled: boolean;
    required: boolean;
    maxLength: number;
    label: string;
  };
  presentation: ProductPresentation;
  seoTitle: string;
  seoDescription: string;
};
export type Product = {
  id: string;
  recordId: string;
  name: string;
  category: string;
  description: string;
  href: string;
  image: string;
  alt: string;
  unitPriceCents: number;
  basePriceCents: number | null;
  priceFromCents: number | null;
  pricingType: string;
  active: boolean;
  productionTime: string | null;
  variants: ProductVariant[];
  shippingPackage: ShippingPackage | null;
  customizable: boolean;
  personalization: Storefront["personalization"];
  listed: boolean;
  featured: boolean;
  purchasable: boolean;
  presentation: ProductPresentation;
  seoTitle: string;
  seoDescription: string;
  minimumQuantity: number;
  maximumQuantity: number;
};
export type ProductCatalog = Record<string, Product>;
export type ProductId = string;
export function isProductId(value: string, catalog: ProductCatalog): boolean {
  return Object.hasOwn(catalog, value);
}
export function getProductSelection(
  input: {
    productId?: string;
    color?: string;
    quantity?: number | string;
    personalization?: string;
  },
  catalog: ProductCatalog,
) {
  const product =
    input.productId && Object.hasOwn(catalog, input.productId)
      ? catalog[input.productId]
      : null;
  if (
    !product ||
    !product.active ||
    !product.purchasable ||
    product.pricingType !== "fixed" ||
    product.basePriceCents === null
  )
    return null;
  const parsedQuantity = Number(input.quantity ?? product.minimumQuantity);
  if (
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < product.minimumQuantity ||
    parsedQuantity > product.maximumQuantity
  )
    return null;
  const variant = product.variants.find(
    (v) => v.key === (input.color?.trim() || product.variants[0]?.key),
  );
  if (!variant) return null;
  if (!product.customizable && input.personalization?.trim()) return null;
  const text = product.customizable ? input.personalization?.trim() || "" : "";
  if (
    product.customizable &&
    ((product.personalization.required && !text) ||
      text.length > product.personalization.maxLength)
  )
    return null;
  const unitPriceCents = variant.priceCents ?? product.basePriceCents;
  return {
    productId: product.id,
    product: {
      ...product,
      unitPriceCents,
      image: variant.image || product.image,
    },
    quantity: parsedQuantity,
    color: variant.name,
    colorKey: variant.key,
    personalization: text || null,
    subtotalCents: unitPriceCents * parsedQuantity,
  };
}
export function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
