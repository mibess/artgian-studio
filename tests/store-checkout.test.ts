vi.mock("../lib/products/repository", async (original) => { const actual=await original<typeof import("../lib/products/repository")>(); return {...actual,getProductCatalog: async () => (await import("./fixtures/catalog")).catalog}; });
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  batch: vi.fn(),
  values: vi.fn(),
  update: vi.fn(),
  session: vi.fn(),
  fetch: vi.fn(),
  saveAddress: vi.fn(),
  getAddress: vi.fn(),
}));
vi.mock("../lib/addresses/repository", async (original) => ({
  ...await original<typeof import("../lib/addresses/repository")>(),
  saveAddress: mock.saveAddress,
  getAddress: mock.getAddress,
}));
vi.mock("../db", () => {
  const database = {
    insert: () => ({ values: mock.values }),
    batch: mock.batch,
    update: () => ({ set: () => ({ where: mock.update }) }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [] }) }) }),
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(database),
  };
  return { getDb: async () => database };
});
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
  mock.session.mockResolvedValue({
    user: {
      id: "customer-session-id",
      name: "Cliente da sessão",
      email: "account@example.com",
    },
  });
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
  it.each(["", "5299822472", "52998224724", "11111111111"])("identifies an invalid CPF before creating an order or requesting shipping: %s", async customerDocument => {
    const response = await POST(request({ ...payload, customerDocument }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Informe um CPF válido com 11 dígitos.", field: "customerDocument" });
    expect(mock.fetch).not.toHaveBeenCalled();
    expect(mock.values).not.toHaveBeenCalled();
    expect(mock.saveAddress).not.toHaveBeenCalled();
  });
  it("prepares embedded payment without creating a redirect preference", async () => {
    vi.stubEnv("MERCADO_PAGO_PUBLIC_KEY", "test-public-key");
    const response = await POST(request({ ...payload, checkoutMode: "embedded" }));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.paymentUrl).toBe(`/comprar/pagamento?pedido=${result.orderId}`);
    expect(result.checkoutUrl).toBeUndefined();
    expect(mock.values.mock.calls[0][0]).toMatchObject({ checkoutMode: "embedded", status: "pending" });
    expect(mock.fetch.mock.calls.every(([url]) => !url.includes("mercadopago"))).toBe(true);
  });
  it("does not reserve an order when the embedded public key is missing", async () => {
    vi.stubEnv("MERCADO_PAGO_PUBLIC_KEY", "");
    expect((await POST(request({ ...payload, checkoutMode: "embedded" }))).status).toBe(503);
    expect(mock.values).not.toHaveBeenCalled();
  });
  it("saves a new address for the session owner by default", async () => {
    expect((await POST(request({ ...payload, userId: "forged" }))).status).toBe(201);
    expect(mock.saveAddress).toHaveBeenCalledWith("customer-session-id", expect.objectContaining({ postalCode: "01001000", streetAddress: "Praça da Sé" }));
  });
  it("allows a one-time address without saving it", async () => {
    expect((await POST(request({ ...payload, saveAddress: false }))).status).toBe(201);
    expect(mock.saveAddress).not.toHaveBeenCalled();
  });
  it("uses an owned saved address without creating a duplicate", async () => {
    mock.getAddress.mockResolvedValue({ ...payload, id: "saved", label: "Casa", isDefault: true });
    expect((await POST(request({ ...payload, addressId: "saved" }))).status).toBe(201);
    expect(mock.getAddress).toHaveBeenCalledWith("customer-session-id", "saved");
    expect(mock.saveAddress).not.toHaveBeenCalled();
  });
  it("requires review if the saved destination changed after rendering", async () => {
    mock.getAddress.mockResolvedValue({ ...payload, addressNumber: "2" });
    expect((await POST(request({ ...payload, addressId: "saved" }))).status).toBe(409);
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it("rejects another customer's address before shipping or payment", async () => {
    const { AddressError } = await import("../lib/addresses/repository");
    mock.getAddress.mockRejectedValue(new AddressError("Endereço não encontrado.", 404));
    expect((await POST(request({ ...payload, addressId: "foreign" }))).status).toBe(404);
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it("rejects an invalid state or excess postal code digits", async () => {
    expect((await POST(request({ ...payload, state: "ZZ" }))).status).toBe(400);
    expect((await POST(request({ ...payload, postalCode: "010010009" }))).status).toBe(400);
    expect(mock.saveAddress).not.toHaveBeenCalled();
  });
  it("requires review when the displayed product price has changed", async () => {
    const response = await POST(request({ ...payload, expectedSubtotalCents: 1 }));
    expect(response.status).toBe(409);
    expect(mock.fetch).not.toHaveBeenCalled();
    expect(mock.values).not.toHaveBeenCalled();
  });
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
      customerEmail: "account@example.com",
      subtotalCents: 12770,
      totalCents: 14270,
      shippingProvider: "melhor_envio",
    });
    expect(mock.values.mock.calls[1][0]).toHaveLength(2);
    expect(JSON.parse(mock.values.mock.calls[1][0][0].shippingPackageSnapshot)).toMatchObject({ weightKg: 0.35, widthCm: 15 });
    const shipping = JSON.parse(mock.fetch.mock.calls[0][1].body);
    expect(shipping.services).toBe("1,2,17");
    expect(
      shipping.products.map((item: { quantity: number }) => item.quantity),
    ).toEqual([2, 1]);
    const payment = JSON.parse(mock.fetch.mock.calls[1][1].body);
    expect(
      payment.items.map((item: { unit_price: number }) => item.unit_price),
    ).toEqual([54.9, 17.9]);
    expect(payment.shipments.cost).toBe(15);
  });
  it("rejects checkout without an authenticated account", async () => {
    mock.session.mockResolvedValue(null);
    const response = await POST(request({ ...payload, userId: "forged-id" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Entre na sua conta para finalizar a compra.",
    });
    expect(mock.batch).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it("rejects shipping price changes before persisting an order", async () => {
    const response = await POST(request({ ...payload, shippingPriceCents: 1 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "SHIPPING_REQUOTE_REQUIRED" });
    expect(mock.batch).not.toHaveBeenCalled();
  });
  it("quotes and charges free shipping only for a confirmed Brodowski CEP", async () => {
    const originalFetch = mock.fetch.getMockImplementation()!;
    mock.fetch.mockImplementation((url: string, options?: RequestInit) =>
      url.includes("viacep.com.br")
        ? Promise.resolve(Response.json({ cep: "14341-052", localidade: "Brodowski", uf: "SP" }))
        : originalFetch(url, options),
    );
    const destination = { ...payload, postalCode: "14341052", city: "Brodowski", state: "SP" };
    const quoted = await quote(request({ items, postalCode: destination.postalCode }));
    expect(quoted.status).toBe(200);
    expect((await quoted.json()).options[0]).toMatchObject({ serviceId: "1", priceCents: 0 });

    const checkedOut = await POST(request({ ...destination, shippingPriceCents: 0 }));
    expect(checkedOut.status).toBe(201);
    expect(mock.values.mock.calls[0][0]).toMatchObject({ shippingCents: 0, totalCents: 12770 });
    const payment = JSON.parse(mock.fetch.mock.calls.find(([url]) => url.includes("checkout/preferences"))![1].body);
    expect(payment.shipments.cost).toBe(0);

    const forged = await POST(request({ ...destination, shippingPriceCents: 1500 }));
    expect(forged.status).toBe(409);
    expect(await forged.json()).toMatchObject({ code: "SHIPPING_REQUOTE_REQUIRED" });
    expect((await POST(request({ ...destination, city: "São Paulo", shippingPriceCents: 0 }))).status).toBe(400);
  });
  it("does not grant free shipping to an unconfirmed CEP in Brodowski's range", async () => {
    const originalFetch = mock.fetch.getMockImplementation()!;
    mock.fetch.mockImplementation((url: string, options?: RequestInit) =>
      url.includes("viacep.com.br")
        ? Promise.resolve(Response.json({ cep: "14349-999", localidade: "Outra cidade", uf: "SP" }))
        : originalFetch(url, options),
    );
    const quoted = await quote(request({ items, postalCode: "14349999" }));
    expect(quoted.status).toBe(200);
    expect((await quoted.json()).options[0].priceCents).toBe(1500);
  });
  it("rejects a recipient without a complete name", async () => {
    const response = await POST(request({ ...payload, customerName: "Mibess" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Preencha corretamente os dados pessoais e de entrega.",
    });
    expect(mock.batch).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
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
