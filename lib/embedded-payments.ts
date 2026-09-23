import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { coupons, orderItems, orders, paymentAttempts } from "../db/schema";
import { isValidCpf } from "./brazil";
import { retryTransaction } from "./checkout-orders";
import { createPayment, getPayment, getPaymentMethods, mapPaymentStatus, MercadoPagoRequestError, searchOrderPayments, type MercadoPagoPayment } from "./mercado-pago";
import { canRetryPayment, type PaymentDetails, type PaymentMethod, type PaymentState } from "./payment-types";

type Database = Awaited<ReturnType<typeof getDb>>;
type Order = typeof orders.$inferSelect;
type Attempt = typeof paymentAttempts.$inferSelect;

export class PaymentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const paymentSubmissionSchema = z.object({
  requestId: z.uuid(),
  method: z.enum(["card", "pix", "boleto"]),
  deviceId: z.string().regex(/^[a-zA-Z0-9_-]{1,256}$/).optional(),
  card: z.object({
    token: z.string().regex(/^[a-zA-Z0-9_-]{8,256}$/),
    paymentMethodId: z.string().regex(/^[a-z0-9_]{1,60}$/),
    issuerId: z.string().regex(/^\d{1,20}$/).optional(),
    installments: z.number().int().min(1).max(24),
    identificationNumber: z.string().regex(/^\d{11}$/).refine(isValidCpf),
  }).strict().optional(),
}).strict().refine(value => value.method === "card" ? Boolean(value.card) : !value.card);
export type PaymentSubmission = z.infer<typeof paymentSubmissionSchema>;

export async function getOwnedPaymentOrder(orderId: string, userId: string) {
  const [order] = await (await getDb()).select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
  if (!order || order.checkoutMode !== "embedded") throw new PaymentError("Pedido não encontrado.", 404);
  return order;
}

async function latestAttempt(db: Database, orderId: string) {
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, orderId)).orderBy(desc(paymentAttempts.createdAt), desc(paymentAttempts.id)).limit(1);
  return attempt ?? null;
}

function httpsUrl(value?: string, boleto = false) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    if (boleto && !["mercadopago.com", "mercadopago.com.br", "mercadolibre.com"].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return undefined;
    return url.href;
  } catch { return undefined; }
}

function paymentDetails(payment: MercadoPagoPayment, method: PaymentMethod): PaymentDetails {
  const pix = payment.point_of_interaction?.transaction_data;
  const challengeUrl = httpsUrl(payment.three_ds_info?.external_resource_url);
  return {
    id: String(payment.id), status: payment.status, statusDetail: payment.status_detail ?? "", method,
    expiresAt: payment.date_of_expiration,
    ...(method === "pix" ? { pixCode: pix?.qr_code, pixImage: pix?.qr_code_base64 } : {}),
    ...(method === "boleto" ? { boletoCode: payment.barcode?.content, boletoUrl: httpsUrl(payment.transaction_details?.external_resource_url, true) } : {}),
    ...(payment.status_detail === "pending_challenge" && challengeUrl && payment.three_ds_info?.creq
      ? { challenge: { url: challengeUrl, creq: payment.three_ds_info.creq } } : {}),
  };
}

// Called for API responses, reconciliation and authenticated webhooks. No browser
// status or amount is trusted. Out-of-order events cannot undo a settled payment.
export async function applyEmbeddedPayment(payment: MercadoPagoPayment) {
  if (!payment.external_reference || !payment.metadata?.attempt_id) return false;
  const db = await getDb();
  return retryTransaction(() => db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.external_reference!));
    const [attempt] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, payment.metadata!.attempt_id!));
    if (!order || order.checkoutMode !== "embedded" || !attempt || attempt.orderId !== order.id ||
      payment.currency_id !== "BRL" || Math.round(payment.transaction_amount * 100) !== order.totalCents ||
      (attempt.providerPaymentId && attempt.providerPaymentId !== String(payment.id))) return false;
    if (attempt.providerUpdatedAt && payment.date_last_updated && Date.parse(payment.date_last_updated) < Date.parse(attempt.providerUpdatedAt)) return false;
    if (["approved", "refunded", "charged_back"].includes(attempt.status) && ["pending", "in_process", "authorized", "rejected", "cancelled"].includes(payment.status)) return false;
    if (["refunded", "charged_back"].includes(attempt.status) && payment.status === "approved") return false;
    const now = new Date().toISOString();
    await tx.update(paymentAttempts).set({
      providerPaymentId: String(payment.id), status: payment.status,
      result: JSON.stringify(paymentDetails(payment, attempt.method as PaymentMethod)),
      requestPayload: null, deviceId: null, providerUpdatedAt: payment.date_last_updated ?? null, updatedAt: now,
    }).where(eq(paymentAttempts.id, attempt.id));
    const [latest] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, order.id)).orderBy(desc(paymentAttempts.createdAt), desc(paymentAttempts.id)).limit(1);
    const settled = ["paid", "refunded", "charged_back"].includes(order.status);
    if ((settled && order.mercadoPagoPaymentId !== String(payment.id)) ||
      (latest.id !== attempt.id && payment.status !== "approved" && order.mercadoPagoPaymentId !== String(payment.id))) return true;
    const status = mapPaymentStatus(payment.status);
    await tx.update(orders).set({
      // A declined attempt can be retried against the same immutable order.
      status: ["rejected", "cancelled"].includes(status) ? "pending" : status,
      mercadoPagoPaymentId: String(payment.id), mercadoPagoStatus: payment.status,
      mercadoPagoStatusDetail: payment.status_detail ?? null, updatedAt: now,
    }).where(eq(orders.id, order.id));
    if (order.couponId && payment.status === "approved") {
      const redeemed = await tx.update(orders).set({ couponRedeemedAt: now }).where(and(eq(orders.id, order.id), isNull(orders.couponRedeemedAt))).returning({ couponId: orders.couponId });
      if (redeemed[0]?.couponId) await tx.delete(coupons).where(and(eq(coupons.id, redeemed[0].couponId), eq(coupons.source, "game")));
    }
    return true;
  }, { behavior: "immediate" }));
}

