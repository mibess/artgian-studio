import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  batch: vi.fn(),
  values: vi.fn(),
  update: vi.fn(),
  session: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("../db", () => ({
  getDb: async () => ({
    insert: () => ({ values: mock.values }),
    batch: mock.batch,
    update: () => ({ set: () => ({ where: mock.update }) }),
  }),
}));
vi.mock("../lib/auth", () => ({ getCustomerSession: mock.session }));
import { POST } from "../app/api/checkout/route";
import { POST as quote } from "../app/api/shipping/quote/route";
const items = [
  { productId: "organizador-arco", color: "rosa-marfim", quantity: 2 },
  { productId: "porta-incenso-samurai", color: "preto", quantity: 1 },
];
const payload = {
  items,
  customerName: "Cliente Teste",
  customerEmail: "teste@example.com",
  customerPhone: "11999999999",
  customerDocument: "52998224725",
  postalCode: "01001000",
  streetAddress: "Praça da Sé",
  addressNumber: "1",
  neighborhood: "Sé",
  city: "São Paulo",
  state: "SP",
  shippingServiceId: "1",
  shippingPriceCents: 1500,
};
const request = (body: unknown) =>
  new Request("https://store.example/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "https://store.example");
  vi.stubEnv("MELHOR_ENVIO_ENVIRONMENT", "sandbox");
  vi.stubEnv("MELHOR_ENVIO_ACCESS_TOKEN", "test-token");
  vi.stubEnv("MELHOR_ENVIO_ORIGIN_POSTAL_CODE", "01001000");
  vi.stubEnv("MELHOR_ENVIO_USER_AGENT", "Test (test@example.com)");
  vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "test-token");
  vi.stubEnv("MERCADO_PAGO_ENVIRONMENT", "sandbox");
  mock.session.mockResolvedValue({ user: { id: "customer-session-id" } });
  mock.fetch.mockImplementation(async (url: string) =>
    url.includes("shipment/calculate")
      ? Response.json([
          {
            id: 1,
            name: "PAC",
            price: "15.00",
            delivery_time: 5,
            company: { id: 1, name: "Correios" },
            packages: [
              {
                weight: 0.85,
                dimensions: { width: 24, height: 31, length: 20 },
              },
            ],
          },
        ])
      : Response.json({
          id: "preference-1",
          init_point: "https://www.mercadopago.com/pay",
          sandbox_init_point: "https://sandbox.mercadopago.com/pay",
        }),
  );
  vi.stubGlobal("fetch", mock.fetch);
});
describe("multi-item checkout", () => {
  it("quotes all packages, persists all items and charges server catalog prices", async () => {
    const response = await POST(
      request({
        ...payload,
        userId: "forged-id",
        totalCents: 1,
        items: items.map((item) => ({ ...item, unitPriceCents: 1 })),
      }),
    );
    expect(response.status).toBe(201);
    const order = mock.values.mock.calls[0][0];
    expect(order).toMatchObject({
      userId: "customer-session-id",
      subtotalCents: 12770,
      totalCents: 14270,
    });
    expect(mock.values.mock.calls[1][0]).toHaveLength(2);
    const shipping = JSON.parse(mock.fetch.mock.calls[0][1].body);
    expect(
      shipping.products.map((item: { quantity: number }) => item.quantity),
    ).toEqual([2, 1]);
    const payment = JSON.parse(mock.fetch.mock.calls[1][1].body);
    expect(
      payment.items.map((item: { unit_price: number }) => item.unit_price),
    ).toEqual([54.9, 17.9]);
    expect(payment.shipments.cost).toBe(15);
  });
  it("retains guest checkout without accepting a forged account ID", async () => {
    mock.session.mockResolvedValue(null);
    expect(
      (await POST(request({ ...payload, userId: "forged-id" }))).status,
    ).toBe(201);
    expect(mock.values.mock.calls[0][0].userId).toBeNull();
  });
  it("rejects shipping price changes before persisting an order", async () => {
    expect(
      (await POST(request({ ...payload, shippingPriceCents: 1 }))).status,
    ).toBe(409);
    expect(mock.batch).not.toHaveBeenCalled();
  });
  it("rejects invalid carts and malformed JSON without external calls", async () => {
    expect(
      (
        await POST(
          request({ ...payload, items: [{ ...items[0], quantity: 99 }] }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await quote(request({ items: [], postalCode: "01001000" }))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          new Request("https://store.example", { method: "POST", body: "{" }),
        )
      ).status,
    ).toBe(400);
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it("refuses to invent packaging dimensions for an unconfigured product", async () => {
    const response = await quote(
      request({
        items: [{ productId: "suporte-pocket", color: "preto", quantity: 1 }],
        postalCode: "01001000",
      }),
    );
    expect(response.status).toBe(503);
    expect(mock.fetch).not.toHaveBeenCalled();
  });
});
