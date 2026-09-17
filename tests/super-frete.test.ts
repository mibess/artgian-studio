vi.mock("../lib/products/repository", async (original) => { const actual=await original<typeof import("../lib/products/repository")>(); return {...actual,getProductCatalog: async () => (await import("./fixtures/catalog")).catalog}; });
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAndPurchaseShippingLabel,
  generateAndPrintShippingLabel,
  quoteCartShipping,
} from "../lib/shipping";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SHIPPING_PROVIDER", "super_frete");
  vi.stubEnv("SUPER_FRETE_ENVIRONMENT", "production");
  vi.stubEnv("SUPER_FRETE_API_KEY", "super-frete-test-token");
  vi.stubEnv("SUPER_FRETE_ORIGIN_POSTAL_CODE", "14020000");
  vi.stubEnv("SUPER_FRETE_USER_AGENT", "Artgian Test (test@example.com)");
  vi.stubEnv("SUPER_FRETE_SENDER_NAME", "Artgian Studio");
  vi.stubEnv("SUPER_FRETE_SENDER_EMAIL", "test@example.com");
  vi.stubEnv("SUPER_FRETE_SENDER_PHONE", "16999999999");
  vi.stubEnv("SUPER_FRETE_SENDER_DOCUMENT", "52998224725");
  vi.stubEnv("SUPER_FRETE_SENDER_ADDRESS", "Rua do Ateliê");
  vi.stubEnv("SUPER_FRETE_SENDER_NUMBER", "10");
  vi.stubEnv("SUPER_FRETE_SENDER_DISTRICT", "Centro");
  vi.stubEnv("SUPER_FRETE_SENDER_CITY", "Ribeirão Preto");
  vi.stubEnv("SUPER_FRETE_SENDER_STATE", "SP");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SuperFrete", () => {
  it("quotes the configured services and normalizes the documented response", async () => {
    fetchMock.mockResolvedValue(
      Response.json([
        {
          id: 1,
          name: "PAC",
          price: 18.61,
          delivery_time: 5,
          packages: [
            {
              dimensions: { height: "6", width: "16", length: "24" },
              weight: "0.85",
            },
          ],
          company: { id: 1, name: "Correios" },
          has_error: false,
        },
        {
          id: 3,
          name: "JADLOG.PACKAGE",
          price: 12,
          delivery_time: 3,
          packages: [
            {
              dimensions: { height: "6", width: "16", length: "24" },
              weight: "0.85",
            },
          ],
          company: { id: 2, name: "Jadlog" },
          has_error: false,
        },
        { id: 2, name: "SEDEX", has_error: true },
      ]),
    );

    const quote = await quoteCartShipping(
      [
        {
          productId: "organizador-arco",
          color: "rosa-marfim",
          quantity: 2,
        },
      ],
      "01001000",
    );

    expect(quote.provider).toBe("super_frete");
    expect(quote.options).toEqual([
      {
        serviceId: "1",
        serviceName: "PAC",
        companyId: "1",
        companyName: "Correios",
        priceCents: 1861,
        deliveryTimeDays: 5,
        volumes: [{ height: 6, width: 16, length: 24, weight: 0.85 }],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.superfrete.com/api/v0/calculator",
    );
    const request = fetchMock.mock.calls[0][1];
    expect(request.headers.Authorization).toBe(
      "Bearer super-frete-test-token",
    );
    expect(request.headers["User-Agent"]).toBe(
      "Artgian Test (test@example.com)",
    );
    expect(JSON.parse(request.body)).toMatchObject({
      from: { postal_code: "14020000" },
      to: { postal_code: "01001000" },
      services: "1,2,17",
      products: [{ quantity: 2 }],
      options: { use_insurance_value: true },
    });
  });

  it("disables optional insurance below the provider minimum", async () => {
    fetchMock.mockResolvedValue(
      Response.json([
        {
          id: 1,
          name: "PAC",
          price: 17.77,
          delivery_time: 6,
          packages: [
            {
              dimensions: { height: "11", width: "16", length: "24" },
              weight: "0.15",
            },
          ],
          company: { id: 1, name: "Correios" },
          has_error: false,
        },
      ]),
    );

    await quoteCartShipping(
      [
        {
          productId: "porta-incenso-samurai",
          color: "preto",
          quantity: 1,
        },
      ],
      "15606170",
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).options).toEqual({
      own_hand: false,
      receipt: false,
      insurance_value: 17.9,
      use_insurance_value: false,
    });
  });

  it("preserves the provider error when every service is unavailable", async () => {
    fetchMock.mockResolvedValue(
      Response.json([
        {
          id: 1,
          name: "PAC",
          error: "Valor segurado é abaixo do limite mínimo de R$ 25,63",
          company: { id: 1, name: "Correios" },
        },
        {
          id: 2,
          name: "SEDEX",
          error: "Valor segurado é abaixo do limite mínimo de R$ 25,63",
          company: { id: 1, name: "Correios" },
        },
      ]),
    );

    await expect(
      quoteCartShipping(
        [
          {
            productId: "porta-incenso-samurai",
            color: "preto",
            quantity: 1,
          },
        ],
        "15606170",
      ),
    ).rejects.toThrow("Valor segurado é abaixo do limite mínimo de R$ 25,63");
  });

  it("creates, purchases and prints a label with the SuperFrete v0 API", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/v0/cart")) {
        return Response.json({ id: "label-1", status: "pending" });
      }
      if (url.endsWith("/api/v0/checkout")) {
        return Response.json({ success: true });
      }
      return Response.json({ url: "https://api.superfrete.com/label.pdf" });
    });

    const input = {
      orderId: "order-1",
      serviceId: "1",
      recipient: {
        name: "Cliente Teste",
        email: "cliente@example.com",
        phone: "11999999999",
        document: "52998224725",
        address: "Praça da Sé",
        complement: null,
        number: "1",
        district: "Sé",
        city: "São Paulo",
        state: "SP",
        postalCode: "01001000",
      },
      products: [{ name: "Organizador", quantity: 2, unitPriceCents: 5490 }],
      volumes: [{ height: 6, width: 16, length: 24, weight: 0.85 }],
    };

    await expect(
      createAndPurchaseShippingLabel("super_frete", input),
    ).resolves.toBe("label-1");
    await expect(
      generateAndPrintShippingLabel("super_frete", "label-1"),
    ).resolves.toBe("https://api.superfrete.com/label.pdf");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.superfrete.com/api/v0/cart",
      "https://api.superfrete.com/api/v0/checkout",
      "https://api.superfrete.com/api/v0/tag/print",
    ]);
    const cart = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cart).toMatchObject({
      service: 1,
      platform: "Artgian Studio",
      volumes: [{ height: 6, width: 16, length: 24, weight: 0.85 }],
      options: {
        insurance_value: 109.8,
        non_commercial: true,
        tags: [{ tag: "order-1", url: null }],
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      orders: ["label-1"],
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      orders: ["label-1"],
    });
  });

  it("omits insurance from a low-value label purchase", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/api/v0/cart")
        ? Response.json({ id: "label-low-value" })
        : Response.json({ success: true }),
    );

    await createAndPurchaseShippingLabel("super_frete", {
      orderId: "order-low-value",
      serviceId: "1",
      recipient: {
        name: "Cliente Teste",
        email: "cliente@example.com",
        phone: "11999999999",
        document: "52998224725",
        address: "Praça da Sé",
        complement: null,
        number: "1",
        district: "Sé",
        city: "São Paulo",
        state: "SP",
        postalCode: "01001000",
      },
      products: [
        { name: "Porta-Incenso Samurai", quantity: 1, unitPriceCents: 1790 },
      ],
      volumes: [{ height: 11, width: 24, length: 24, weight: 0.15 }],
    });

    const cart = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cart.volumes).toEqual([
      { height: 11, width: 24, length: 24, weight: 0.15 },
    ]);
    expect(cart.options).not.toHaveProperty("insurance_value");
  });

  it("surfaces detailed validation errors from the provider", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          message: "Ocorreu um ou mais erros.",
          errors: {
            volumes: ["O campo volumes deve ser uma lista."],
            "to.name": ["Informe nome e sobrenome do destinatário."],
          },
        },
        { status: 422 },
      ),
    );

    await expect(
      quoteCartShipping(
        [
          {
            productId: "organizador-arco",
            color: "rosa-marfim",
            quantity: 1,
          },
        ],
        "15606170",
      ),
    ).rejects.toThrow(
      "O campo volumes deve ser uma lista. Informe nome e sobrenome do destinatário.",
    );
  });
});
