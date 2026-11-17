import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3108";
const customerApi = (orderId: string, itemId: number) => `/api/orders/${orderId}/items/${itemId}/messages`;
const sellerApi = (orderId: string, itemId: number) => `/api/admin/orders/${orderId}/items/${itemId}/messages`;
const conversationUrl = (orderId: string, itemId: number) => `/conta/pedidos/${orderId}/itens/${itemId}/mensagens`;

async function customer(page: Page) {
  const email = `chat-${crypto.randomUUID()}@example.com`;
  const password = "PurchaseChat!12345";
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.18.7.${Math.floor(Math.random() * 200) + 1}` });
  expect((await page.request.post(`${origin}/api/auth/sign-up/email`, { headers: { origin }, data: { name: "Cliente Mensagens", email, password } })).ok()).toBe(true);
  const db = createClient({ url: process.env.E2E_DATABASE_URL! });
  await db.execute({ sql: "UPDATE store_user SET email_verified = 1 WHERE email = ?", args: [email] });
  const userId = String((await db.execute({ sql: "SELECT id FROM store_user WHERE email = ?", args: [email] })).rows[0].id);
  db.close();
  expect((await page.request.post(`${origin}/api/auth/sign-in/email`, { headers: { origin }, data: { email, password } })).ok()).toBe(true);
  return { email, userId };
}

async function purchase(buyer: { email: string; userId: string }, status = "paid") {
  const db = createClient({ url: process.env.E2E_DATABASE_URL! });
  const orderId = crypto.randomUUID();
  await db.execute({ sql: `INSERT INTO orders (id, user_id, status, checkout_mode, customer_name, customer_email, customer_phone, postal_code, street_address, address_number, neighborhood, city, state, subtotal_cents, shipping_cents, total_cents) VALUES (?, ?, ?, 'embedded', 'Cliente Mensagens', ?, '11999999999', '01001000', 'Praça da Sé', '42', 'Sé', 'São Paulo', 'SP', 8500, 1500, 10000)`, args: [orderId, buyer.userId, status, buyer.email] });
  const itemIds: number[] = [];
  for (const [name, color] of [["Organizador Arco", "Rosa Marfim"], ["Peça personalizada antiga", "Azul"]]) {
    const result = await db.execute({ sql: "INSERT INTO order_items (order_id, product_id, product_name, color, personalization, quantity, unit_price_cents) VALUES (?, 'produto-chat', ?, ?, 'Para Marina', 1, 4250) RETURNING id", args: [orderId, name, color] });
    itemIds.push(Number(result.rows[0].id));
  }
  db.close();
  return { orderId, itemIds };
}

test("customer and seller exchange persistent messages for one purchased item", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const buyer = await customer(page);
  const { orderId, itemIds: [firstItem, secondItem] } = await purchase(buyer);
  await page.goto("/conta");
  const orderCard = page.getByRole("article", { name: `Pedido #${orderId.slice(0, 8)}` });
  await orderCard.getByText("Ver mais 1 item", { exact: true }).click();
  await expect(orderCard.getByRole("link", { name: /Falar com o vendedor/ })).toHaveCount(2);
  await orderCard.locator(`a[href="${conversationUrl(orderId, secondItem)}"]`).click();
  await expect(page.getByText("Peça personalizada antiga", { exact: true })).toBeVisible();
  const history = page.getByRole("log", { name: "Histórico da conversa" });
  await page.getByLabel("Sua mensagem", { exact: true }).fill("Posso confirmar a personalização desta peça?");
  // Lose only the first send response after the server has accepted it. A retry
  // must retain its idempotency key instead of delivering the text twice.
  const sendUrl = `${origin}${customerApi(orderId, secondItem)}`;
  let loseFirstSendResponse = true;
  await page.route(sendUrl, async route => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (!body?.body || !loseFirstSendResponse) return route.continue();
    loseFirstSendResponse = false;
    await route.fetch();
    await route.abort("connectionfailed");
  });
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Sua mensagem", { exact: true })).toHaveValue("Posso confirmar a personalização desta peça?");
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect(history.getByText("Posso confirmar a personalização desta peça?", { exact: true })).toBeVisible();
  await page.reload();
  await expect(history.getByText("Posso confirmar a personalização desta peça?", { exact: true })).toBeVisible();
  expect((await (await page.request.get(customerApi(orderId, secondItem))).json()).messages).toHaveLength(1);
  expect((await (await page.request.get(customerApi(orderId, firstItem))).json()).messages).toHaveLength(0);
  await page.goto("/conta");

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto(`${origin}/admin/login?next=/admin/mensagens`);
  await admin.getByLabel("Usuário", { exact: true }).fill("artgian");
  await admin.getByLabel("Senha", { exact: true }).fill("teste-local");
  await admin.getByRole("button", { name: "Entrar no admin" }).click();
  const threadLink = admin.locator(`a[href="/admin/mensagens/${orderId}/${secondItem}"]`);
  await expect(threadLink).toContainText("Peça personalizada antiga");
  await expect(threadLink).toContainText("Posso confirmar a personalização desta peça?");
  await threadLink.click();
  await expect(admin.getByRole("log", { name: "Histórico da conversa" }).getByText("Posso confirmar a personalização desta peça?", { exact: true })).toBeVisible();
  await admin.getByLabel("Sua mensagem", { exact: true }).fill("Sim! A personalização será Para Marina, na cor azul.");
  await admin.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect(admin.getByRole("log", { name: "Histórico da conversa" }).getByText("Sim! A personalização será Para Marina, na cor azul.", { exact: true })).toBeVisible();
  await page.reload();
  await orderCard.getByText("Ver mais 1 item", { exact: true }).click();
  const customerLink = orderCard.locator(`a[href="${conversationUrl(orderId, secondItem)}"]`);
  await expect(customerLink).toContainText(/1 nova/);
  await customerLink.click();
  await expect(history.getByText("Sim! A personalização será Para Marina, na cor azul.", { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const data = await (await admin.request.get(`${origin}${sellerApi(orderId, secondItem)}`)).json();
    return data.messages.find((message: { sender: string }) => message.sender === "seller")?.readAt;
  }).toBeTruthy();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel("Sua mensagem", { exact: true })).toBeVisible();
  await page.screenshot({ path: "screenshots/order-messages-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "screenshots/order-messages-desktop.png", fullPage: true });

  // The open thread picks up a new seller reply without a reload.
  expect((await admin.request.post(`${origin}${sellerApi(orderId, secondItem)}`, { headers: { origin }, data: { body: "Pode acompanhar o preparo por aqui.", clientId: crypto.randomUUID() } })).status()).toBe(201);
  await page.bringToFront();
  await expect(history.getByText("Pode acompanhar o preparo por aqui.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.goto(`/conta/pedidos/${orderId}`);
  await expect(page.locator(`a[href="${conversationUrl(orderId, firstItem)}"]`)).toBeVisible();
  await expect(page.locator(`a[href="${conversationUrl(orderId, secondItem)}"]`)).toBeVisible();
  await adminContext.close();
});

test("purchase conversations reject anonymous access, other customers and mismatched order items", async ({ page, browser }) => {
  const buyer = await customer(page);
  const first = await purchase(buyer, "pending");
  const second = await purchase(buyer, "refunded");
  const path = customerApi(first.orderId, first.itemIds[0]);
  const sent = await page.request.post(path, { headers: { origin }, data: { body: "Preciso de ajuda com o pagamento.", clientId: crypto.randomUUID() } });
  expect(sent.status()).toBe(201);
  expect((await page.request.get(customerApi(second.orderId, second.itemIds[0]))).status()).toBe(200);
  expect((await page.request.get(customerApi(first.orderId, second.itemIds[0]))).status()).toBe(404);
  expect((await page.request.post(customerApi(first.orderId, second.itemIds[0]), { headers: { origin }, data: { body: "Pedido errado", clientId: crypto.randomUUID() } })).status()).toBe(404);
  const anonymousContext = await browser.newContext();
  const anonymous = await anonymousContext.newPage();
  expect((await anonymous.request.get(`${origin}${path}`)).status()).toBe(401);
  expect((await anonymous.request.get(`${origin}${sellerApi(first.orderId, first.itemIds[0])}`)).status()).toBe(401);
  await anonymous.goto(`${origin}${conversationUrl(first.orderId, first.itemIds[0])}`);
  await expect(anonymous).toHaveURL(/\/login\?next=/);
  await anonymousContext.close();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await customer(other);
  expect((await other.request.get(`${origin}${path}`)).status()).toBe(404);
  expect((await other.request.post(`${origin}${path}`, { headers: { origin }, data: { body: "Não deve aparecer", clientId: crypto.randomUUID() } })).status()).toBe(404);
  await other.goto(`${origin}${conversationUrl(first.orderId, first.itemIds[0])}`);
  await expect(other.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(other.getByText("Preciso de ajuda com o pagamento.", { exact: true })).toHaveCount(0);
  await otherContext.close();
});

test("conversation recovers every message after missed polls and loads older history", async ({ page }) => {
  test.setTimeout(60_000);
  const buyer = await customer(page);
  const { orderId, itemIds: [liveItem, historicalItem] } = await purchase(buyer);
  const endpoint = `${origin}${customerApi(orderId, liveItem)}`;
  expect((await page.request.post(endpoint, { headers: { origin }, data: { body: "Minha primeira pergunta.", clientId: crypto.randomUUID() } })).status()).toBe(201);

  // SSR still provides the existing message, but no browser poll can observe
  // any of the incoming batch until the simulated interruption ends.
  const pollPattern = `${endpoint}**`;
  await page.route(pollPattern, route => route.request().method() === "GET" ? route.abort("connectionfailed") : route.continue());
  await page.goto(conversationUrl(orderId, liveItem));
  const history = page.getByRole("log", { name: "Histórico da conversa" });
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await expect(history.getByText("Minha primeira pergunta.", { exact: true })).toBeVisible();

  const db = createClient({ url: process.env.E2E_DATABASE_URL! });
  try {
    for (const [itemId, count, prefix] of [[liveItem, 60, "Resposta acumulada"], [historicalItem, 105, "Mensagem histórica"]] as const) {
      await db.batch(Array.from({ length: count }, (_, index) => ({
        sql: "INSERT INTO order_item_messages (order_item_id, sender, body, client_id, created_at) VALUES (?, 'seller', ?, ?, ?)",
        args: [itemId, `${prefix} ${index + 1}`, crypto.randomUUID(), new Date().toISOString()],
      })), "write");
    }
  } finally { db.close(); }
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await page.unroute(pollPattern);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(history.getByRole("listitem")).toHaveCount(61, { timeout: 15_000 });
  await expect(history.getByText("Minha primeira pergunta.", { exact: true })).toHaveCount(1);
  // This message falls into the gap between the previous tail and latest 50.
  await expect(history.getByText("Resposta acumulada 5", { exact: true })).toHaveCount(1);
  await expect(history.getByText("Resposta acumulada 35", { exact: true })).toHaveCount(1);
  await expect(history.getByText("Resposta acumulada 60", { exact: true })).toHaveCount(1);

  await page.goto(conversationUrl(orderId, historicalItem));
  await expect(history.getByRole("listitem")).toHaveCount(50);
  await expect(history.getByText("Mensagem histórica 1", { exact: true })).toHaveCount(0);
  await expect(history.getByText("Mensagem histórica 105", { exact: true })).toHaveCount(1);
  const older = history.getByRole("button", { name: "Ver mensagens anteriores", exact: true });
  await older.click();
  await expect(history.getByRole("listitem")).toHaveCount(100);
  await older.click();
  await expect(history.getByRole("listitem")).toHaveCount(105);
  await expect(history.getByText("Mensagem histórica 1", { exact: true })).toHaveCount(1);
  await expect(history.getByText("Mensagem histórica 55", { exact: true })).toHaveCount(1);
  await expect(older).toHaveCount(0);
});
