import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import type { PaymentState } from "../../lib/payment-types";

async function setup(page: Page) {
  const origin = "http://127.0.0.1:3108";
  const email = `payment-${crypto.randomUUID()}@example.com`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.19.1.${Math.floor(Math.random() * 200) + 1}` });
  expect((await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Cliente Pagamento", email, password: "PaymentTest!12345" } })).ok()).toBe(true);
  const client = createClient({ url: process.env.E2E_DATABASE_URL! });
  await client.execute({ sql: "UPDATE store_user SET email_verified = 1 WHERE email = ?", args: [email] });
  expect((await page.request.post("/api/auth/sign-in/email", { headers: { origin }, data: { email, password: "PaymentTest!12345" } })).ok()).toBe(true);
  const userId = String((await client.execute({ sql: "SELECT id FROM store_user WHERE email = ?", args: [email] })).rows[0].id);
  const orderId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();
  await client.execute({ sql: `INSERT INTO orders (id, user_id, status, checkout_mode, payment_expires_at, customer_name, customer_email, customer_phone, customer_document, postal_code, street_address, address_number, neighborhood, city, state, subtotal_cents, shipping_cents, discount_cents, total_cents, shipping_service_name) VALUES (?, ?, 'pending', 'embedded', ?, 'Cliente Pagamento', ?, '11999999999', '52998224725', '01001000', 'Praça da Sé', '42', 'Sé', 'São Paulo', 'SP', 10980, 1500, 0, 12480, 'Correios · PAC')`, args: [orderId, userId, expiresAt, email] });
  await client.execute({ sql: "INSERT INTO order_items (order_id, product_id, product_name, color, quantity, unit_price_cents) VALUES (?, 'organizador-arco', 'Organizador Arco', 'Rosa Marfim', 2, 5490)", args: [orderId] });
  client.close();
  await page.route("https://sdk.mercadopago.com/js/v2", route => route.fulfill({ path: "tests/fixtures/mercado-pago-browser.js", contentType: "application/javascript" }));
  const state: PaymentState = { orderId, orderStatus: "pending", totalCents: 12480, expiresAt, attemptId: null, attemptStatus: null, payment: null };
  return { state, url: `/comprar/pagamento?pedido=${orderId}`, endpoint: `**/api/checkout/${orderId}/payment` };
}

async function fillCard(page: Page) {
  await page.frameLocator("#card-number iframe").getByRole("textbox").fill("5031433215406351");
  await page.frameLocator("#card-expiration iframe").getByRole("textbox").fill("11/30");
  await page.frameLocator("#card-security iframe").getByRole("textbox").fill("123");
}

test("custom card checkout keeps secure fields, handles refusal and approves without navigation", async ({ page }) => {
  const { state, url, endpoint } = await setup(page);
  let attempts = 0;
  await page.route(endpoint, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body.method).toBe("card");
      expect(body.card.token).toBe("test-token-from-secure-sdk");
      expect(body.deviceId).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+$/);
      expect(JSON.stringify(body)).not.toContain("5031433215406351");
      expect(body.card).not.toHaveProperty("cvv");
      state.attemptId = crypto.randomUUID();
      state.attemptStatus = ++attempts === 1 ? "rejected" : "approved";
      state.payment = { id: String(attempts), method: "card", status: state.attemptStatus, statusDetail: attempts === 1 ? "cc_rejected_insufficient_amount" : "accredited" };
      if (attempts === 2) state.orderStatus = "paid";
    }
    await route.fulfill({ json: state });
  });
  await page.goto("/conta");
  await page.getByRole("link", { name: "Continuar pagamento", exact: true }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("button", { name: "Pagar R$" })).toBeEnabled();
  await fillCard(page);
  await page.screenshot({ path: "screenshots/payment-card-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Pagar R$" }).click();
  await expect(page.getByRole("status").filter({ hasText: "limite disponível" })).toBeVisible();
  await fillCard(page);
  await page.getByRole("button", { name: "Pagar R$" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento confirmado." })).toBeVisible();
  await expect(page).toHaveURL(url);
});

test("mobile Pix displays a copyable code and updates to paid", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  const { state, url, endpoint } = await setup(page);
  let creations = 0;
  await page.route(endpoint, async route => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON().method).toBe("pix");
      creations++;
      state.attemptId = crypto.randomUUID(); state.attemptStatus = "pending";
      state.payment = { id: "pix-1", method: "pix", status: "pending", statusDetail: "pending_waiting_transfer", pixCode: "000201-PIX-DE-TESTE-NAO-PAGAR", expiresAt: new Date(Date.now() + 1800_000).toISOString() };
    } else { state.orderStatus = "paid"; state.attemptStatus = "approved"; }
    await route.fulfill({ json: state });
  });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Como prefere pagar?" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "screenshots/payment-card-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.screenshot({ path: "screenshots/payment-pix-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Gerar Pix" }).click();
  await expect(page.getByRole("heading", { name: "Seu Pix está pronto." })).toBeVisible();
  await page.getByRole("button", { name: "Copiar código Pix" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("000201-PIX-DE-TESTE-NAO-PAGAR");
  await page.getByRole("button", { name: "Verificar pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento confirmado." })).toBeVisible();
  expect(creations).toBe(1);
  await expect(page).toHaveURL(url);
});

test("boleto can be resumed after reload and is scoped to the account", async ({ page, browser }) => {
  const { state, url, endpoint } = await setup(page);
  await page.route(endpoint, async route => {
    expect(route.request().postDataJSON().method).toBe("boleto");
    state.attemptId = crypto.randomUUID(); state.attemptStatus = "pending";
    state.payment = { id: "boleto-1", method: "boleto", status: "pending", statusDetail: "pending_waiting_payment", boletoCode: "23790000000000000000000000000000000000000000", boletoUrl: "https://www.mercadopago.com.br/ticket/test", expiresAt: new Date(Date.now() + 86400_000).toISOString() };
    const client = createClient({ url: process.env.E2E_DATABASE_URL! });
    const now = new Date().toISOString();
    await client.execute({ sql: "INSERT INTO payment_attempts (id, order_id, method, status, provider_payment_id, result, created_at, updated_at) VALUES (?, ?, 'boleto', 'pending', 'boleto-1', ?, ?, ?)", args: [state.attemptId, state.orderId, JSON.stringify(state.payment), now, now] });
    client.close();
    await route.fulfill({ json: state });
  });
  await page.goto(url);
  await page.getByRole("button", { name: /^Boleto/ }).click();
  await page.getByRole("button", { name: "Gerar boleto" }).click();
  await expect(page.getByRole("heading", { name: "Seu boleto foi gerado." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Código de barras", { exact: true })).toHaveValue(state.payment!.boletoCode!);
  await expect(page.getByRole("link", { name: "Ver ou imprimir boleto" })).toHaveAttribute("target", "_blank");
  await page.screenshot({ path: "screenshots/payment-boleto-desktop.png", fullPage: true });
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get(`http://127.0.0.1:3108/api/checkout/${state.orderId}/payment`)).status()).toBe(401);
  await anonymous.close();
});

