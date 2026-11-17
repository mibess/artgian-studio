import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { notifyOutbox, orderFulfillmentEvents, orders, paymentAttempts, user } from "../db/schema";
import { applyEmbeddedPayment, getPaymentState, submitPayment } from "../lib/embedded-payments";
import { applyRedirectPayment } from "../lib/redirect-payments";
import { updateOrderFulfillment } from "../lib/order-fulfillment";
import { enqueueOrderPaid } from "../lib/mibess-notify/outbox";
import { claimNotifyEvent, NOTIFY_LEASE_MS, NOTIFY_MAX_ATTEMPTS, requeueNotifyEvent, runNotifyBatch } from "../lib/mibess-notify/publisher";
import { notifyPublisherConfig } from "../lib/mibess-notify/config";
import { POST as webhook } from "../app/api/mercado-pago/webhook/route";
import { POST as wake } from "../app/api/tasks/notify/route";
import type { MercadoPagoPayment } from "../lib/mercado-pago";

let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
let orderId: string;
let attemptId: string;
const fetchMock = vi.fn();
const hml = "https://notify-hml.mibess.com.br";
const prd = "https://notify.mibess.com.br";
const provider = (overrides: Partial<MercadoPagoPayment> = {}): MercadoPagoPayment => ({ id: 12345, status: "approved", external_reference: orderId, currency_id: "BRL", transaction_amount: 189.9, metadata: { attempt_id: attemptId }, payment_method_id: "pix", ...overrides });
const rows = () => db.select().from(notifyOutbox);
const row = async () => (await rows())[0];
const order = async () => (await db.select().from(orders).where(eq(orders.id, orderId)))[0];
const accepted = (duplicate = false, eventId = crypto.randomUUID()) => Response.json({ eventId, status: "ACCEPTED", duplicate }, { status: 202 });
const transition = (status: "preparing" | "ready_to_ship" | "shipped" | "out_for_delivery" | "delivered", revision: number, trackingCode = "", note = "") => updateOrderFulfillment(orderId, { status, revision, trackingCode, note });
const due = () => db.update(notifyOutbox).set({ nextAttemptAt: "2000-01-01T00:00:00.000Z" });
const expire = () => db.update(notifyOutbox).set({ leaseExpiresAt: "2000-01-01T00:00:00.000Z" });
async function approve() { await applyEmbeddedPayment(provider()); return row(); }
function notification() { return new Request("https://store.example/api/mercado-pago/webhook", { method: "POST", body: JSON.stringify({ type: "payment", data: { id: 12345 } }) }); }

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-notify-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  vi.stubEnv("TURSO_DATABASE_URL", ""); vi.stubEnv("TURSO_AUTH_TOKEN", "");
  db = await getDb();
  await db.insert(user).values({ id: "notify-buyer", name: "Mariana", email: "notify@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
});
beforeEach(async () => {
  vi.stubEnv("MIBESS_NOTIFY_ENABLED", "true");
  vi.stubEnv("MIBESS_NOTIFY_BASE_URL", `${hml}/`);
  vi.stubEnv("MIBESS_NOTIFY_API_KEY", "isolated-notify-key");
  vi.stubEnv("APP_URL", "https://store.example");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "isolated-mp-token");
  vi.stubEnv("MERCADO_PAGO_ENVIRONMENT", "test");
  vi.stubEnv("MERCADO_PAGO_WEBHOOK_SECRET", "isolated-webhook-secret");
  vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "isolated-current-signing-key");
  vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "isolated-next-signing-key");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await db.delete(notifyOutbox); await db.delete(orders);
  orderId = crypto.randomUUID(); attemptId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(orders).values({ id: orderId, userId: "notify-buyer", checkoutMode: "embedded", customerName: "Mariana", customerEmail: "notify@example.com", customerPhone: "11999999999", customerDocument: "52998224725", postalCode: "01001000", streetAddress: "Praça da Sé", addressNumber: "1", neighborhood: "Sé", city: "São Paulo", state: "SP", subtotalCents: 17000, shippingCents: 1990, totalCents: 18990, paymentExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  await db.insert(paymentAttempts).values({ id: attemptId, orderId, method: "pix", status: "pending", createdAt: now, updatedAt: now });
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await rm(directory, { recursive: true, force: true }); });