function snapshot(order: Order, attempt: Attempt | null): PaymentState {
  return {
    orderId: order.id, orderStatus: order.status, totalCents: order.totalCents, expiresAt: order.paymentExpiresAt,
    attemptId: attempt?.id ?? null, attemptStatus: attempt?.status ?? null,
    payment: attempt?.result ? JSON.parse(attempt.result) as PaymentDetails : null,
  };
}

export async function getPaymentState(orderId: string, userId: string, refresh = false) {
  const order = await getOwnedPaymentOrder(orderId, userId);
  const db = await getDb();
  const attempt = await latestAttempt(db, orderId);
  if (refresh && attempt && !canRetryPayment(attempt.status) && order.status === "pending" && Date.now() - Date.parse(attempt.updatedAt) >= 8_000) {
    // Atomically rate-limit provider lookups across tabs and app instances.
    const claimed = await db.update(paymentAttempts).set({ updatedAt: new Date().toISOString() })
      .where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.updatedAt, attempt.updatedAt))).returning({ id: paymentAttempts.id });
    if (claimed.length) {
      try {
        if (attempt.providerPaymentId) await applyEmbeddedPayment(await getPayment(attempt.providerPaymentId));
        else {
          const found = (await searchOrderPayments(orderId)).results.filter(payment => payment.metadata?.attempt_id === attempt.id);
          for (const payment of found) await applyEmbeddedPayment(payment);
        }
      } catch { /* The confirmed snapshot remains usable during provider outages. */ }
    }
    return snapshot(await getOwnedPaymentOrder(orderId, userId), await latestAttempt(db, orderId));
  }
  return snapshot(order, attempt);
}

async function buildPayment(order: Order, input: PaymentSubmission) {
  const appUrl = new URL(process.env.APP_URL || "");
  if (appUrl.protocol !== "https:") throw new PaymentError("Pagamento temporariamente indisponível.", 503);
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) throw new PaymentError("Pagamento temporariamente indisponível.", 503);
  if (input.method === "card") {
    const accepted = (await getPaymentMethods()).some(method => method.id === input.card!.paymentMethodId && method.status === "active" && ["credit_card", "debit_card", "prepaid_card"].includes(method.payment_type_id));
    if (!accepted) throw new PaymentError("Este cartão não está disponível. Escolha outro cartão, Pix ou boleto.");
  }
  const items = await (await getDb()).select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const [firstName, ...lastName] = order.customerName.split(/\s+/);
  const payer = {
    email: order.customerEmail, first_name: firstName, last_name: lastName.join(" "),
    identification: { type: "CPF", number: input.card?.identificationNumber ?? order.customerDocument },
    address: { zip_code: order.postalCode, street_name: order.streetAddress, street_number: order.addressNumber, neighborhood: order.neighborhood, city: order.city, federal_unit: order.state },
  };
  return {
    transaction_amount: order.totalCents / 100,
    description: `Artgian Studio · Pedido ${order.id.slice(0, 8)}`,
    external_reference: order.id,
    metadata: { order_id: order.id, attempt_id: input.requestId },
    notification_url: `${appUrl.origin}/api/mercado-pago/webhook`,
    payer,
    additional_info: {
      items: items.map(item => ({ id: item.productId, title: item.productName, quantity: item.quantity, unit_price: item.unitPriceCents / 100 })),
      payer: { first_name: firstName, last_name: lastName.join(" "), phone: { area_code: order.customerPhone.slice(0, 2), number: order.customerPhone.slice(2) } },
    },
    ...(input.method === "card" ? {
      token: input.card!.token, installments: input.card!.installments,
      payment_method_id: input.card!.paymentMethodId, issuer_id: input.card!.issuerId,
      statement_descriptor: "ARTGIAN STUDIO", three_d_secure_mode: "optional", capture: true, binary_mode: false,
    } : {
      payment_method_id: input.method === "pix" ? "pix" : "bolbradesco",
      // Keep the provider's standard expiry; the returned deadline is displayed.
    }),
  };
}

