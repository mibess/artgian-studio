vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import input from "../content/products/kit-natalino-trico.json";
import { productInputSchema } from "../lib/products/schema";
import { getProductSelection } from "../lib/catalog";
import { parseCart } from "../lib/cart";

let directory: string;
beforeAll(async () => {
  directory = await mkdtemp("/tmp/artgian-natal-");
  process.env.DATABASE_URL = `file:${directory}/test.db`;
  process.env.ADMIN_USERNAME = "artgian";
  process.env.ADMIN_PASSWORD = "natal-test-password";
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

it("cadastra o kit na mesma fonte da loja, frete e atendimento, sem duplicar", async () => {
  const p = productInputSchema.parse(input);
  for (const media of p.storefront!.presentation.media)
    expect(existsSync(`public${media.src}`)).toBe(true);
  const { POST } = await import("../app/api/admin/products/route");
  const save = () => POST(new Request("https://shop.test/api/admin/products", {
    method: "POST",
    headers: {
      origin: "https://shop.test",
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from("artgian:natal-test-password").toString("base64")}`,
    },
    body: JSON.stringify(p),
  }));
  expect((await save()).status).toBe(200);
  expect((await save()).status).toBe(409);
  const { getProductCatalog, findConversationProduct, productConversationContext } =
    await import("../lib/products/repository");
  const catalog = await getProductCatalog();
  const product = catalog["kit-natalino-trico"];
  expect(product.href).toBe("/produtos/kit-natalino-trico");
  expect(product.listed).toBe(true);
  expect(product.image).toBe("/kit-natalino-trico-capa.png");
  expect(product.shippingPackage).toEqual({ widthCm: 20, heightCm: 8, lengthCm: 20, weightKg: 0.27 });
  expect(getProductSelection({ productId: product.id, quantity: 2 }, catalog)?.subtotalCents).toBe(11000);
  expect(parseCart([{ productId: product.id, color: "natalina", quantity: 1 }], catalog)).toHaveLength(1);
  const row = await findConversationProduct("Quanto custa o kit natalino?");
  expect(row?.storeId).toBe(product.id);
  expect(productConversationContext(row!).basePriceCents).toBe(5500);
  expect(productConversationContext(row!).specifications).toContainEqual(["Bandeja", "18 × 18 × 2 cm"]);
});
