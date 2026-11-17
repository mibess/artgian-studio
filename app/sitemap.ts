import type { MetadataRoute } from "next";
import { getPublicProductCatalog } from "../lib/products/repository";
import { SITE_URL } from "../lib/site-url";
import { productImages } from "../lib/structured-data";

// Read the catalog on every request so product publication and archival are
// reflected without a new deployment. Do not invent last-modified dates.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = [...new Map(
    Object.values(await getPublicProductCatalog())
      .filter((product) => product.listed)
      .map((product) => [product.href, product]),
  ).values()];
  return [
    { url: new URL("/", SITE_URL).href },
    { url: new URL("/produtos", SITE_URL).href },
    ...products.map((product) => ({
      url: new URL(product.href, SITE_URL).href,
      images: productImages(product),
    })),
  ];
}
