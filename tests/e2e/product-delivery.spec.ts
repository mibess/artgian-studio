import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { test, expect, type APIRequestContext, type Route } from "@playwright/test";
import { loginAdmin } from "./admin-login";

async function createDeliveryProduct(
  request: APIRequestContext,
  fulfillment: { readyToShip: boolean; preparationDays: number } | null,
  personalized = false,
) {
  const slug = `prazo-e2e-${randomUUID().slice(0, 8)}`;
  const name = `Peça ${slug}`;
  const response = await request.post("/api/admin/products", {
    headers: {
      origin: "http://127.0.0.1:3108",
      authorization: `Basic ${Buffer.from("artgian:teste-local").toString("base64")}`,
    },
    data: {
      version: 0, name, category: "Decoração", description: "Peça de teste de prazo.",
      active: true, pricingType: "fixed", basePriceCents: 5500, priceFromCents: null,
      productionTime: "", minimumQuantity: 1, maximumQuantity: 9,
      aliases: [], materials: [], verifiedClaims: [], notes: "",
      storefront: {
        slug, listed: true, featured: false, purchasable: true, fulfillment,
        variants: [
          { key: "preto", name: "Preto", swatches: ["#171717"], image: "/organizador-arco-capa.png", priceCents: null },
          { key: "branco", name: "Branco", swatches: ["#ffffff"], image: "/organizador-arco-capa.png", priceCents: null },
        ],
        shippingPackage: { widthCm: 20, heightCm: 10, lengthCm: 20, weightKg: 0.5 },
        personalization: { enabled: personalized, required: personalized, maxLength: 20, label: "Nome na peça" },
        presentation: {
          template: "standard", accent: "#b88a3b", background: "#f7f3ea", copy: {},
          media: [{ src: "/organizador-arco-capa.png", alt: name }],
          features: [], specifications: [], contactUrl: "", sections: [],
        },
        seoTitle: "", seoDescription: "",
      },
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  return { slug, name, path: `/produtos/${slug}` };
}

function quote(preparationDays: number | null, deliveryTimeDays = 2) {
  return {
    postalCode: "01001000", preparationDays,
    options: [{
      serviceId: "2", serviceName: "SEDEX", companyId: "1", companyName: "Correios",
      priceCents: 1500, deliveryTimeDays, volumes: [],
    }],
  };
}

test("disponibilidade editada no admin aparece antes da compra, na vitrine e no carrinho", async ({ page, request }) => {
  test.setTimeout(60_000);
  const product = await createDeliveryProduct(request, { readyToShip: true, preparationDays: 1 });
  await page.goto(product.path);
  const delivery = page.getByRole("region", { name: "Entrega e disponibilidade" });
  await expect(delivery).toContainText("Pronta entrega");
  await expect(delivery).toContainText("Envio em até 1 dia útil após a confirmação do pagamento");
  const beforeButton = await delivery.boundingBox();
  const buyButton = await page.getByRole("button", { name: "Comprar agora" }).boundingBox();
  expect(beforeButton!.y + beforeButton!.height).toBeLessThan(buyButton!.y);

  await loginAdmin(page);
  await page.goto("/admin/produtos");
  await page.getByRole("button").filter({ hasText: product.name }).click();
  await page.getByRole("combobox", { name: "Disponibilidade", exact: true }).selectOption("order");
  await page.getByLabel("Prazo para envio (dias úteis)", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Salvar produto", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Produto salvo");

  await page.goto(product.path);
  await expect(delivery).toContainText("Sob encomenda");
  await expect(delivery).toContainText("Envio em até 5 dias úteis");
  await page.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await page.goto("/carrinho");
  await expect(page.getByRole("article").filter({ hasText: product.name })).toContainText("Envio em até 5 dias úteis");
  await page.goto(`/produtos?busca=${encodeURIComponent(product.name)}`);
  const card = page.getByRole("link").filter({ hasText: product.name }).filter({ hasText: "Comprar" });
  await expect(card).toContainText("Sob encomenda");
  await expect(card).toContainText("Envio em até 5 dias úteis");
});

test("cliente calcula entrega sem login com preparação e transporte e mantém layout no celular", async ({ page, request }) => {
  const product = await createDeliveryProduct(request, { readyToShip: false, preparationDays: 5 }, true);
  const bodies: { items: { personalization: string; quantity: number }[]; postalCode: string }[] = [];
  await page.route("**/api/shipping/quote", async route => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ json: quote(5) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(product.path);
  const delivery = page.getByRole("region", { name: "Entrega e disponibilidade" });
  await expect(page.getByRole("button", { name: "Calcular entrega", exact: true })).toBeDisabled();
  await page.getByLabel("Nome na peça").fill("Marina");
  await page.getByLabel("Calcule quando chega no seu CEP").fill("01001000");
  await page.getByRole("button", { name: "Calcular entrega", exact: true }).click();
  await expect(delivery).toContainText("Entrega estimada em até 7 dias úteis");
  await expect(delivery).toContainText("5 dias úteis de preparação + 2 dias úteis de transporte");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ postalCode: "01001000", items: [{ quantity: 1, personalization: "Marina" }] });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await delivery.screenshot({ path: "test-results/product-delivery-mobile.png" });

  await page.getByLabel("Nome na peça").fill("Ana");
  await expect(delivery.getByText("Entrega estimada em até 7 dias úteis")).toHaveCount(0);
  await expect(page.getByLabel("Calcule quando chega no seu CEP")).toHaveValue("01001-000");
  await expect(page.getByRole("button", { name: "Comprar personalizado", exact: true })).toBeEnabled();
});

test("descarta cotação atrasada ao mudar quantidade e usa prazo atual do servidor", async ({ page, request }) => {
  const product = await createDeliveryProduct(request, { readyToShip: false, preparationDays: 5 });
  let firstRoute: Route | undefined;
  await page.route("**/api/shipping/quote", async route => {
    if (route.request().postDataJSON().items[0].quantity === 1) firstRoute = route;
    else await route.fulfill({ json: quote(7) });
  });
  await page.goto(product.path);
  await page.getByLabel("Calcule quando chega no seu CEP").fill("01001000");
  await page.getByRole("button", { name: "Calcular entrega", exact: true }).click();
  await expect.poll(() => Boolean(firstRoute)).toBe(true);
  await page.getByRole("button", { name: "Aumentar quantidade", exact: true }).click();
  await expect(page.getByLabel("Calcule quando chega no seu CEP")).toHaveValue("01001-000");
  await firstRoute!.fulfill({ json: quote(5) });
  const delivery = page.getByRole("region", { name: "Entrega e disponibilidade" });
  await expect(delivery.getByText("Entrega estimada em até 7 dias úteis")).toHaveCount(0);
  await page.getByRole("button", { name: "Calcular entrega", exact: true }).click();
  await expect(delivery).toContainText("Entrega estimada em até 9 dias úteis");
  await page.getByLabel("Calcule quando chega no seu CEP").fill("01310930");
  await expect(delivery.getByText("Entrega estimada em até 9 dias úteis")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Comprar agora", exact: true })).toBeEnabled();
});

test("produto sem prazo confirmado não apresenta transporte como prazo total", async ({ page, request }) => {
  const product = await createDeliveryProduct(request, null);
  await page.route("**/api/shipping/quote", route => route.fulfill({ json: quote(null) }));
  await page.goto(product.path);
  const delivery = page.getByRole("region", { name: "Entrega e disponibilidade" });
  await expect(delivery).toContainText("Prazo a confirmar");
  await page.getByLabel("Calcule quando chega no seu CEP").fill("01001000");
  await page.getByRole("button", { name: "Calcular entrega", exact: true }).click();
  await expect(delivery).toContainText("Transporte: até 2 dias úteis após a postagem");
  await expect(delivery).not.toContainText("Entrega estimada em até");
  await expect(delivery).toContainText("O prazo para preparar o pedido ainda precisa ser confirmado");
});

test("checkout autenticado soma preparo e transporte e atualiza o resumo ao trocar a modalidade", async ({ page, request }) => {
  test.setTimeout(60_000);
  const product = await createDeliveryProduct(request, { readyToShip: false, preparationDays: 5 });
  const origin = "http://127.0.0.1:3108";
  const email = `delivery-${randomUUID()}@example.com`;
  const password = "DeliveryTest!12345";
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.19.2.${Math.floor(Math.random() * 200) + 1}` });
  expect((await page.request.post("/api/auth/sign-up/email", {
    headers: { origin }, data: { name: "Cliente Prazo", email, password },
  })).ok()).toBe(true);
  const database = createClient({ url: process.env.E2E_DATABASE_URL! });
  try {
    await database.execute({ sql: "UPDATE store_user SET email_verified = 1 WHERE email = ?", args: [email] });
  } finally {
    database.close();
  }
  expect((await page.request.post("/api/auth/sign-in/email", {
    headers: { origin }, data: { email, password },
  })).ok()).toBe(true);

  await page.route("**/api/addresses/lookup?*", route => route.fulfill({
    json: { address: { streetAddress: "Praça da Sé", neighborhood: "Sé", city: "São Paulo", state: "SP" } },
  }));
  let quotes = 0;
  await page.route("**/api/shipping/quote", route => {
    quotes++;
    expect(route.request().postDataJSON()).toMatchObject({
      postalCode: "01001000", items: [{ productId: product.slug, quantity: 1 }],
    });
    return route.fulfill({ json: {
      ...quote(5),
      options: [
        ...quote(5).options,
        { ...quote(5).options[0], serviceId: "1", serviceName: "PAC", deliveryTimeDays: 6, priceCents: 1000 },
      ],
    } });
  });

  await page.goto(`/comprar?produto=${product.slug}&cor=preto&quantidade=1`);
  await expect(page.getByRole("heading", { name: "Finalize seu pedido." })).toBeVisible();
  const summary = page.getByRole("complementary").filter({ hasText: "Resumo do pedido" });
  await expect(summary).toContainText("Envio em até 5 dias úteis");
  await page.getByLabel("CEP", { exact: true }).fill("01001000");
  const modalities = page.getByRole("group", { name: "Escolha a modalidade" });
  await expect(modalities).toContainText("Entrega estimada em até 7 dias úteis");
  await expect(modalities).toContainText("5 dias úteis de preparação + 2 dias úteis de transporte");
  await expect(summary).toContainText("Entrega estimada em até 7 dias úteis");
  await expect(summary).toContainText("5 dias úteis de preparação + 2 dias úteis de transporte");
  await expect(page.getByRole("radio", { name: /Correios · SEDEX/ })).toBeChecked();

  await page.getByRole("radio", { name: /Correios · PAC/ }).check();
  await expect(summary).toContainText("Entrega estimada em até 11 dias úteis");
  await expect(summary).toContainText("5 dias úteis de preparação + 6 dias úteis de transporte");
  await expect(summary).not.toContainText("Entrega estimada em até 7 dias úteis");
  await page.getByRole("radio", { name: /Correios · SEDEX/ }).check();
  await expect(summary).toContainText("Entrega estimada em até 7 dias úteis");
  await expect(summary).not.toContainText("Entrega estimada em até 11 dias úteis");
  expect(quotes).toBe(1);
});