describe("transactional business events", () => {
  it("does not emit for pending payments or invalid identity, value, currency or attempt", async () => {
    for (const change of [{ status: "pending" }, { currency_id: "USD" }, { transaction_amount: 1 }, { external_reference: "unknown" }, { metadata: { attempt_id: "unknown" } }, { id: 54321 }]) {
      await db.update(paymentAttempts).set({ providerPaymentId: "12345" });
      await applyEmbeddedPayment(provider(change));
    }
    expect(await rows()).toHaveLength(0);
    expect((await order()).status).toBe("pending");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("records exactly one approval across concurrent webhook and reconciliation, with a private immutable snapshot", async () => {
    await db.update(paymentAttempts).set({ providerPaymentId: "12345", updatedAt: "2000-01-01T00:00:00.000Z" });
    fetchMock.mockImplementation(async (url: string) => {
      expect(url).toBe("https://api.mercadopago.com/v1/payments/12345");
      return Response.json(provider());
    });
    const results = await Promise.allSettled([webhook(notification()), webhook(notification()), getPaymentState(orderId, "notify-buyer", true), applyEmbeddedPayment(provider())]);
    expect(results.every(r => r.status === "fulfilled")).toBe(true);
    for (const result of results.slice(0, 2)) if (result.status === "fulfilled") expect((result.value as Response).status, await (result.value as Response).clone().text()).toBe(200);
    expect(await rows()).toHaveLength(1);
    const event = await row();
    expect(event.idempotencyKey).toBe(`artgian:order:${orderId}:paid:v1`);
    const payload = JSON.parse(event.payload);
    expect(payload).toEqual({ type: "ORDER_PAID", occurredAt: event.occurredAt, correlationId: `artgian-order-${orderId}`, data: { orderId, orderNumber: orderId.slice(0, 8), customerName: "Mariana", amount: 189.9, amountFormatted: "R$ 189,90", currency: "BRL", paymentMethod: "PIX" } });
    expect(event.payload).not.toMatch(/recipient|52998224725|11999999999|Praça|provider|applicationId/);
    expect(Buffer.byteLength(event.payload)).toBeLessThan(64 * 1024);
    await db.update(orders).set({ customerName: "Alterado", totalCents: 999 });
    expect((await row()).payload).toBe(event.payload);
    for (const change of [{ payload: "{}" }, { idempotencyKey: "another" }, { occurredAt: "other" }, { targetOrigin: prd }]) {
      await expect(db.update(notifyOutbox).set(change)).rejects.toThrow();
    }
    await expect(db.insert(notifyOutbox).values({ ...event, id: crypto.randomUUID() })).rejects.toThrow();
  });
  it("covers immediate approval from the existing payment creation path without contacting Notify", async () => {
    await db.delete(paymentAttempts);
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
      expect(url).toBe("https://api.mercadopago.com/v1/payments");
      const body = JSON.parse(String(options.body));
      return Response.json(provider({ metadata: body.metadata }));
    });
    const result = await submitPayment(orderId, "notify-buyer", { requestId: attemptId, method: "pix" });
    expect(result.orderStatus).toBe("paid");
    expect(await rows()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("records legacy approvals once and ignores late pending or foreign settled payments", async () => {
    await db.update(orders).set({ checkoutMode: "redirect" });
    fetchMock.mockImplementation(async () => Response.json(provider()));
    await Promise.all([webhook(notification()), applyRedirectPayment(provider()), applyRedirectPayment(provider())]);
    expect(await rows()).toHaveLength(1);
    await applyRedirectPayment(provider({ status: "pending" }));
    await applyRedirectPayment(provider({ id: 789 }));
    expect((await order()).status).toBe("paid");
    await applyRedirectPayment(provider({ status: "refunded" }));
    await applyRedirectPayment(provider());
    expect((await order()).status).toBe("refunded");
    expect(await rows()).toHaveLength(1);
  });
  it("rejects invalid legacy value/currency and provider lookup identity", async () => {
    await db.update(orders).set({ checkoutMode: "redirect" });
    expect(await applyRedirectPayment(provider({ currency_id: "USD" }))).toBe(false);
    expect(await applyRedirectPayment(provider({ transaction_amount: 190 }))).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json(provider({ id: 999 })));
    await webhook(notification());
    expect(await rows()).toHaveLength(0);
  });
  it("only emits supported stage transitions, including legitimate returns to the same stage", async () => {
    await db.update(orders).set({ status: "paid" });
    await transition("ready_to_ship", 0);
    await transition("shipped", 1);
    await transition("shipped", 1); // repeated form
    await transition("shipped", 2, "CODE123", "Correction only");
    await transition("out_for_delivery", 3, "CODE123");
    await transition("delivered", 4);
    await transition("preparing", 5, "", "Correção");
    await transition("shipped", 6);
    const events = await rows();
    expect(events.map(e => e.type)).toEqual(["TRACKING_POSTED", "TRACKING_STATUS_CHANGED", "TRACKING_STATUS_CHANGED", "TRACKING_POSTED"]);
    expect(events.map(e => JSON.parse(e.payload).data.status)).toEqual(["POSTED", "OUT_FOR_DELIVERY", "DELIVERED", "POSTED"]);
    expect(JSON.parse(events[0].payload).data).not.toHaveProperty("trackingCode");
    expect(JSON.parse(events[1].payload).data.trackingCode).toBe("CODE123");
    expect(new Set(events.map(e => e.idempotencyKey)).size).toBe(4);
    const history = await db.select().from(orderFulfillmentEvents);
    for (const e of events) expect(history.some(h => e.idempotencyKey === `artgian:order:${orderId}:fulfillment:${h.id}:v1` && e.occurredAt === h.createdAt)).toBe(true);
  });
  it("rolls back business, history and outbox together when the transaction aborts after insertion", async () => {
    await db.run(sql.raw("CREATE TRIGGER notify_test_abort AFTER INSERT ON notify_outbox BEGIN SELECT RAISE(ABORT, 'test rollback'); END;"));
    try {
      await expect(applyEmbeddedPayment(provider())).rejects.toThrow();
      expect((await order()).status).toBe("pending");
      expect(await rows()).toHaveLength(0);
      expect((await db.select().from(paymentAttempts))[0].status).toBe("pending");
      await db.update(orders).set({ status: "paid" });
      await expect(transition("shipped", 0)).rejects.toThrow();
      expect((await order()).fulfillmentRevision).toBe(0);
      expect(await db.select().from(orderFulfillmentEvents)).toHaveLength(0);
      expect(await rows()).toHaveLength(0);
    } finally { await db.run(sql.raw("DROP TRIGGER notify_test_abort")); }
    await expect(db.transaction(async tx => { await enqueueOrderPaid(tx, { ...await order(), status: "pending" }, new Date().toISOString(), "PIX"); throw new Error("rollback"); })).rejects.toThrow("rollback");
    expect(await rows()).toHaveLength(0);
  });
  it("disabled flag neither accumulates nor backfills and preserves existing pending rows", async () => {
    vi.stubEnv("MIBESS_NOTIFY_ENABLED", "false");
    await applyEmbeddedPayment(provider());
    await transition("shipped", 0);
    expect(await rows()).toHaveLength(0);
    vi.stubEnv("MIBESS_NOTIFY_ENABLED", "true");
    await applyEmbeddedPayment(provider());
    await transition("shipped", 1, "CODE");
    expect(await rows()).toHaveLength(0);
    await transition("delivered", 2);
    const pending = await row();
    vi.stubEnv("MIBESS_NOTIFY_ENABLED", "false");
    expect(await runNotifyBatch()).toEqual({ status: "disabled", processed: 0 });
    expect(await row()).toEqual(pending);
    vi.stubEnv("MIBESS_NOTIFY_ENABLED", "true");
    fetchMock.mockResolvedValueOnce(accepted());
    await runNotifyBatch();
    expect((await row()).status).toBe("accepted");
  });
});

describe("durable Notify publisher", () => {
  it("recovers a timeout after acceptance with duplicate=true, preserving exact bytes and keys", async () => {
    const original = await approve();
    const eventId = crypto.randomUUID();
    fetchMock.mockRejectedValueOnce(new DOMException("sensitive provider content", "TimeoutError")).mockResolvedValueOnce(accepted(true, eventId));
    await runNotifyBatch();
    expect((await row()).status).toBe("pending");
    await due();
    await db.update(orders).set({ customerName: "Changed" });
    await runNotifyBatch();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).toBe(`${hml}/api/v1/events`);
      expect(options.body).toBe(original.payload);
      expect(options.headers).toMatchObject({ "Content-Type": "application/json", "Idempotency-Key": original.idempotencyKey, "X-API-Key": "isolated-notify-key" });
      expect(options.redirect).toBe("error");
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
    expect(await row()).toMatchObject({ status: "accepted", notifyEventId: eventId, attempts: 2, nextAttemptAt: null, lastError: null });
    expect(await requeueNotifyEvent(original.id)).toBe(false);
    await runNotifyBatch();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(/Mariana|isolated-notify-key|sensitive provider content/);
  });
  it.each([[400, "contract_error"], [401, "credentials_rejected"], [403, "permission_denied"], [409, "idempotency_conflict"]])("stops automatic retries for %s and allows explicit recovery without changing identity", async (status, error) => {
    const original = await approve();
    fetchMock.mockResolvedValueOnce(new Response("private detail", { status: Number(status) }));
    await runNotifyBatch();
    expect(await row()).toMatchObject({ status: "failed", lastError: error, attempts: 1, nextAttemptAt: null });
    await runNotifyBatch();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await requeueNotifyEvent(original.id)).toBe(true);
    fetchMock.mockResolvedValueOnce(accepted(true));
    await runNotifyBatch();
    expect(await row()).toMatchObject({ status: "accepted", attempts: 2, cycleAttempts: 1, payload: original.payload, idempotencyKey: original.idempotencyKey, occurredAt: original.occurredAt });
  });
  it.each([408, 429, 500, 502, 503, 504])("backs off transient HTTP %s, honoring Retry-After", async status => {
    await approve();
    const start = Date.now();
    fetchMock.mockResolvedValueOnce(new Response("private", { status, headers: { "Retry-After": "120" } }));
    await runNotifyBatch();
    const event = await row();
    expect(event.status).toBe("pending");
    expect(Date.parse(event.nextAttemptAt!)).toBeGreaterThanOrEqual(start + 120_000);
    expect(event.lastError).toBe(`http_${status}`);
    expect((await order()).status).toBe("paid");
    await runNotifyBatch();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("honors date Retry-After and applies bounded jitter when no header exists", async () => {
    await approve();
    const until = new Date(Date.now() + 300_000).toUTCString();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": until } }));
    await runNotifyBatch();
    expect(Date.parse((await row()).nextAttemptAt!)).toBeGreaterThanOrEqual(Date.parse(until));
    await due();
    const before = Date.now();
    fetchMock.mockRejectedValueOnce(new TypeError("secret"));
    await runNotifyBatch();
    expect(Date.parse((await row()).nextAttemptAt!) - before).toBeGreaterThanOrEqual(45_000);
    expect(Date.parse((await row()).nextAttemptAt!) - Date.now()).toBeLessThanOrEqual(75_000);
  });
  it.each(["not json", "{}", '{"eventId":"not-a-uuid","status":"ACCEPTED","duplicate":false}', JSON.stringify({ eventId: crypto.randomUUID(), status: "ACCEPTED" }), "x".repeat(9000)])("retries ambiguous 202 acceptance (%#)", async body => {
    const original = await approve();
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 202 }));
    await runNotifyBatch();
    expect(await row()).toMatchObject({ status: "pending", lastError: "invalid_acceptance_response", payload: original.payload, idempotencyKey: original.idempotencyKey });
  });
  it("limits retries and preserves total attempts across manual recovery", async () => {
    const original = await approve();
    fetchMock.mockImplementation(async () => new Response(null, { status: 503 }));
    for (let i = 0; i < NOTIFY_MAX_ATTEMPTS; i++) { await due(); await runNotifyBatch(); }
    expect(await row()).toMatchObject({ status: "failed", attempts: NOTIFY_MAX_ATTEMPTS });
    await runNotifyBatch();
    expect(fetchMock).toHaveBeenCalledTimes(NOTIFY_MAX_ATTEMPTS);
    await requeueNotifyEvent(original.id);
    expect(await row()).toMatchObject({ status: "pending", cycleAttempts: 0, attempts: NOTIFY_MAX_ATTEMPTS });
  });
  it("serializes concurrent workers without duplicate HTTP publications", async () => {
    await approve();
    fetchMock.mockImplementation(async () => accepted());
    const results = await Promise.all([runNotifyBatch(), runNotifyBatch(), runNotifyBatch()]);
    expect(results.reduce((n, r) => n + r.processed, 0)).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await row()).attempts).toBe(1);
  });
  it("recovers an abandoned lease; old workers cannot overwrite the new owner's result", async () => {
    const original = await approve();
    let started!: () => void;
    const barrier = new Promise<void>(resolve => { started = resolve; });
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => { started(); return new Promise<Response>(resolve => { finish = resolve; }); });
    const first = runNotifyBatch(1);
    await barrier;
    const lease = await row();
    expect(Date.parse(lease.leaseExpiresAt!) - Date.parse(lease.lastAttemptAt!)).toBe(NOTIFY_LEASE_MS);
    expect(await claimNotifyEvent()).toBeUndefined();
    await expire();
    const eventId = crypto.randomUUID();
    fetchMock.mockResolvedValueOnce(accepted(true, eventId));
    await runNotifyBatch(1);
    finish(new Response(null, { status: 400 }));
    await first;
    expect(await row()).toMatchObject({ status: "accepted", attempts: 2, notifyEventId: eventId, payload: original.payload, lastError: null });
  });
  it("makes an interrupted final attempt recoverable without an endless publishing state", async () => {
    await approve();
    await db.update(notifyOutbox).set({ cycleAttempts: NOTIFY_MAX_ATTEMPTS - 1, attempts: NOTIFY_MAX_ATTEMPTS - 1 });
    await claimNotifyEvent();
    await expire();
    await runNotifyBatch();
    expect(await row()).toMatchObject({ status: "failed", lastError: "attempts_exhausted_after_interruption" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not let missing credentials or Notify failures undo approval", async () => {
    vi.stubEnv("MIBESS_NOTIFY_API_KEY", "");
    await approve();
    expect(await runNotifyBatch()).toMatchObject({ status: "configuration_error" });
    expect((await order()).status).toBe("paid");
    expect((await row()).attempts).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("isolates HML/PRD snapshots and blocks a copied production URL in preview", async () => {
    await approve();
    vi.stubEnv("MIBESS_NOTIFY_BASE_URL", prd);
    expect(notifyPublisherConfig()).toBeNull();
    vi.stubEnv("APP_URL", "https://www.artgian.com.br");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(notifyPublisherConfig()).toBeNull();
    vi.stubEnv("VERCEL_ENV", "production");
    expect(notifyPublisherConfig()?.targetOrigin).toBe(prd);
    await runNotifyBatch();
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await row()).status).toBe("pending");
    await db.update(orders).set({ status: "paid" });
    await transition("shipped", 0);
    fetchMock.mockResolvedValueOnce(accepted());
    await runNotifyBatch();
    expect(fetchMock.mock.calls[0][0]).toBe(`${prd}/api/v1/events`);
    expect((await rows()).map(e => e.status)).toEqual(["pending", "accepted"]);
  });
  it.each([`${hml}/api/v1/events`, `${hml}/?x=1`, "http://notify-hml.mibess.com.br", "https://notify-hml.mibess.com.br.evil.example", "https://user:secret@notify-hml.mibess.com.br"]) ("rejects unsafe or non-origin configuration %s", url => {
    vi.stubEnv("MIBESS_NOTIFY_BASE_URL", url);
    expect(notifyPublisherConfig()).toBeNull();
  });
  it("authenticates QStash body and destination and awaits a full worker batch", async () => {
    await approve();
    const url = "https://store.example/api/tasks/notify";
    const unsigned = () => new Request(url, { method: "POST", body: "{}" });
    expect((await wake(unsigned())).status).toBe(401);
    expect((await wake(new Request(url, { method: "POST", headers: { "upstash-signature": "bad" }, body: "{}" }))).status).toBe(401);
    const body = "{}";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: "Upstash", sub: url, exp: Math.floor(Date.now() / 1000) + 300, nbf: Math.floor(Date.now() / 1000) - 1, body: createHash("sha256").update(body).digest("base64url") })).toString("base64url");
    const token = `${header}.${payload}.${createHmac("sha256", "isolated-current-signing-key").update(`${header}.${payload}`).digest("base64url")}`;
    expect((await wake(new Request(url, { method: "POST", headers: { "upstash-signature": token }, body: "changed" }))).status).toBe(401);
    expect((await wake(new Request(`${url}/other`, { method: "POST", headers: { "upstash-signature": token }, body }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(accepted());
    const response = await wake(new Request(url, { method: "POST", headers: { "upstash-signature": token }, body }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "completed", processed: 1 });
    expect((await row()).status).toBe("accepted");
  });
});
