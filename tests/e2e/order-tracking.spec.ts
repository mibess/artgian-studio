import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3108";

async function customer(page: Page) {
  const email = `tracking-${crypto.randomUUID()}@example.com`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.19.2.${Math.floor(Math.random() * 200) + 1}` });
  expect((await page.request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "Cliente Acompanhamento", email, password: "TrackingTest!12345" } })).ok()).toBe(true);
  const client = createClient({ url: process.env.E2E_DATABASE_URL! });
  await client.execute({ sql: "UPDATE store_user SET email_verified = 1 WHERE email = ?", args: [email] });
  const userId = String((await client.execute({ sql: "SELECT id FROM store_user WHERE email = ?", args: [email] })).rows[0].id);
  client.close();
  expect((await page.request.post("/api/auth/sign-in/email", { headers: { origin }, data: { email, password: "TrackingTest!12345" } })).ok()).toBe(true);
  return { email, userId };
}

async function order(buyer: { email: string; userId: string }, status = "paid", mode = "embedded") {
  const client = createClient({ url: process.env.E2E_DATABASE_URL! });
  const orderId = crypto.randomUUID();
  await client.execute({ sql: `INSERT INTO orders (id, user_id, status, checkout_mode, customer_name, customer_email, customer_phone, customer_document, postal_code, street_address, address_number, neighborhood, city, state, subtotal_cents, shipping_cents, total_cents, shipping_service_name) VALUES (?, ?, ?, ?, 'Cliente Acompanhamento', ?, '11999999999', '52998224725', '01001000', 'Praça da Sé', '42', 'Sé', 'São Paulo', 'SP', 5500, 1500, 7000, 'Correios · PAC')`, args: [orderId, buyer.userId, status, mode, buyer.email] });
  await client.execute({ sql: "INSERT INTO order_items (order_id, product_id, product_name, color, quantity, unit_price_cents) VALUES (?, 'organizador-arco', 'Organizador Arco', 'Rosa Marfim', 1, 5500)", args: [orderId] });
  client.close();
  return orderId;
}

test("approved payment and account link to tracking, and manual admin updates reach the customer", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const buyer = await customer(page);
  const orderId = await order(buyer);
  const trackingUrl = `/conta/pedidos/${orderId}`;
  await page.goto(`/comprar/pagamento?pedido=${orderId}`);
  await expect(page.getByRole("heading", { name: "Pagamento confirmado." })).toBeVisible();
  await page.getByRole("link", { name: "Acompanhar pedido" }).click();
  await expect(page).toHaveURL(trackingUrl);
  await expect(page.getByRole("heading", { name: "Em preparação", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Etapas do pedido" }).getByRole("listitem")).toHaveCount(5);
  await page.screenshot({ path: "screenshots/order-tracking-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "screenshots/order-tracking-mobile.png", fullPage: true });

  await page.getByRole("link", { name: "Meus pedidos", exact: true }).click();
  await page.getByRole("link", { name: "Acompanhar pedido", exact: true }).click();
  await expect(page).toHaveURL(trackingUrl);

  // Keep the paid order on the second page to exercise access to older orders.
  for (let index = 0; index < 50; index++) await order(buyer, "pending");
  const seeder = createClient({ url: process.env.E2E_DATABASE_URL! });
  await seeder.execute({ sql: "UPDATE orders SET created_at = '2099-01-01 00:00:00' WHERE user_id = ? AND status = 'pending'", args: [buyer.userId] });
  seeder.close();

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto(`${origin}/admin/login?next=/admin/pedidos`);
  await admin.getByRole("textbox", { name: "Usuário", exact: true }).fill("artgian");
  await admin.getByLabel("Senha", { exact: true }).fill("teste-local");
  await admin.getByRole("button", { name: "Entrar no admin" }).click();
  await expect(admin.getByRole("heading", { name: "Pedidos, entregas e etiquetas" })).toBeVisible();
  await admin.getByRole("link", { name: "Pedidos anteriores" }).click();
  await expect(admin).toHaveURL(/page=2/);
  const section = admin.getByRole("region", { name: `Acompanhamento do pedido ${orderId.slice(0, 8)}` });
  for (const [status, label] of [["ready_to_ship", "Pronto para envio"], ["shipped", "Enviado"], ["out_for_delivery", "Saiu para entrega"], ["delivered", "Entregue"]]) {
    await section.getByLabel("Etapa do pedido").selectOption(status);
    await section.getByLabel("Código de rastreio (opcional)").fill("AA123456789BR");
    await section.getByLabel("Observação para o cliente (opcional)").fill(`Atualização da equipe: ${label}.`);
    await section.getByRole("button", { name: "Atualizar acompanhamento" }).click();
    await expect(admin.getByText("Acompanhamento atualizado. A nova etapa já está disponível para o cliente.", { exact: true })).toBeInViewport();
    await expect(section.getByLabel("Etapa do pedido")).toHaveValue(status);
    await expect(admin).toHaveURL(/page=2/);
    await page.getByRole("link", { name: "Atualizar acompanhamento" }).click();
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Acompanhamento da entrega" }).getByText(`Atualização da equipe: ${label}.`, { exact: true })).toBeVisible();
    await expect(page.getByText("AA123456789BR", { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Histórico de atualizações" }).getByRole("listitem")).toHaveCount(4);
  await section.screenshot({ path: "screenshots/order-tracking-admin.png" });
  await page.screenshot({ path: "screenshots/order-tracking-delivered-mobile.png", fullPage: true });
  await adminContext.close();

  const client = createClient({ url: process.env.E2E_DATABASE_URL! });
  const saved = (await client.execute({ sql: "SELECT status, total_cents, fulfillment_status FROM orders WHERE id = ?", args: [orderId] })).rows[0];
  expect(saved).toMatchObject({ status: "paid", total_cents: 7000, fulfillment_status: "delivered" });
  client.close();
});

test("tracking requires the owner, waits for payment, and supports previous checkout orders", async ({ page, browser }) => {
  const buyer = await customer(page);
  const pendingId = await order(buyer, "pending", "redirect");
  const paidId = await order(buyer, "paid", "redirect");
  await page.goto(`/comprar/sucesso?pedido=${paidId}`);
  await page.getByRole("link", { name: "Acompanhar pedido" }).click();
  await expect(page.getByRole("heading", { name: "Em preparação", exact: true })).toBeVisible();
  await page.goto(`/conta/pedidos/${pendingId}`);
  await expect(page.getByRole("heading", { name: "Aguardando pagamento" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Etapas do pedido" })).toHaveCount(0);
  await page.goto(`/comprar/pendente?pedido=${pendingId}`);
  await expect(page.getByRole("link", { name: "Acompanhar pedido" })).toHaveCount(0);

  const anonymousContext = await browser.newContext();
  const anonymous = await anonymousContext.newPage();
  await anonymous.goto(`${origin}/conta/pedidos/${paidId}`);
  await expect(anonymous).toHaveURL(/\/login\?next=/);
  await anonymousContext.close();
  // Keep the login page's background session requests out of API-driven sign-in.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await customer(other);
  await other.goto(`${origin}/conta/pedidos/${paidId}`);
  // Next's streamed notFound response can have HTTP 200; assert the rendered denial.
  await expect(other.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(other.getByRole("region", { name: "Acompanhamento da entrega" })).toHaveCount(0);
  await expect(other.getByText("Cliente Acompanhamento", { exact: true })).toHaveCount(0);
  await otherContext.close();
});
