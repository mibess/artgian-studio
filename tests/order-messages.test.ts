import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orderItemMessages, orderItems, orders, user } from "../db/schema";
import { getOrderMessageThread, getOrderMessageUnreadCounts, listOrderMessageInbox, markOrderMessagesRead, sendOrderMessage } from "../lib/order-messages";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../lib/admin-access";
import { GET as customerGet, POST as customerPost } from "../app/api/orders/[id]/items/[itemId]/messages/route";
import { GET as sellerGet, POST as sellerPost } from "../app/api/admin/orders/[id]/items/[itemId]/messages/route";

const mock = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("../lib/auth", () => ({ getCustomerSession: mock.session }));
const customer = { role: "customer", userId: "message-buyer" } as const;
const seller = { role: "seller" } as const;
let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
let orderId: string;
let otherOrderId: string;
let itemId: number;
let secondItemId: number;
let foreignItemId: number;
const input = (body = "Olá, gostaria de confirmar a personalização.") => ({ body, clientId: crypto.randomUUID() });
const context = (id = orderId, item = itemId) => ({ params: Promise.resolve({ id, itemId: String(item) }) });
function request(body?: unknown, { admin = false, origin = "https://store.example", method = body === undefined ? "GET" : "POST", query = "", headers = {} }: { admin?: boolean; origin?: string; method?: string; query?: string; headers?: Record<string, string> } = {}) {
  return new Request(`https://store.example/api/${admin ? "admin/" : ""}orders/${orderId}/items/${itemId}/messages${query}`, {
    method, headers: { origin, "Content-Type": "application/json", ...(admin ? { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession()}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-order-messages-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  db = await getDb();
  await db.insert(user).values(["message-buyer", "other-buyer"].map(id => ({ id, name: "Cliente Teste", email: `${id}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() })));
});
beforeEach(async () => {
  vi.stubEnv("ADMIN_USERNAME", "artgian"); vi.stubEnv("ADMIN_PASSWORD", "chat-test-only");
  mock.session.mockResolvedValue({ user: { id: customer.userId } });
  await db.delete(orders);
  orderId = crypto.randomUUID(); otherOrderId = crypto.randomUUID();
  await db.insert(orders).values([orderId, otherOrderId].map((id, index) => ({
    id, userId: index === 0 ? customer.userId : "other-buyer", status: "paid", customerName: "Cliente Teste", customerEmail: "shared@example.com", customerPhone: "11999999999",
    postalCode: "01001000", streetAddress: "Praça da Sé", addressNumber: "42", neighborhood: "Sé", city: "São Paulo", state: "SP", subtotalCents: 5500, shippingCents: 1500, totalCents: 7000,
  })));
  const inserted = await db.insert(orderItems).values([orderId, orderId, otherOrderId].map((id, index) => ({ orderId: id, productId: "product-no-longer-in-catalog", productName: `Peça ${index + 1}`, color: "Azul", personalization: "Marina", quantity: 1, unitPriceCents: 5500 }))).returning({ id: orderItems.id });
  [itemId, secondItemId, foreignItemId] = inserted.map(row => row.id);
});
afterAll(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("order item conversations", () => {
  it("opens an empty thread from the purchase snapshot and restricts every operation to its owner and item", async () => {
    const thread = await getOrderMessageThread(orderId, itemId, customer);
    expect(thread).toEqual({ order: { id: orderId, customerName: "Cliente Teste" }, item: { id: itemId, productName: "Peça 1", color: "Azul", personalization: "Marina", quantity: 1 }, messages: [], hasMore: false });
    await expect(getOrderMessageThread(orderId, itemId, { role: "customer", userId: "other-buyer" })).rejects.toMatchObject({ status: 404 });
    await expect(getOrderMessageThread(orderId, foreignItemId, seller)).rejects.toMatchObject({ status: 404 });
    await expect(getOrderMessageThread(otherOrderId, foreignItemId, customer)).rejects.toMatchObject({ status: 404 });
    await expect(sendOrderMessage(otherOrderId, foreignItemId, customer, input())).rejects.toMatchObject({ status: 404 });
    await expect(markOrderMessagesRead(otherOrderId, foreignItemId, customer, 1)).rejects.toMatchObject({ status: 404 });
    expect((await listOrderMessageInbox()).total).toBe(0);
  });

  it("saves a two-way conversation, preserving text and the immutable purchase details", async () => {
    const question = await sendOrderMessage(orderId, itemId, customer, input("  Posso alterar o nome?\nObrigada!  "));
    const answer = await sendOrderMessage(orderId, itemId, seller, input("Sim, vamos confirmar por aqui."));
    expect(question).toMatchObject({ body: "Posso alterar o nome?\nObrigada!", sender: "customer", readAt: null });
    expect(answer).toMatchObject({ sender: "seller", readAt: null });
    expect((await getOrderMessageThread(orderId, itemId, customer)).messages).toEqual([question, answer]);
    expect((await getOrderMessageThread(orderId, secondItemId, customer)).messages).toEqual([]);
    expect(await getOrderMessageUnreadCounts([orderId], "customer")).toEqual({ [itemId]: 1 });
    expect(await getOrderMessageUnreadCounts([orderId], "seller")).toEqual({ [itemId]: 1 });
    const [purchase] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(purchase).toMatchObject({ status: "paid", subtotalCents: 5500, totalCents: 7000 });
  });

  it("deduplicates simultaneous retries and rejects changing an accepted message under the same key", async () => {
    const message = input();
    const [first, retry] = await Promise.all([sendOrderMessage(orderId, itemId, customer, message), sendOrderMessage(orderId, itemId, customer, message)]);
    expect(first.id).toBe(retry.id);
    await expect(sendOrderMessage(orderId, itemId, customer, { ...message, body: "Outra mensagem" })).rejects.toMatchObject({ status: 409 });
    await sendOrderMessage(orderId, secondItemId, customer, message);
    await sendOrderMessage(orderId, itemId, seller, message);
    expect((await getOrderMessageThread(orderId, itemId, seller)).messages).toHaveLength(2);
  });

  it("marks only the counterpart's displayed messages and never marks newer messages or another item", async () => {
    const first = await sendOrderMessage(orderId, itemId, customer, input("Primeira"));
    const own = await sendOrderMessage(orderId, itemId, seller, input("Resposta"));
    const later = await sendOrderMessage(orderId, itemId, customer, input("Segunda"));
    await sendOrderMessage(orderId, secondItemId, customer, input("Outro produto"));
    await markOrderMessagesRead(orderId, itemId, seller, first.id);
    const [readFirst, unreadOwn, unreadLater] = (await getOrderMessageThread(orderId, itemId, seller)).messages;
    expect(readFirst.readAt).toEqual(expect.any(String));
    expect(unreadOwn).toEqual(own);
    expect(unreadLater).toEqual(later);
    expect(await getOrderMessageUnreadCounts([orderId], "seller")).toEqual({ [itemId]: 1, [secondItemId]: 1 });
    await markOrderMessagesRead(orderId, itemId, seller, first.id);
    expect((await getOrderMessageThread(orderId, itemId, seller)).messages[0].readAt).toBe(readFirst.readAt);
    expect(await getOrderMessageUnreadCounts([], "customer")).toEqual({});
  });

  it("paginates older messages without losing history or mixing products", async () => {
    await db.insert(orderItemMessages).values(Array.from({ length: 105 }, (_, index) => ({ orderItemId: itemId, sender: "customer" as const, body: `Mensagem ${index}`, clientId: crypto.randomUUID(), createdAt: new Date().toISOString() })));
    await sendOrderMessage(orderId, secondItemId, seller, input("Outro assunto"));
    const latest = await getOrderMessageThread(orderId, itemId, customer);
    expect(latest.hasMore).toBe(true);
    expect(latest.messages).toHaveLength(50);
    expect(latest.messages[0].body).toBe("Mensagem 55");
    const middle = await getOrderMessageThread(orderId, itemId, customer, latest.messages[0].id);
    const first = await getOrderMessageThread(orderId, itemId, customer, middle.messages[0].id);
    expect(middle.messages).toHaveLength(50); expect(middle.hasMore).toBe(true);
    expect(first.messages).toHaveLength(5); expect(first.hasMore).toBe(false);
    expect(new Set([...first.messages, ...middle.messages, ...latest.messages].map(message => message.id)).size).toBe(105);
    await expect(getOrderMessageThread(orderId, itemId, customer, -1)).rejects.toMatchObject({ status: 400 });
  });

  it("lists active threads with customer identity, latest message and unread count, and clamps inbox pages", async () => {
    const ids = (await db.insert(orderItems).values(Array.from({ length: 21 }, (_, index) => ({ orderId, productId: "same-product", productName: `Produto ${index}`, color: "Azul", quantity: 1, unitPriceCents: 100 }))).returning({ id: orderItems.id })).map(row => row.id);
    for (const [index, id] of ids.entries()) await sendOrderMessage(orderId, id, customer, input(`Mensagem ${index}`));
    await sendOrderMessage(orderId, ids[0], seller, input("Resposta mais recente"));
    const inbox = await listOrderMessageInbox();
    expect(inbox).toMatchObject({ total: 21, page: 1, pageCount: 2 });
    expect(inbox.threads).toHaveLength(20);
    expect(inbox.threads[0]).toMatchObject({ orderId, itemId: ids[0], productName: "Produto 0", customerName: "Cliente Teste", color: "Azul", lastBody: "Resposta mais recente", lastSender: "seller", unreadCount: 1 });
    expect((await listOrderMessageInbox(999)).threads).toHaveLength(1);
    expect((await listOrderMessageInbox(-1)).page).toBe(1);
    await markOrderMessagesRead(orderId, ids[0], seller, Number.MAX_SAFE_INTEGER);
    expect((await listOrderMessageInbox()).threads[0].unreadCount).toBe(0);
  });

  it("retains messaging for pending and closed purchases and cascades only when the purchase is deleted", async () => {
    for (const status of ["pending", "cancelled", "refunded"]) {
      await db.update(orders).set({ status }).where(eq(orders.id, orderId));
      await sendOrderMessage(orderId, itemId, customer, input(`Dúvida sobre pedido ${status}`));
    }
    expect((await getOrderMessageThread(orderId, itemId, customer)).messages).toHaveLength(3);
    await db.delete(orders).where(eq(orders.id, orderId));
    expect(await db.select().from(orderItemMessages)).toHaveLength(0);
  });
});

describe("order message routes", () => {
  it("authenticates both roles and rejects missing, foreign and cross-site origins", async () => {
    mock.session.mockResolvedValue(null);
    expect((await customerGet(request(), context())).status).toBe(401);
    expect((await customerPost(request(input()), context())).status).toBe(401);
    expect((await sellerGet(request(), context())).status).toBe(401);
    for (const origin of ["", "https://evil.example"]) {
      expect((await customerPost(request(input(), { origin }), context())).status).toBe(403);
      expect((await sellerPost(request(input(), { origin, admin: true }), context())).status).toBe(403);
    }
    expect((await customerPost(request(input(), { headers: { "sec-fetch-site": "cross-site" } }), context())).status).toBe(403);
    expect(await db.select().from(orderItemMessages)).toHaveLength(0);
  });

  it("does not let a customer select the sender, other owner or mismatched order item", async () => {
    for (const body of [{ ...input(), sender: "seller" }, { ...input(), userId: "other-buyer" }, { body: "   ", clientId: crypto.randomUUID() }, { body: "a".repeat(2001), clientId: crypto.randomUUID() }, { body: "Olá", clientId: "not-a-uuid" }])
      expect((await customerPost(request(body), context())).status).toBe(400);
    expect((await customerPost(request(input()), context(otherOrderId, foreignItemId))).status).toBe(404);
    expect((await customerGet(request(), context(orderId, foreignItemId))).status).toBe(404);
    expect((await sellerGet(request(undefined, { admin: true }), context(orderId, foreignItemId))).status).toBe(404);
    expect((await customerGet(request(), context(orderId, -1))).status).toBe(400);
    expect((await customerGet(request(undefined, { query: "?before=abc" }), context())).status).toBe(400);
  });

  it("returns private history, sends as the authenticated role, and only marks read after an explicit acknowledgment", async () => {
    const sent = await customerPost(request(input("Pergunta do cliente")), context());
    expect(sent.status).toBe(201);
    const question = (await sent.json()).message;
    expect(question.sender).toBe("customer");
    const reply = await sellerPost(request(input("Resposta da Artgian"), { admin: true }), context());
    expect(reply.status).toBe(201);
    expect((await reply.json()).message.sender).toBe("seller");
    const history = await sellerGet(request(undefined, { admin: true }), context());
    expect(history.headers.get("cache-control")).toBe("private, no-store");
    expect((await history.json()).messages[0].readAt).toBeNull();
    expect((await sellerPost(request({ action: "read", throughId: question.id }, { admin: true }), context())).status).toBe(200);
    expect((await getOrderMessageThread(orderId, itemId, customer)).messages[0].readAt).not.toBeNull();
    expect((await getOrderMessageThread(orderId, itemId, customer)).messages[1].readAt).toBeNull();
  });

  it("rejects invalid JSON, oversized payloads and forged read acknowledgments", async () => {
    const malformed = new Request("https://store.example/api/orders/test/items/1/messages", { method: "POST", headers: { origin: "https://store.example" }, body: "{" });
    expect((await customerPost(malformed, context())).status).toBe(400);
    expect((await customerPost(request(input("x".repeat(17000))), context())).status).toBe(400);
    expect((await customerPost(request({ action: "read", throughId: -1 }), context())).status).toBe(400);
    expect((await customerPost(request({ action: "read", throughId: 1, sender: "customer" }), context())).status).toBe(400);
  });
});