test("a lost response retries the same submission and bank authentication stays embedded", async ({ page }) => {
  const { state, url, endpoint } = await setup(page);
  let original: unknown;
  await page.route("https://bank.example/challenge", route => route.fulfill({ body: "<p>Confirme a compra no aplicativo do banco.</p>", contentType: "text/html" }));
  await page.route(endpoint, async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: state });
    const payload = route.request().postDataJSON();
    if (!original) { original = payload; return route.abort("failed"); }
    expect(payload).toEqual(original);
    state.attemptId = crypto.randomUUID(); state.attemptStatus = "pending";
    state.payment = { id: "card-3ds", method: "card", status: "pending", statusDetail: "pending_challenge", challenge: { url: "https://bank.example/challenge", creq: "test-challenge" } };
    await route.fulfill({ json: state });
  });
  await page.goto(url);
  await fillCard(page);
  await page.getByRole("button", { name: "Pagar R$" }).click();
  await expect(page.getByRole("heading", { name: "Confirmando seu pagamento." })).toBeVisible();
  await page.getByRole("button", { name: "Verificar pagamento" }).click();
  await expect(page.frameLocator('iframe[name="artgian-bank-challenge"]').getByText("Confirme a compra no aplicativo do banco.")).toBeVisible();
  await expect(page).toHaveURL(url);
});
