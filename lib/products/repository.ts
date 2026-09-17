// Shared by Next.js server code and the standalone Node worker.
import { cache } from "react";
import { asc } from "drizzle-orm";
import { getDb } from "../../db";
import { catalogProducts } from "../../db/schema";
import type { Product, ProductCatalog, Storefront } from "../catalog";
import { storefrontSchema } from "./schema";

export type CatalogRecord = typeof catalogProducts.$inferSelect;
export function parseStringList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
export function parseStorefront(value: string | null): Storefront | null {
  if (!value) return null;
  const result = storefrontSchema.safeParse(JSON.parse(value));
  if (!result.success)
    throw new Error(
      "Cadastro de apresentação inválido. Revise o produto no admin.",
    );
  return result.data;
}
export function toProduct(row: CatalogRecord): Product | null {
  const s = parseStorefront(row.storefront);
  if (!s || !row.storeId) return null;
  const legacy = [
    "dia-dos-pais",
    "bandeja-aurora",
    "organizador-arco",
    "porta-palhetas-solo",
    "porta-incenso-samurai",
    "suporte-pocket",
  ];
  return {
    id: row.storeId,
    recordId: row.id,
    name: row.name,
    category: row.category || "",
    description: row.description || "",
    href: legacy.includes(s.slug) ? `/${s.slug}` : `/produtos/${s.slug}`,
    image: s.presentation.media[0]?.src || "",
    alt: s.presentation.media[0]?.alt || row.name,
    unitPriceCents: row.basePriceCents ?? row.priceFromCents ?? 0,
    basePriceCents: row.basePriceCents,
    priceFromCents: row.priceFromCents,
    pricingType: row.pricingType,
    active: row.active,
    productionTime: row.productionTime,
    variants: s.variants,
    shippingPackage: s.shippingPackage,
    customizable: s.personalization.enabled,
    personalization: s.personalization,
    listed: s.listed,
    featured: s.featured,
    purchasable: s.purchasable,
    presentation: s.presentation,
    seoTitle: s.seoTitle,
    seoDescription: s.seoDescription,
    minimumQuantity: row.minimumQuantity || 1,
    maximumQuantity: Math.min(9, row.maximumQuantity || 9),
  };
}
// Request-local deduplication only: admin changes and workers read the same database.
export const getProductRecords = cache(async () =>
  (await getDb())
    .select()
    .from(catalogProducts)
    .orderBy(asc(catalogProducts.name)),
);
export const getProductCatalog = cache(
  async (): Promise<ProductCatalog> =>
    Object.fromEntries(
      (await getProductRecords())
        .map(toProduct)
        .filter((p): p is Product => Boolean(p))
        .map((p) => [p.id, p]),
    ),
);
export async function getPublicProductCatalog(): Promise<ProductCatalog> {
  return Object.fromEntries(
    Object.entries(await getProductCatalog()).filter(([, p]) => p.active),
  );
}
export async function findConversationProduct(
  message: string,
  interest?: string | null,
) {
  const normalize = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const input = normalize(message);
  const rows = (await getProductRecords()).filter((p) => p.active);
  const matches = rows.filter((p) =>
    [p.name, ...parseStringList(p.aliases)].some((name) =>
      input.includes(normalize(name)),
    ),
  );
  // Ambiguous requests need clarification, not an arbitrary price.
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return null;
  return (
    rows.find(
      (p) => p.id === interest || p.storeId === interest || p.name === interest,
    ) || null
  );
}
export function productConversationContext(row: CatalogRecord) {
  const p = toProduct(row);
  return {
    id: row.storeId || row.id,
    name: row.name,
    description: row.description,
    basePriceCents: row.basePriceCents,
    priceFromCents: row.priceFromCents,
    pricingType: row.pricingType,
    productionTime: row.productionTime,
    active: row.active,
    materials: parseStringList(row.materials),
    availableColors: p
      ? p.variants.map((v) => v.name)
      : parseStringList(row.availableColors),
    customizationOptions: p
      ? [
          p.personalization.enabled
            ? `${p.personalization.label}: até ${p.personalization.maxLength} caracteres${p.personalization.required ? " (obrigatório)" : ""}`
            : "Sem personalização de texto",
        ]
      : parseStringList(row.customizationOptions),
    verifiedClaims: parseStringList(row.verifiedClaims),
    specifications: p?.presentation.specifications || [],
    variants: p?.variants.map((v) => ({
      name: v.name,
      priceCents:
        row.pricingType === "fixed"
          ? (v.priceCents ?? row.basePriceCents)
          : null,
    })),
    url: p?.href || null,
    minimumQuantity: row.minimumQuantity,
    maximumQuantity: row.maximumQuantity,
  };
}
