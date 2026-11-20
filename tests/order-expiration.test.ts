import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { coupons, orders, paymentAttempts, user } from "../db/schema";
import { expireUnpaidOrders } from "../lib/order-expiration";
import { applyRedirectPayment } from "../lib/redirect-payments";
import type { MercadoPagoPayment } from "../lib/mercado-pago";

let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
const now = new Date("2026-11-20T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const sqliteDate = (iso: string) => iso.replace("T", " ").slice(0, 19);

async function order(overrides: Partial<typeof orders.$inferInsert> = {}) {
  const id = crypto.randomUUID();
  await db.insert(orders).values({
    id, userId: "buyer", status: "pending", checkoutMode: "embedded",
    customerName: "Cliente Teste", customerEmail: "cliente@example.com", customerPhone: "11999999999", customerDocument: "52998224725",
    postalCode: "01001000", streetAddress: "Praça da Sé", addressNumber: "42", neighborhood: "Sé", city: "São Paulo", state: "SP",
    subtotalCents: 5500, shippingCents: 1500, totalCents: 7000,
    paymentExpiresAt: hoursAgo(1), createdAt: sqliteDate(hoursAgo(25)),
    ...overrides,
  });
  return id;
}
const status = async (id: string) => (await db.select({ status: orders.status }).from(orders).where(eq(orders.id, id)))[0].status;
async function attempt(orderId: string, attemptStatus: string, createdAt = hoursAgo(2)) {
  await db.insert(paymentAttempts).values({ id: crypto.randomUUID(), orderId, method: "pix", status: attemptStatus, createdAt, updatedAt: createdAt });
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-expiration-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  vi.stubEnv("TURSO_DATABASE_URL", ""); vi.stubEnv("TURSO_AUTH_TOKEN", "");
  db = await getDb();
  await db.insert(user).values({ id: "buyer", name: "Cliente Teste", email: "cliente@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await db.insert(user).values({ id: "other", name: "Outra Pessoa", email: "outra@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
});
beforeEach(async () => {
  await db.delete(paymentAttempts);
  await db.delete(orders);
  await db.delete(coupons);
});
afterAll(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("expiração de pedidos não pagos", () => {
  it("cancela o checkout cujo prazo terminou e mantém o que ainda está no prazo", async () => {
    const late = await order();
    const onTime = await order({ paymentExpiresAt: new Date(now.getTime() + 3_600_000).toISOString() });
    expect(await expireUnpaidOrders({ now })).toBe(1);
    expect(await status(late)).toBe("cancelled");
    expect(await status(onTime)).toBe("pending");
    expect(await expireUnpaidOrders({ now })).toBe(0);
  });

  it("cancela depois de uma tentativa recusada, mas espera o Pix ou boleto emitido", async () => {
    const declined = await order();
    await attempt(declined, "rejected");
    const pix = await order();
    await attempt(pix, "pending");
    const uncertain = await order();
    await attempt(uncertain, "unknown");
    const forgotten = await order({ paymentExpiresAt: hoursAgo(40 * 24) });
    await attempt(forgotten, "pending", hoursAgo(31 * 24));
    expect(await expireUnpaidOrders({ now })).toBe(2);
    expect(await status(declined)).toBe("cancelled");
    expect(await status(pix)).toBe("pending");
    expect(await status(uncertain)).toBe("pending");
    expect(await status(forgotten)).toBe("cancelled");
  });

  it("nunca altera pedidos pagos, estornados ou já cancelados", async () => {
    const ids = await Promise.all(["paid", "refunded", "rejected"].map(value => order({ status: value })));
    expect(await expireUnpaidOrders({ now })).toBe(0);
    expect(await Promise.all(ids.map(status))).toEqual(["paid", "refunded", "rejected"]);
  });

  it("devolve a vaga do cupom reservado, uma única vez", async () => {
    const created = now.toISOString();
    await db.insert(coupons).values({ id: "coupon", code: "BEMVINDO10", source: "admin", kind: "percent", value: 10, maxUses: 5, allocatedUses: 2, createdAt: created, updatedAt: created });
    await order({ couponId: "coupon", couponCode: "BEMVINDO10", discountCents: 550, totalCents: 6450 });
    await order({ couponId: "coupon", couponCode: "BEMVINDO10", discountCents: 550, totalCents: 6450, paymentExpiresAt: new Date(now.getTime() + 3_600_000).toISOString() });
    await expireUnpaidOrders({ now });
    await expireUnpaidOrders({ now });
    expect((await db.select().from(coupons))[0].allocatedUses).toBe(1);
  });

  it("dá 7 dias aos pedidos do checkout antigo, que não tinham prazo", async () => {
    const recent = await order({ checkoutMode: "redirect", paymentExpiresAt: null, createdAt: sqliteDate(hoursAgo(6 * 24)) });
    const old = await order({ checkoutMode: "redirect", paymentExpiresAt: null, createdAt: sqliteDate(hoursAgo(8 * 24)) });
    const boleto = await order({ checkoutMode: "redirect", paymentExpiresAt: null, mercadoPagoStatus: "pending", createdAt: sqliteDate(hoursAgo(8 * 24)) });
    expect(await expireUnpaidOrders({ now })).toBe(1);
    expect(await status(recent)).toBe("pending");
    expect(await status(old)).toBe("cancelled");
    expect(await status(boleto)).toBe("pending");
  });

  it("limita a expiração ao cliente que abriu a própria conta", async () => {
    const mine = await order();
    const theirs = await order({ userId: "other" });
    expect(await expireUnpaidOrders({ now, userId: "buyer" })).toBe(1);
    expect(await status(mine)).toBe("cancelled");
    expect(await status(theirs)).toBe("pending");
  });

  it("um pagamento aprovado depois da expiração ainda confirma o pedido", async () => {
    const id = await order({ checkoutMode: "redirect", paymentExpiresAt: null, createdAt: sqliteDate(hoursAgo(8 * 24)) });
    await expireUnpaidOrders({ now });
    expect(await status(id)).toBe("cancelled");
    const payment = { id: 123, status: "approved", status_detail: "accredited", external_reference: id, currency_id: "BRL", transaction_amount: 70, payment_method_id: "pix", payment_type_id: "bank_transfer" } as unknown as MercadoPagoPayment;
    expect(await applyRedirectPayment(payment)).toBe(true);
    expect(await status(id)).toBe("paid");
  });
});
