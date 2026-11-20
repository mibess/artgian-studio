import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orderItems, orders } from "../db/schema";
import { listAdminOrders } from "../lib/admin-orders";
import { fulfillmentUpdateSchema, updateOrderFulfillment } from "../lib/order-fulfillment";
import { runShippingLabelAction } from "../lib/order-shipping-label";
import { setOrderTestMark, TEST_ORDER_BLOCKED } from "../lib/order-test-mark";
import { GET as getIntegrationOrder } from "../app/api/integrations/v1/orders/[id]/route";

const token = "integration-test-token-with-at-least-32-characters";
let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
let paidId: string;
let pendingId: string;

async function order(status: string) {
  const id = crypto.randomUUID();
  await db.insert(orders).values({
    id, status, checkoutMode: "embedded",
    customerName: "Cliente Teste", customerEmail: "cliente@example.com", customerPhone: "11999999999", customerDocument: "52998224725",
    postalCode: "01001000", streetAddress: "Praça da Sé", addressNumber: "42", neighborhood: "Sé", city: "São Paulo", state: "SP",
    subtotalCents: 5500, shippingCents: 1500, totalCents: 7000, shippingProvider: "super_frete", shippingServiceId: "1",
    paymentExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await db.insert(orderItems).values({ orderId: id, productId: "organizador-arco", productName: "Organizador Arco", color: "Areia", quantity: 1, unitPriceCents: 5500 });
  return id;
}
const queues = async () => (await listAdminOrders({ queue: "testes", query: "", page: 1 })).counts;

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-test-mark-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  vi.stubEnv("TURSO_DATABASE_URL", ""); vi.stubEnv("TURSO_AUTH_TOKEN", "");
  db = await getDb();
});
beforeEach(async () => {
  vi.stubEnv("ARTGIAN_CRM_API_TOKEN", token);
  await db.delete(orders);
  paidId = await order("paid");
  pendingId = await order("pending");
});
afterAll(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("pedidos de teste", () => {
  it("tira o pedido das filas e dos contadores sem apagar nada, e volta ao desmarcar", async () => {
    expect(await queues()).toMatchObject({ "a-enviar": 1, "aguardando-pagamento": 1, todos: 2, testes: 0 });
    expect(await setOrderTestMark(paidId, true)).toBe(true);
    expect(await setOrderTestMark(paidId, true)).toBe(false);
    expect(await queues()).toMatchObject({ "a-enviar": 0, "aguardando-pagamento": 1, todos: 1, testes: 1 });
    const tests = await listAdminOrders({ queue: "testes", query: "", page: 1 });
    expect(tests.orders.map(item => [item.id, Boolean(item.testMarkedLabel), item.status])).toEqual([[paidId, true, "paid"]]);
    expect((await listAdminOrders({ queue: "a-enviar", query: "", page: 1 })).orders).toHaveLength(0);
    expect(await setOrderTestMark(paidId, false)).toBe(true);
    expect(await queues()).toMatchObject({ "a-enviar": 1, todos: 2, testes: 0 });
    expect((await db.select().from(orderItems).where(eq(orderItems.orderId, paidId)))).toHaveLength(1);
  });

  it("não aceita atualização de entrega nem compra ou geração de etiqueta", async () => {
    await setOrderTestMark(paidId, true);
    const update = fulfillmentUpdateSchema.parse({ status: "ready_to_ship", revision: 0, note: "", trackingCode: "" });
    await expect(updateOrderFulfillment(paidId, update)).rejects.toMatchObject({ message: TEST_ORDER_BLOCKED, status: 409 });
    expect(await runShippingLabelAction(paidId, "create")).toEqual({ ok: false, message: TEST_ORDER_BLOCKED });
    expect(await runShippingLabelAction(paidId, "generate")).toEqual({ ok: false, message: TEST_ORDER_BLOCKED });
    // Checking a cancellation is still allowed (here it simply has no label to check).
    expect((await runShippingLabelAction(paidId, "sync")).message).not.toBe(TEST_ORDER_BLOCKED);
    expect((await db.select().from(orders).where(eq(orders.id, paidId)))[0].fulfillmentStatus).toBe("preparing");
    await setOrderTestMark(paidId, false);
    expect(await updateOrderFulfillment(paidId, update)).toBe(true);
  });

  it("avisa o CRM pela API de integração, com a alteração datada", async () => {
    await setOrderTestMark(pendingId, true);
    const response = await getIntegrationOrder(
      new Request(`https://store.example/api/integrations/v1/orders/${pendingId}`, { headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: pendingId }) },
    );
    const { data } = await response.json();
    expect(data).toMatchObject({ id: pendingId, test: true, status: "pending" });
    expect(Date.parse(data.updatedAt)).toBeGreaterThan(Date.parse("2026-01-01T00:00:00.000Z"));
  });
});
