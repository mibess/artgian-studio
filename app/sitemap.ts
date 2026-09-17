import type { MetadataRoute } from "next";
import { getPublicProductCatalog } from "../lib/products/repository";
import { SITE_URL } from "../lib/site-url";

// Read the catalog on every request so product publication and archival are
// reflected without a new deployment. Do not invent last-modified dates.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = Object.values(await getPublicProductCatalog());
  const paths = new Set([
    "/",
    "/produtos",
    ...products.filter((product) => product.listed).map((product) => product.href),
  ]);
  return [...paths].map((path) => ({ url: new URL(path, SITE_URL).href }));
}
