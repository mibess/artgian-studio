import { describe, expect, it } from "vitest";
import { catalog } from "./fixtures/catalog";
import { productImages, productStructuredData, serializeStructuredData } from "../lib/structured-data";

describe("public product structured data", () => {
  const product = catalog["organizador-arco"];

  it("uses the visible default variant price and canonical public URL", () => {
    const data = productStructuredData({
      ...product,
      basePriceCents: 6790,
      variants: [{ ...product.variants[0], priceCents: 7290 }],
    })["@graph"][0];
    expect(data).toMatchObject({
      "@type": "Product",
      url: "https://www.artgian.com.br/organizador-arco",
      offers: { price: "72.90", priceCurrency: "BRL" },
    });
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("offers.availability");
  });

  it.each([
    { pricingType: "quote" },
    { pricingType: "from", priceFromCents: 1000 },
    { purchasable: false },
    { active: false },
    { variants: [] },
    { basePriceCents: null },
  ])("does not advertise a purchasable price for %j", (changes) => {
    expect(productStructuredData({ ...product, ...changes })["@graph"][0])
      .not.toHaveProperty("offers");
  });

  it("deduplicates catalog images and resolves them to public URLs", () => {
    const images = productImages(product);
    expect(images).toContain(new URL(product.image, "https://www.artgian.com.br").href);
    expect(images.length).toBe(new Set(images).size);
    expect(images.every((image) => image.startsWith("https://"))).toBe(true);
  });

  it("escapes catalog text that could otherwise terminate the JSON-LD script", () => {
    const value = { name: "</script><script>alert(1)</script>" };
    const serialized = serializeStructuredData(value);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
