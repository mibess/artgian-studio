import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { coupons, orderItems, orders, paymentAttempts, user } from "../db/schema";
import { applyEmbeddedPayment, getPaymentState, paymentSubmissionSchema, retryUncertainPayment, submitPayment } from "../lib/embedded-payments";
import { createOrReuseCheckoutOrder } from "../lib/checkout-orders";
import { GET, POST } from "../app/api/checkout/[id]/payment/route";
import { POST as webhook } from "../app/api/mercado-pago/webhook/route";
import type { MercadoPagoPayment } from "../lib/mercado-pago";

const mock = vi.hoisted(() => ({ fetch: vi.fn(), session: vi.fn() }));
vi.mock("../lib/auth", () => ({ getCustomerSession: mock.session }));
let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
let orderId: string;
let nextPayment: Partial<MercadoPagoPayment>;
const card = { token: "sdk-card-token", paymentMethodId: "visa", issuerId: "25", installments: 3, identificationNumber: "52998224725" };
const input = (method: "pix" | "boleto" | "card" = "pix") => ({ requestId: crypto.randomUUID(), method, ...(method === "card" ? { card } : {}) });
const context = () => ({ params: Promise.resolve({ id: orderId }) });
const request = (body?: unknown, origin = "https://store.example") => new Request(`https://store.example/api/checkout/${orderId}/payment`, body ? { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-payments-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/store.db`);
  vi.stubEnv("TURSO_DATABASE_URL", ""); vi.stubEnv("TURSO_AUTH_TOKEN", "");
  db = await getDb();
  await db.insert(user).values({ id: "buyer", name: "Cliente Teste", email: "buyer@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
});
beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(orders); await db.delete(coupons);
  orderId = crypto.randomUUID();
  await db.insert(orders).values({
    id: orderId, userId: "buyer", checkoutMode: "embedded", paymentExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    customerName: "Cliente Teste", customerEmail: "buyer@example.com", customerPhone: "11999999999", customerDocument: "52998224725",
    postalCode: "01001000", streetAddress: "Praça da Sé", addressNumber: "1", neighborhood: "Sé", city: "São Paulo", state: "SP",
    subtotalCents: 10_000, discountCents: 1_000, shippingCents: 1_500, totalCents: 10_500,
  });
  await db.insert(orderItems).values({ orderId, productId: "piece", productName: "Peça Artgian", color: "Marfim", quantity: 2, unitPriceCents: 5_000 });
  vi.stubEnv("APP_URL", "https://store.example");
  vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "test-only-token");
  vi.stubEnv("MERCADO_PAGO_ENVIRONMENT", "test");
  vi.stubEnv("MERCADO_PAGO_WEBHOOK_SECRET", "test-webhook-secret");
  mock.session.mockResolvedValue({ user: { id: "buyer", email: "buyer@example.com" } });
  nextPayment = { status: "pending", status_detail: "pending_waiting_transfer", point_of_interaction: { transaction_data: { qr_code: "pix-code", qr_code_base64: "aW1hZ2U=" } }, date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString() };
  mock.fetch.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/v1/payment_methods")) return Response.json([{ id: "visa", status: "active", payment_type_id: "credit_card" }, { id: "pix", status: "active", payment_type_id: "bank_transfer" }]);
    if (url.endsWith("/v1/payments") && options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      return Response.json({ id: 12345, currency_id: "BRL", transaction_amount: body.transaction_amount, external_reference: body.external_reference, metadata: body.metadata, date_last_updated: new Date().toISOString(), ...nextPayment });
    }
    throw new Error(`Unexpected provider call: ${url}`);
  });
  vi.stubGlobal("fetch", mock.fetch);
});
afterAll(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
const creationCalls = () => mock.fetch.mock.calls.filter(([url, options]) => url.endsWith("/v1/payments") && options?.method === "POST");
async function ageAttempt(id: string) { await db.update(paymentAttempts).set({ createdAt: new Date(Date.now() - 10_000).toISOString(), updatedAt: new Date(Date.now() - 10_000).toISOString() }).where(eq(paymentAttempts.id, id)); }
async function providerPayment(overrides: Partial<MercadoPagoPayment> = {}): Promise<MercadoPagoPayment> {
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, orderId));
  return { id: 12345, status: "approved", currency_id: "BRL", transaction_amount: 105, external_reference: orderId, metadata: { attempt_id: attempt.id }, date_last_updated: new Date(Date.now() + 1_000).toISOString(), ...overrides };
}

describe("embedded checkout", () => {
  it("creates Pix from the stored total, preserves the code and resumes without a second charge", async () => {
    const first = await submitPayment(orderId, "buyer", input());
    expect(first.payment).toMatchObject({ method: "pix", pixCode: "pix-code", status: "pending" });
    const body = JSON.parse(creationCalls()[0][1].body);
    expect(body).toMatchObject({ transaction_amount: 105, payment_method_id: "pix", external_reference: orderId, payer: { email: "buyer@example.com" } });
    expect(creationCalls()[0][1].headers["X-Idempotency-Key"]).toBe(first.attemptId);
    expect(await submitPayment(orderId, "buyer", input("boleto"))).toEqual(first);
    expect(creationCalls()).toHaveLength(1);
    expect((await db.select().from(paymentAttempts))[0].requestPayload).toBeNull();
  });
  it("charges card installments, applies approval and compares principal without buyer interest", async () => {
    nextPayment = { status: "approved", status_detail: "accredited", transaction_details: { total_paid_amount: 115.50 } };
    const result = await submitPayment(orderId, "buyer", { ...input("card"), deviceId: "test-device-1" });
    expect(result.orderStatus).toBe("paid");
    expect(JSON.parse(creationCalls()[0][1].body)).toMatchObject({ token: card.token, installments: 3, payment_method_id: "visa", three_d_secure_mode: "optional", transaction_amount: 105 });
    expect(creationCalls()[0][1].headers["X-meli-session-id"]).toBe("test-device-1");
    expect(JSON.stringify(result)).not.toContain(card.token);
    expect((await db.select().from(paymentAttempts))[0]).toMatchObject({ requestPayload: null, deviceId: null });
  });
  it("returns a boleto code and only trusted HTTPS document URLs", async () => {
    nextPayment = { status: "pending", status_detail: "pending_waiting_payment", barcode: { content: "23790000000000000000000000000000000000000000" }, transaction_details: { external_resource_url: "https://www.mercadopago.com.br/ticket/123" } };
    const result = await submitPayment(orderId, "buyer", input("boleto"));
    expect(result.payment).toMatchObject({ method: "boleto", boletoCode: nextPayment.barcode!.content, boletoUrl: nextPayment.transaction_details!.external_resource_url });
    expect(JSON.parse(creationCalls()[0][1].body).payer).toMatchObject({ first_name: "Cliente", last_name: "Teste", identification: { type: "CPF", number: "52998224725" }, address: { city: "São Paulo", federal_unit: "SP" } });
    await applyEmbeddedPayment(await providerPayment({ status: "pending", transaction_details: { external_resource_url: "https://evil.example/boleto" } }));
    expect((await getPaymentState(orderId, "buyer")).payment?.boletoUrl).toBeUndefined();
  });
  it("serializes simultaneous submissions, even with different methods and keys", async () => {
    const [first, second] = await Promise.all([submitPayment(orderId, "buyer", input()), submitPayment(orderId, "buyer", input("boleto"))]);
    expect(first.attemptId).toBe(second.attemptId);
    expect(creationCalls()).toHaveLength(1);
    expect(await db.select().from(paymentAttempts)).toHaveLength(1);
  });
  it("does not restart an uncertain charge; retry replays the exact payload and key", async () => {
    const original = mock.fetch.getMockImplementation()!;
    let lost = true;
    mock.fetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/v1/payments") && lost) { lost = false; throw new TypeError("Connection lost after sending payment"); }
      return original(url, options);
    });
    const first = await submitPayment(orderId, "buyer", input("card"));
    expect(first.attemptStatus).toBe("unknown");
    await ageAttempt(first.attemptId!);
    nextPayment = { status: "approved" };
    const retried = await retryUncertainPayment(orderId, "buyer", first.attemptId!);
    expect(retried.orderStatus).toBe("paid");
    expect(creationCalls()).toHaveLength(2);
    expect(creationCalls()[0][1].body).toEqual(creationCalls()[1][1].body);
    expect(creationCalls()[0][1].headers["X-Idempotency-Key"]).toEqual(creationCalls()[1][1].headers["X-Idempotency-Key"]);
  });
  it("reconciles a response lost during creation through an authenticated lookup", async () => {
    mock.fetch.mockRejectedValueOnce(new TypeError("lost"));
    const state = await submitPayment(orderId, "buyer", input());
    await ageAttempt(state.attemptId!);
    mock.fetch.mockResolvedValueOnce(Response.json({ results: [await providerPayment()] }));
    expect((await getPaymentState(orderId, "buyer", true)).orderStatus).toBe("paid");
    expect(mock.fetch.mock.calls.at(-1)![0]).toContain("/v1/payments/search?external_reference=");
  });
  it("lets a declined attempt retry while preventing replay of that attempt key", async () => {
    nextPayment = { status: "rejected", status_detail: "cc_rejected_insufficient_amount" };
    const data = input("card");
    const first = await submitPayment(orderId, "buyer", data);
    expect(first.attemptStatus).toBe("rejected");
    await ageAttempt(first.attemptId!);
    await submitPayment(orderId, "buyer", data);
    expect(creationCalls()).toHaveLength(1);
    nextPayment = { id: 12346, status: "approved" };
    expect((await submitPayment(orderId, "buyer", input())).orderStatus).toBe("paid");
    expect(creationCalls()).toHaveLength(2);
  });
  it("retains a 3DS challenge and confirms it through the provider", async () => {
    nextPayment = { status: "pending", status_detail: "pending_challenge", three_ds_info: { external_resource_url: "https://bank.example/challenge", creq: "bank-request" } };
    const result = await submitPayment(orderId, "buyer", input("card"));
    expect(result.payment?.challenge).toEqual({ url: "https://bank.example/challenge", creq: "bank-request" });
    await applyEmbeddedPayment(await providerPayment());
    const confirmed = await getPaymentState(orderId, "buyer");
    expect(confirmed.orderStatus).toBe("paid");
    expect(confirmed.payment?.challenge).toBeUndefined();
  });
  it("rejects wrong owners, foreign origins, anonymous calls and unsupported/raw payloads", async () => {
    expect((await POST(request(input(), "https://evil.example"), context())).status).toBe(403);
    mock.session.mockResolvedValueOnce(null);
    expect((await POST(request(input()), context())).status).toBe(401);
    mock.session.mockResolvedValueOnce({ user: { id: "another-buyer" } });
    expect((await GET(request(), context())).status).toBe(404);
    await expect(submitPayment(orderId, "another-buyer", input())).rejects.toThrow("Pedido não encontrado");
    for (const body of [{ ...input(), transaction_amount: 0.01 }, { ...input(), method: "wallet" }, { ...input("card"), card: { ...card, cvv: "123" } }]) {
      expect((await POST(request(body), context())).status).toBe(400);
    }
    expect(mock.fetch).not.toHaveBeenCalled();
    expect(paymentSubmissionSchema.safeParse({ ...input("card"), card: { ...card, identificationNumber: "11111111111" } }).success).toBe(false);
    await expect(submitPayment(orderId, "buyer", { ...input("card"), card: { ...card, paymentMethodId: "pix" } })).rejects.toThrow("Este cartão não está disponível");
    expect(creationCalls()).toHaveLength(0);
  });
  it("does not create charges after expiration or after a successful payment", async () => {
    await db.update(orders).set({ paymentExpiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(orders.id, orderId));
    expect((await POST(request(input()), context())).status).toBe(410);
    await db.update(orders).set({ status: "paid" }).where(eq(orders.id, orderId));
    expect((await submitPayment(orderId, "buyer", input())).orderStatus).toBe("paid");
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it("validates webhook signatures, totals and attempt ownership before changing an order", async () => {
    const state = await submitPayment(orderId, "buyer", input());
    expect(await applyEmbeddedPayment(await providerPayment({ transaction_amount: 1 }))).toBe(false);
    expect(await applyEmbeddedPayment(await providerPayment({ currency_id: "USD" }))).toBe(false);
    expect(await applyEmbeddedPayment(await providerPayment({ metadata: { attempt_id: crypto.randomUUID() } }))).toBe(false);
    expect((await getPaymentState(orderId, "buyer")).orderStatus).toBe("pending");
    vi.stubEnv("MERCADO_PAGO_ENVIRONMENT", "production");
    const event = new Request("https://store.example/api/mercado-pago/webhook", { method: "POST", body: JSON.stringify({ type: "payment", data: { id: 12345 } }) });
    expect((await webhook(event)).status).toBe(401);
    expect((await getPaymentState(orderId, "buyer")).attemptId).toBe(state.attemptId);
  });
  it("applies a signed payment webhook and serves only the sanitized state to the owner", async () => {
    await submitPayment(orderId, "buyer", input());
    vi.stubEnv("MERCADO_PAGO_ENVIRONMENT", "production");
    const requestId = "signed-notification";
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", "test-webhook-secret").update(`id:12345;request-id:${requestId};ts:${timestamp};`).digest("hex");
    mock.fetch.mockResolvedValueOnce(Response.json(await providerPayment()));
    const notification = new Request("https://store.example/api/mercado-pago/webhook", { method: "POST", headers: { "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${signature}` }, body: JSON.stringify({ type: "payment", data: { id: 12345 } }) });
    expect((await webhook(notification)).status).toBe(200);
    const response = await GET(request(), context());
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const state = await response.json();
    expect(state.orderStatus).toBe("paid");
    expect(state).not.toHaveProperty("requestPayload");
    expect(state).not.toHaveProperty("customerDocument");
  });
  it("does not downgrade a paid order with late pending events, and processes refunds", async () => {
    await submitPayment(orderId, "buyer", input());
    const approved = await providerPayment();
    await applyEmbeddedPayment(approved);
    await applyEmbeddedPayment({ ...approved, status: "pending", date_last_updated: new Date(Date.now() - 1000).toISOString() });
    expect((await getPaymentState(orderId, "buyer")).orderStatus).toBe("paid");
    await applyEmbeddedPayment({ ...approved, status: "refunded", date_last_updated: new Date(Date.now() + 2000).toISOString() });
    expect((await getPaymentState(orderId, "buyer")).orderStatus).toBe("refunded");
    await applyEmbeddedPayment(approved);
    expect((await getPaymentState(orderId, "buyer")).orderStatus).toBe("refunded");
  });
  it("redeems a game coupon once even if approval arrives more than once", async () => {
    const now = new Date().toISOString();
    await db.insert(coupons).values({ id: "coupon", code: "GAME10", source: "game", kind: "percent", value: 10, allocatedUses: 1, createdAt: now, updatedAt: now });
    await db.update(orders).set({ couponId: "coupon", couponCode: "GAME10" }).where(eq(orders.id, orderId));
    await submitPayment(orderId, "buyer", input());
    const approved = await providerPayment();
    await applyEmbeddedPayment(approved); await applyEmbeddedPayment(approved);
    expect(await db.select().from(coupons)).toHaveLength(0);
    expect((await db.select().from(orders))[0].couponRedeemedAt).toBeTruthy();
  });
  it("resumes an already issued boleto even after the session and coupon expire", async () => {
    await db.update(orders).set({ discountCents: 0, totalCents: 11500 }).where(eq(orders.id, orderId));
    await submitPayment(orderId, "buyer", input("boleto"));
    await db.update(orders).set({ paymentExpiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(orders.id, orderId));
    const [order] = await db.select().from(orders);
    const items = await db.select().from(orderItems);
    const result = await createOrReuseCheckoutOrder(db, { ...order, id: crypto.randomUUID() }, items);
    expect(result).toMatchObject({ kind: "reused", orderId });
    expect(await db.select().from(orders)).toHaveLength(1);
  });
});
