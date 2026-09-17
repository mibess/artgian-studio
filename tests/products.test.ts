vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getProductSelection } from "../lib/catalog";
import { parseCart } from "../lib/cart";
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp("/tmp/artgian-products-");
  process.env.DATABASE_URL = `file:${directory}/test.db`;
  process.env.COMMERCIAL_DEMO_MODE = "false";
  process.env.ADMIN_USERNAME = "artgian";
  process.env.ADMIN_PASSWORD = "product-test-password";
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
async function record() {
  const { getProductRecords } = await import("../lib/products/repository");
  return (await getProductRecords()).find(
    (p) => p.storeId === "organizador-arco",
  )!;
}
async function input() {
  const p = await record();
  const { parseStorefront, parseStringList } = await import(
    "../lib/products/repository"
  );
  return {
    id: p.id,
    version: p.version,
    name: p.name,
    category: p.category || "",
    description: p.description || "",
    active: p.active,
    pricingType: p.pricingType,
    basePriceCents: p.basePriceCents,
    priceFromCents: p.priceFromCents,
    productionTime: p.productionTime || "",
    minimumQuantity: 1,
    maximumQuantity: 9,
    aliases: parseStringList(p.aliases),
    materials: [],
    availableColors: [],
    availableSizes: [],
    customizationOptions: [],
    verifiedClaims: [],
    notes: "",
    storefront: parseStorefront(p.storefront),
  };
}
async function save(
  value: unknown,
  authorized = true,
  origin = "https://shop.test",
) {
  const { POST } = await import("../app/api/admin/products/route");
  return POST(
    new Request("https://shop.test/api/admin/products", {
      method: "POST",
      headers: {
        origin,
        "Content-Type": "application/json",
        ...(authorized
          ? {
              authorization: `Basic ${Buffer.from("artgian:product-test-password").toString("base64")}`,
            }
          : {}),
      },
      body: JSON.stringify(value),
    }),
  );
}
describe("single product catalog", () => {
  it("migrates all six store products and keeps historic public identities", async () => {
    const { getProductCatalog } = await import("../lib/products/repository");
    const c = await getProductCatalog();
    expect(Object.keys(c)).toHaveLength(6);
    expect(c["kit-dia-dos-pais"].href).toBe("/dia-dos-pais");
    expect(c["porta-incenso-samurai"].basePriceCents).toBe(1790);
    expect(c["porta-palhetas-solo"].personalization.maxLength).toBe(18);
  });
  it("updates store selection and conversation facts from the same saved record", async () => {
    const p = await input();
    p.basePriceCents = 6790;
    p.productionTime = "5 dias úteis";
    p.aliases = ["organizador com gavetas"];
    p.storefront!.variants[1].priceCents = 7290;
    expect((await save(p)).status).toBe(200);
    const {
      getProductCatalog,
      findConversationProduct,
      productConversationContext,
    } = await import("../lib/products/repository");
    const catalog = await getProductCatalog();
    expect(
      getProductSelection(
        { productId: "organizador-arco", color: "marrom-branco", quantity: 2 },
        catalog,
      )?.subtotalCents,
    ).toBe(14580);
    const row = await findConversationProduct(
      "Quanto custa o organizador com gavetas?",
    );
    expect(row?.id).toBe(p.id);
    const facts = productConversationContext(row!);
    expect(facts.basePriceCents).toBe(6790);
    expect(facts.variants?.[1].priceCents).toBe(7290);
    expect(facts.productionTime).toBe("5 dias úteis");
    expect(facts.url).toBe("/organizador-arco");
    expect((await save(p)).status).toBe(409);
  });
  it("rejects unauthorized writes, cross-origin requests and inconsistent sales rules", async () => {
    expect((await save(await input(), false)).status).toBe(401);
    expect((await save(await input(), true, "https://other.test")).status).toBe(
      403,
    );
    const p = await input();
    p.pricingType = "quote";
    expect((await save(p)).status).toBe(400);
    p.pricingType = "fixed";
    p.storefront!.variants.push({ ...p.storefront!.variants[0] });
    expect((await save(p)).status).toBe(400);
  });
  it("preserves URLs and handles archive in both checkout and conversation lookup", async () => {
    const p = await input();
    p.storefront!.slug = "changed-url";
    expect((await save(p)).status).toBe(400);
    p.storefront!.slug = "organizador-arco";
    p.active = false;
    expect((await save(p)).status).toBe(200);
    const {
      getProductCatalog,
      getPublicProductCatalog,
      findConversationProduct,
    } = await import("../lib/products/repository");
    expect(
      getProductSelection(
        { productId: "organizador-arco", quantity: 1 },
        await getProductCatalog(),
      ),
    ).toBeNull();
    expect(
      (await getPublicProductCatalog())["organizador-arco"],
    ).toBeUndefined();
    expect(await findConversationProduct("Organizador Arco")).toBeNull();
  });
  it("rejects invalid customization and merged quantities beyond product limits", async () => {
    const { getProductCatalog } = await import("../lib/products/repository");
    const catalog = await getProductCatalog();
    expect(
      getProductSelection(
        {
          productId: "porta-palhetas-solo",
          quantity: 1,
          personalization: "x".repeat(19),
        },
        catalog,
      ),
    ).toBeNull();
    expect(
      getProductSelection(
        { productId: "porta-palhetas-solo", quantity: 1 },
        catalog,
      ),
    ).toBeNull();
    catalog["suporte-pocket"].maximumQuantity = 3;
    expect(
      parseCart(
        [
          { productId: "suporte-pocket", color: "preto", quantity: 2 },
          { productId: "suporte-pocket", color: "preto", quantity: 2 },
        ],
        catalog,
      ),
    ).toBeNull();
  });
  it("returns no arbitrary product for an ambiguous comparison", async () => {
    const { findConversationProduct } = await import(
      "../lib/products/repository"
    );
    expect(
      await findConversationProduct("Bandeja Aurora ou Suporte Pocket?"),
    ).toBeNull();
  });
  it("records an audit trail without changing existing order snapshots", async () => {
    const { getDb } = await import("../db");
    const { auditLogs } = await import("../db/schema");
    const rows = await (await getDb())
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityType, "product"));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => JSON.parse(row.metadata).version > 0)).toBe(
      true,
    );
  });
});
