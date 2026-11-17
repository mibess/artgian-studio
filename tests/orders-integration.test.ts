import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as database from "../db";
import { orderItems, orders } from "../db/schema";
import { parseOrdersIntegrationQuery } from "../lib/orders-integration";
import { GET as listOrders } from "../app/api/integrations/v1/orders/route";
import { GET as getOrder } from "../app/api/integrations/v1/orders/[id]/route";

const token = "integration-test-token-with-at-least-32-characters";
const instant = "2025-06-15T12:00:00.000Z";
const until = "2025-06-16T00:00:00.000Z";
let directory: string;
let db: Awaited<ReturnType<typeof database.getDb>>;
const request = (query = "", auth: string | null = `Bearer ${token}`) => new Request(`https://store.example/api/integrations/v1/orders${query ? `?${query}` : ""}`, { headers: auth === null ? {} : { authorization: auth } });
const detail = (id: string, auth: string | null = `Bearer ${token}`) => getOrder(request("", auth), { params: Promise.resolve({ id }) });
const list = (params: Record<string, string> = {}) => listOrders(request(new URLSearchParams(params).toString()));
async function insertOrder(id: string, values: Partial<typeof orders.$inferInsert> = {}) {
  await db.insert(orders).values({
    id, status: "paid", customerName: "Cliente Teste", customerEmail: "customer@example.test", customerPhone: "11999999999",
    customerDocument: "52998224725", postalCode: "01001000", streetAddress: "Praça da Sé", addressNumber: "42", addressComplement: "Apto 2",
    neighborhood: "Sé", city: "São Paulo", state: "SP", subtotalCents: 10000, discountCents: 1000, shippingCents: 1500, totalCents: 10500,
    checkoutUrl: "https://payment.example/secret-checkout", shippingLabelUrl: "https://label.example/secret-label",
    shippingLabelError: "private-label-error", fulfillmentNote: "private-internal-note", mercadoPagoPaymentId: "private-payment-id",
    mercadoPagoStatus: "approved", mercadoPagoStatusDetail: "private-provider-detail", shippingProvider: "super_frete",
    shippingServiceName: "PAC", shippingCompanyName: "Correios", shippingDeliveryTimeDays: 5, shippingTrackingCode: "AA123456789BR",
    createdAt: instant, updatedAt: instant, ...values,
  });
}
async function insertItem(orderId: string, productId = "product-1") {
  await db.insert(orderItems).values({ orderId, productId, productName: "Peça personalizada", color: "Azul", personalization: "Nome Ana", quantity: 2, unitPriceCents: 5000, shippingPackageSnapshot: "private-package-snapshot" });
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-orders-api-test-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  vi.stubEnv("TURSO_DATABASE_URL", ""); vi.stubEnv("TURSO_AUTH_TOKEN", "");
  db = await database.getDb();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.stubEnv("ARTGIAN_CRM_API_TOKEN", token);
  await db.delete(orderItems);
  await db.delete(orders);
});
afterAll(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("orders integration authorization", () => {
  it.each(["", "short", " contains-spaces-and-is-at-least-32-characters", "x".repeat(513)])("fails closed before opening the database for invalid configuration %j", async configuration => {
    vi.stubEnv("ARTGIAN_CRM_API_TOKEN", configuration);
    const spy = vi.spyOn(database, "getDb");
    for (const response of [await list(), await detail("any")]) {
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(spy).not.toHaveBeenCalled();
  });
  it.each([null, "Basic anything", "Bearer wrong", `Bearer ${token}-wrong`, `Bearer ${token}, Bearer ${token}`])("rejects credentials %j before any database access", async auth => {
    const spy = vi.spyOn(database, "getDb");
    for (const response of [await listOrders(request("", auth)), await detail("any", auth)]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("www-authenticate")).toContain("Bearer");
    }
    expect(spy).not.toHaveBeenCalled();
  });
  it("does not accept the token through URL parameters or cookies", async () => {
    expect((await listOrders(new Request(`https://store.example/api/integrations/v1/orders?token=${token}`, { headers: { cookie: `token=${token}` } }))).status).toBe(401);
  });
});

describe("orders integration contract", () => {
  it("returns a useful allowlisted order with prices in cents and distinct payment/fulfillment states", async () => {
    await insertOrder("order-a", { fulfillmentStatus: "shipped" });
    await insertItem("order-a");
    const response = await detail("order-a");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    const payload = await response.json();
    expect(payload.data).toMatchObject({
      source: "artgian_studio", id: "order-a", status: "paid",
      payment: { provider: "mercado_pago", status: "approved" }, fulfillment: { status: "shipped", updatedAt: null },
      customer: { name: "Cliente Teste", email: "customer@example.test", phone: "11999999999" },
      shippingAddress: { street: "Praça da Sé", number: "42", complement: "Apto 2", country: "BR" },
      items: [{ productId: "product-1", name: "Peça personalizada", color: "Azul", personalization: "Nome Ana", quantity: 2, unitPriceCents: 5000, totalCents: 10000 }],
      totals: { currency: "BRL", subtotalCents: 10000, discountCents: 1000, shippingCents: 1500, totalCents: 10500 },
      shipping: { provider: "super_frete", service: "PAC", company: "Correios", trackingCode: "AA123456789BR" },
      createdAt: instant, updatedAt: instant, effectiveUpdatedAt: instant,
    });
    expect(typeof payload.data.items[0].id).toBe("string");
    const serialized = JSON.stringify(payload);
    for (const forbidden of ["52998224725", "secret-checkout", "secret-label", "private-", "customerDocument", "checkoutUrl", "shippingLabelUrl", "requestPayload", "token"]) expect(serialized).not.toContain(forbidden);
    const listed = await (await list({ until })).json();
    expect(listed.data).toEqual([payload.data]);
    expect(listed.pagination).toMatchObject({ limit: 50, hasMore: false, nextCursor: null, until });
  });
  it("returns empty lists and 404 for a missing order, including no-store on errors", async () => {
    const empty = await list();
    expect((await empty.json()).data).toEqual([]);
    const missing = await detail("missing");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toContain("no-store");
    expect((await detail("bad/id")).status).toBe(400);
  });
  it("keeps database exceptions and secrets out of errors", async () => {
    vi.spyOn(database, "getDb").mockRejectedValueOnce(new Error("private-database-token"));
    const response = await list();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("private-database-token");
  });
});

describe("incremental order pagination", () => {
  it("normalizes SQLite and ISO timestamps before same-day bounds, sorting and output", async () => {
    await insertOrder("before", { updatedAt: "2025-06-15 08:00:00" });
    await insertOrder("at-start", { createdAt: "2025-06-15 09:00:00", updatedAt: "2025-06-15 09:00:00" });
    await insertOrder("iso-middle", { updatedAt: "2025-06-15T10:00:00.000Z" });
    await insertOrder("sqlite-end", { updatedAt: "2025-06-15 11:00:00" });
    await insertOrder("after", { updatedAt: "2025-06-15T11:00:00.001Z" });
    const payload = await (await list({ updated_since: "2025-06-15T06:00:00-03:00", until: "2025-06-15T11:00:00Z" })).json();
    expect(payload.data.map((order: { id: string }) => order.id)).toEqual(["at-start", "iso-middle", "sqlite-end"]);
    expect(payload.data[0].createdAt).toBe("2025-06-15T09:00:00.000Z");
    expect(payload.data[2].updatedAt).toBe("2025-06-15T11:00:00.000Z");
    expect(payload.pagination.updatedSince).toBe("2025-06-15T09:00:00.000Z");
  });
  it("finds fulfillment-only and shipping-only changes even when orders.updatedAt stays unchanged", async () => {
    await insertOrder("fulfillment", { updatedAt: "2025-06-14 12:00:00" });
    await insertOrder("label", { updatedAt: "2025-06-14T12:00:00.000Z" });
    await db.update(orders).set({ fulfillmentStatus: "shipped", fulfillmentUpdatedAt: instant }).where(eq(orders.id, "fulfillment"));
    await db.update(orders).set({ shippingLabelStatus: "generated", shippingLabelUpdatedAt: "2025-06-15 13:00:00" }).where(eq(orders.id, "label"));
    const payload = await (await list({ updated_since: instant, until })).json();
    expect(payload.data.map((order: { id: string }) => order.id)).toEqual(["fulfillment", "label"]);
    expect(payload.data[0]).toMatchObject({ updatedAt: "2025-06-14T12:00:00.000Z", effectiveUpdatedAt: instant, fulfillment: { status: "shipped", updatedAt: instant } });
    expect(payload.data[1].effectiveUpdatedAt).toBe("2025-06-15T13:00:00.000Z");
  });
  it("paginates tied timestamps by ID without splitting items, preserving bounds and limit with cursor alone", async () => {
    for (const id of ["c", "a", "b"]) await insertOrder(id);
    await insertOrder("outside-window", { updatedAt: "2025-06-17T00:00:00.000Z" });
    await insertItem("a", "product-1"); await insertItem("a", "product-2");
    const first = await (await list({ updated_since: instant, until, limit: "1" })).json();
    expect(first.data.map((order: { id: string }) => order.id)).toEqual(["a"]);
    expect(first.data[0].items).toHaveLength(2);
    expect(first.pagination.hasMore).toBe(true);
    const second = await (await list({ cursor: first.pagination.nextCursor })).json();
    expect(second.data.map((order: { id: string }) => order.id)).toEqual(["b"]);
    expect(second.pagination).toMatchObject({ limit: 1, updatedSince: instant, until, hasMore: true });
    const last = await (await list({ cursor: second.pagination.nextCursor })).json();
    expect(last.data.map((order: { id: string }) => order.id)).toEqual(["c"]);
    expect(last.pagination).toMatchObject({ hasMore: false, nextCursor: null, until });
  });
  it("fixes the initial until to server time and reuses it on subsequent pages", async () => {
    await insertOrder("a"); await insertOrder("b");
    const before = new Date().toISOString();
    const first = await (await list({ limit: "1" })).json();
    expect(first.pagination.until >= before).toBe(true);
    expect(first.pagination.until <= new Date().toISOString()).toBe(true);
    const second = await (await list({ cursor: first.pagination.nextCursor })).json();
    expect(second.pagination.until).toBe(first.pagination.until);
  });
  it("provides an overlapping resume point that captures a later insert with second-resolution SQLite timestamps", async () => {
    const previousUntil = "2025-06-15T12:00:00.500Z";
    const previous = await (await list({ until: previousUntil })).json();
    expect(previous.pagination.resumeFrom).toBe("2025-06-15T11:58:00.500Z");
    // Simulate checkout committing at .800 after the previous response: SQLite
    // CURRENT_TIMESTAMP stores only .000, earlier than that window's .500 bound.
    await insertOrder("late-checkout", { createdAt: "2025-06-15 12:00:00", updatedAt: "2025-06-15 12:00:00" });
    const withoutOverlap = await (await list({ updated_since: previousUntil, until })).json();
    expect(withoutOverlap.data).toEqual([]);
    const resumed = await (await list({ updated_since: previous.pagination.resumeFrom, until })).json();
    expect(resumed.data.map((order: { id: string }) => order.id)).toEqual(["late-checkout"]);
  });
  it("rejects tampered cursors, changed filters/limits, and cursors signed with the previous token", async () => {
    await insertOrder("a"); await insertOrder("b");
    const first = await (await list({ updated_since: instant, until, limit: "1" })).json();
    const cursor: string = first.pagination.nextCursor;
    const invalidQueries: Record<string, string>[] = [{ cursor: "broken" }, { cursor: `${cursor.slice(0, 2)}x${cursor.slice(3)}` }, { cursor, limit: "2" }, { cursor, updated_since: "2025-06-14T00:00:00Z" }, { cursor, until: "2025-06-15T23:00:00Z" }];
    for (const params of invalidQueries) {
      const spy = vi.spyOn(database, "getDb");
      const response = await list(params);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
    vi.stubEnv("ARTGIAN_CRM_API_TOKEN", `${token}-rotated`);
    expect((await listOrders(request(new URLSearchParams({ cursor }).toString(), `Bearer ${token}-rotated`))).status).toBe(400);
  });
  it.each(["limit=0", "limit=-1", "limit=101", "limit=1.5", "limit=abc", "limit=1&limit=2", "updated_since=2025-06-15", "updated_since=2025-06-15T10:00:00", "until=invalid", "until=2999-01-01T00:00:00Z", "unknown=true", "cursor="])("rejects malformed query %s before database access", async query => {
    const spy = vi.spyOn(database, "getDb");
    expect((await listOrders(request(query))).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
  it("accepts the maximum limit and rejects reversed windows", () => {
    const now = new Date(until);
    expect(parseOrdersIntegrationQuery(new URLSearchParams("limit=100"), token, now)).toMatchObject({ limit: 100, until });
    expect(() => parseOrdersIntegrationQuery(new URLSearchParams({ updated_since: until, until: instant }), token, now)).toThrow();
  });
});
