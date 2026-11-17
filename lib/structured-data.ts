import type { Product } from "./catalog";
import { SITE_URL } from "./site-url";

export function serializeStructuredData(value: unknown): string {
  // Catalog text is editable. Do not allow it to close the JSON-LD script.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function productImages(product: Product): string[] {
  return [...new Set([
    product.image,
    ...product.presentation.media.map((media) => media.src),
    ...product.variants.map((variant) => variant.image),
  ].filter(Boolean))].map((image) => new URL(image, SITE_URL).href);
}

export const organizationStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Artgian Studio",
      url: SITE_URL,
      logo: `${SITE_URL}/artgian-monogram.png`,
      description: "Soluções criativas em impressão 3D. Peças personalizadas, presentes e decoração sob encomenda.",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+55-16-99743-2741",
        contactType: "customer service",
        availableLanguage: "pt-BR",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Artgian Studio",
      url: SITE_URL,
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export function productStructuredData(product: Product) {
  const url = new URL(product.href, SITE_URL).href;
  // Match the initially selected variant and visible price on the page.
  // Quotes and starting prices are not concrete offers to buy at that price.
  const variant = product.variants[0];
  const price = variant?.priceCents ?? product.basePriceCents;
  const canOffer = product.active && product.purchasable &&
    product.pricingType === "fixed" && product.basePriceCents !== null &&
    Boolean(variant) && price !== null && price > 0;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.name,
        description: product.description,
        url,
        image: productImages(product),
        sku: product.id,
        category: product.category,
        brand: { "@type": "Brand", name: "Artgian Studio" },
        ...(canOffer ? {
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "BRL",
            price: (price! / 100).toFixed(2),
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@id": `${SITE_URL}/#organization` },
          },
        } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Produtos", item: `${SITE_URL}/produtos` },
          { "@type": "ListItem", position: 3, name: product.name, item: url },
        ],
      },
    ],
  };
}
