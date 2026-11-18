import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductCatalog } from "../lib/catalog";

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), fetch: vi.fn() }));
vi.mock("../lib/products/repository", async (original) => ({
  ...await original<typeof import("../lib/products/repository")>(),
  getProductCatalog: mocks.catalog,
}));

import { catalog as fixtureCatalog } from "./fixtures/catalog";
import { POST } from "../app/api/shipping/quote/route";

let catalog: ProductCatalog;
const items = [
  { productId: "organizador-arco", color: "rosa-marfim", quantity: 2 },
  { productId: "porta-incenso-samurai", color: "preto", quantity: 1 },
];
const transitOption = {
  serviceId: "1",
  serviceName: "PAC",
  companyId: "1",
  companyName: "Correios",
  priceCents: 1500,
  deliveryTimeDays: 4,
  volumes: [{ height: 31, width: 24, length: 20, weight: 0.85 }],
};

function request(payload: unknown) {
  return new Request("https://store.example/api/shipping/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  catalog = structuredClone(fixtureCatalog);
  mocks.catalog.mockImplementation(async () => catalog);
  vi.stubEnv("SHIPPING_PROVIDER", "melhor_envio");
  vi.stubEnv("MELHOR_ENVIO_ENVIRONMENT", "sandbox");
  vi.stubEnv("MELHOR_ENVIO_ACCESS_TOKEN", "test-token");
  vi.stubEnv("MELHOR_ENVIO_ORIGIN_POSTAL_CODE", "14020000");
  vi.stubEnv("MELHOR_ENVIO_USER_AGENT", "Artgian Test (test@example.com)");
  mocks.fetch.mockImplementation(async () => Response.json([{
    id: 1,
    name: "PAC",
    price: "15.00",
    delivery_time: 4,
    company: { id: 1, name: "Correios" },
    packages: [{ weight: 0.85, dimensions: { width: 24, height: 31, length: 20 } }],
  }]));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("prazo de preparação na cotação pública", () => {
  it("usa o maior prazo do catálogo do servidor, ignora alegações do cliente e preserva o transporte", async () => {
    catalog[items[0].productId].fulfillment = { readyToShip: false, preparationDays: 6 };
    catalog[items[1].productId].fulfillment = { readyToShip: true, preparationDays: 1 };

    const response = await POST(request({
      postalCode: "01001-000",
      preparationDays: 0,
      deliveryTimeDays: 1,
      items: items.map(item => ({ ...item, fulfillment: { readyToShip: true, preparationDays: 0 } })),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      postalCode: "01001000",
      provider: "melhor_envio",
      preparationDays: 6,
      options: [transitOption],
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const providerPayload = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(providerPayload.products.map((product: { quantity: number }) => product.quantity)).toEqual([2, 1]);
    expect(providerPayload).not.toHaveProperty("preparationDays");
  });

  it.each([undefined, null])("mantém o total desconhecido quando uma peça não tem prazo estruturado (%s)", async fulfillment => {
    catalog[items[0].productId].fulfillment = { readyToShip: false, preparationDays: 6 };
    catalog[items[1].productId].fulfillment = fulfillment;
    catalog[items[1].productId].productionTime = "1 dia útil";

    const response = await POST(request({ postalCode: "01001000", items, preparationDays: 0 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ preparationDays: null, options: [transitOption] });
  });

  it("retorna zero apenas quando todas as peças estão explicitamente sem preparo adicional", async () => {
    for (const item of items) {
      catalog[item.productId].fulfillment = { readyToShip: true, preparationDays: 0 };
    }

    const response = await POST(request({ postalCode: "01001000", items }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ preparationDays: 0, options: [transitOption] });
  });

  it("consulta novamente o catálogo a cada cotação", async () => {
    for (const item of items) {
      catalog[item.productId].fulfillment = { readyToShip: true, preparationDays: 1 };
    }
    expect(await (await POST(request({ postalCode: "01001000", items }))).json()).toMatchObject({ preparationDays: 1 });

    catalog[items[0].productId].fulfillment = { readyToShip: false, preparationDays: 8 };
    expect(await (await POST(request({ postalCode: "01001000", items }))).json()).toMatchObject({ preparationDays: 8 });
    expect(mocks.catalog).toHaveBeenCalledTimes(2);
  });
});
