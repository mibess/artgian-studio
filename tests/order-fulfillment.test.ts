import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orderFulfillmentEvents, orders, user } from "../db/schema";
import { fulfillmentUpdateSchema, getCustomerFulfillment, updateOrderFulfillment } from "../lib/order-fulfillment";
import { fulfillmentSteps } from "../lib/fulfillment-status";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../lib/admin-access";
import { POST } from "../app/api/admin/orders/[id]/fulfillment/route";

let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
let orderId: string;
const update = (status = "shipped", revision = 0, note = "Pedido enviado.", trackingCode = "AA123456789BR") => fulfillmentUpdateSchema.parse({ status, revision, note, trackingCode });
const context = () => ({ params: Promise.resolve({ id: orderId }) });
function request(input: Record<string, unknown>, { authenticated = true, origin = "https://store.example" } = {}) {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => form.set(key, String(value)));
  return new Request(`https://store.example/api/admin/orders/${orderId}/fulfillment`, { method: "POST", headers: { origin, ...(authenticated ? { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession()}` } : {}) }, body: form });
}
const history = () => db.select().from(orderFulfillmentEvents).where(eq(orderFulfillmentEvents.orderId, orderId));
const readOrder = async () => (await db.select().from(orders).where(eq(orders.id, orderId)))[0];

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-fulfillment-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  vi.stubEnv("TURSO_DATABASE_URL", ""); vi.stubEnv("TURSO_AUTH_TOKEN", "");
  db = await getDb();
  await db.insert(user).values({ id: "fulfillment-buyer", name: "Cliente Teste", email: "tracking@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
});
beforeEach(async () => {
  vi.stubEnv("ADMIN_USERNAME", "artgian"); vi.stubEnv("ADMIN_PASSWORD", "admin-test-only");
  await db.delete(orders);
  orderId = crypto.randomUUID();
  await db.insert(orders).values({
    id: orderId, userId: "fulfillment-buyer", status: "paid", checkoutMode: "embedded", mercadoPagoPaymentId: "payment-confirmed", mercadoPagoStatus: "approved",
    customerName: "Cliente Teste", customerEmail: "tracking@example.com", customerPhone: "11999999999", customerDocument: "52998224725",
    postalCode: "01001000", streetAddress: "Praça da Sé", addressNumber: "42", neighborhood: "Sé", city: "São Paulo", state: "SP", subtotalCents: 5500, shippingCents: 1500, totalCents: 7000,
  });
});
afterAll(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("manual order fulfillment", () => {
  it("starts paid orders in preparation and exposes them only to their owner", async () => {
    const data = await getCustomerFulfillment(orderId, "fulfillment-buyer");
    expect(data.order).toMatchObject({ fulfillmentStatus: "preparing", fulfillmentRevision: 0, fulfillmentUpdatedAt: null });
    expect(data.events).toEqual([]);
    await expect(getCustomerFulfillment(orderId, "another-customer")).rejects.toMatchObject({ status: 404 });
    await expect(getCustomerFulfillment(crypto.randomUUID(), "fulfillment-buyer")).rejects.toMatchObject({ status: 404 });
  });
  it("saves every delivery stage with history while preserving the payment and prices", async () => {
    let revision = 0;
    for (const step of fulfillmentSteps.slice(1)) {
      await updateOrderFulfillment(orderId, update(step.id, revision));
      const order = await readOrder();
      expect(order).toMatchObject({ fulfillmentStatus: step.id, fulfillmentRevision: ++revision, status: "paid", mercadoPagoPaymentId: "payment-confirmed", mercadoPagoStatus: "approved", subtotalCents: 5500, shippingCents: 1500, totalCents: 7000 });
    }
    expect((await history()).map(event => event.status)).toEqual(["ready_to_ship", "shipped", "out_for_delivery", "delivered"]);
    expect((await history()).every(event => event.source === "manual" && event.createdAt)).toBe(true);
  });
  it("allows local delivery without a tracking code and records a correction without erasing history", async () => {
    await updateOrderFulfillment(orderId, update("delivered", 0, "Entrega realizada em mãos.", ""));
    await updateOrderFulfillment(orderId, update("out_for_delivery", 1, "Correção: o pedido está com o entregador.", ""));
    expect((await readOrder()).shippingTrackingCode).toBeNull();
    expect(await history()).toHaveLength(2);
    expect((await history())[0].status).toBe("delivered");
  });
  it("does not duplicate an update when the same form is submitted twice", async () => {
    const input = update();
    expect(await updateOrderFulfillment(orderId, input)).toBe(true);
    expect(await updateOrderFulfillment(orderId, input)).toBe(false);
    expect(await history()).toHaveLength(1);
  });
  it("rejects stale tabs and serializes concurrent changes", async () => {
    const results = await Promise.allSettled([
      updateOrderFulfillment(orderId, update("ready_to_ship")),
      updateOrderFulfillment(orderId, update("shipped")),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await history()).toHaveLength(1);
    await expect(updateOrderFulfillment(orderId, update("delivered", 0))).rejects.toMatchObject({ status: 409 });
  });
  it.each(["pending", "rejected", "refunded", "charged_back", "cancelled"])("blocks updates for %s orders", async status => {
    await db.update(orders).set({ status }).where(eq(orders.id, orderId));
    await expect(updateOrderFulfillment(orderId, update())).rejects.toMatchObject({ status: 409 });
    expect(await history()).toHaveLength(0);
  });
  it("requires admin authentication and the same origin", async () => {
    expect((await POST(request(update(), { authenticated: false }), context())).status).toBe(401);
    expect((await POST(request(update(), { origin: "https://other.example" }), context())).status).toBe(403);
    expect((await POST(request(update(), { origin: "" }), context())).status).toBe(403);
    expect(await history()).toHaveLength(0);
  });
  it("saves through the admin route and rejects unsupported updates", async () => {
    const response = await POST(request(update()), context());
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).searchParams.get("message")).toContain("Acompanhamento atualizado");
    expect((await readOrder()).fulfillmentStatus).toBe("shipped");
    for (const invalid of [{ ...update(), status: "paid" }, { ...update(), note: "a".repeat(501) }, { ...update(), trackingCode: "https://untrusted.example" }, { ...update(), totalCents: 1 }]) {
      const denied = await POST(request(invalid), context());
      expect(new URL(denied.headers.get("location")!).searchParams.has("error")).toBe(true);
    }
    expect(await history()).toHaveLength(1);
  });
});