export async function submitPayment(orderId: string, userId: string, input: PaymentSubmission) {
  const order = await getOwnedPaymentOrder(orderId, userId);
  const db = await getDb();
  const previous = await latestAttempt(db, orderId);
  if (order.status !== "pending") return getPaymentState(orderId, userId);
  if (previous && !canRetryPayment(previous.status)) return getPaymentState(orderId, userId, true);
  if (!order.paymentExpiresAt || Date.parse(order.paymentExpiresAt) <= Date.now()) throw new PaymentError("O prazo para iniciar este pagamento terminou. Volte ao checkout para revisar seu pedido.", 410);
  const body = await buildPayment(order, input);
  const created = await retryTransaction(() => db.transaction(async tx => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (current.status !== "pending") return false;
    const [existing] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, orderId)).orderBy(desc(paymentAttempts.createdAt), desc(paymentAttempts.id)).limit(1);
    if (existing && (!canRetryPayment(existing.status) || existing.id === input.requestId)) return false;
    if (existing && Date.now() - Date.parse(existing.createdAt) < 3_000) throw new PaymentError("Aguarde alguns segundos antes de tentar novamente.", 429);
    const [sameKey] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, input.requestId));
    if (sameKey) throw new PaymentError("Tentativa inválida. Atualize a página e tente novamente.", 409);
    if (current.paymentExpiresAt && current.paymentExpiresAt <= new Date().toISOString()) throw new PaymentError("O prazo para iniciar este pagamento terminou.", 410);
    const now = new Date().toISOString();
    await tx.insert(paymentAttempts).values({ id: input.requestId, orderId, method: input.method, requestPayload: JSON.stringify(body), deviceId: input.deviceId, createdAt: now, updatedAt: now });
    return true;
  }, { behavior: "immediate" }));
  if (created) await sendAttempt(input.requestId);
  return getPaymentState(orderId, userId);
}

async function sendAttempt(attemptId: string) {
  const db = await getDb();
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId));
  if (!attempt?.requestPayload || !["processing", "unknown"].includes(attempt.status)) return;
  // Do not replay after the provider's idempotency retention window.
  if (Date.now() - Date.parse(attempt.createdAt) > 23 * 60 * 60_000) return;
  try {
    const payment = await createPayment(JSON.parse(attempt.requestPayload), attempt.id, attempt.deviceId);
    if (!await applyEmbeddedPayment(payment)) throw new Error("Payment response did not match the order");
  } catch (error) {
    const definitive = error instanceof MercadoPagoRequestError && error.definitelyNotCreated;
    console.error("[payment] provider request failed", {
      orderId: attempt.orderId, attemptId, method: attempt.method,
      ...(error instanceof MercadoPagoRequestError ? { status: error.status, code: error.code, causes: error.causeCodes } : { code: "unconfirmed_response" }),
    });
    // A webhook may have confirmed the payment while this request was timing out.
    await db.update(paymentAttempts).set({ status: definitive ? "failed" : "unknown", ...(definitive ? { requestPayload: null, deviceId: null } : {}), updatedAt: new Date().toISOString() })
      .where(and(eq(paymentAttempts.id, attemptId), isNull(paymentAttempts.providerPaymentId)));
  }
}

export async function retryUncertainPayment(orderId: string, userId: string, attemptId: string) {
  const order = await getOwnedPaymentOrder(orderId, userId);
  const attempt = await latestAttempt(await getDb(), orderId);
  if (order.status === "pending" && attempt?.id === attemptId && ["unknown", "processing"].includes(attempt.status) && Date.now() - Date.parse(attempt.updatedAt) >= 5_000) {
    // Replay exactly the same payload and provider key; never mint a second charge.
    const claimed = await (await getDb()).update(paymentAttempts).set({ updatedAt: new Date().toISOString() })
      .where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.updatedAt, attempt.updatedAt))).returning({ id: paymentAttempts.id });
    if (claimed.length) await sendAttempt(attempt.id);
  }
  return getPaymentState(orderId, userId, true);
}
