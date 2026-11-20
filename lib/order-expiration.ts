import "server-only";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { coupons, orders, paymentAttempts } from "../db/schema";
import { retryTransaction } from "./checkout-orders";
import { canRetryPayment } from "./payment-types";

const DAY = 24 * 60 * 60 * 1000;
/** The legacy redirect checkout never set a payment deadline of its own. */
export const LEGACY_UNPAID_DAYS = 7;
/** An issued Pix or boleto follows Mercado Pago's own deadline; this is only a safety net for lost updates. */
export const ISSUED_PAYMENT_DAYS = 30;
/** Mercado Pago is still waiting for the buyer to pay an issued Pix or boleto. */
const waitingOnProvider = ["pending", "in_process", "authorized"];

type Candidate = {
  id: string;
  checkoutMode: string;
  paymentExpiresAt: string | null;
  createdAt: string;
  mercadoPagoStatus: string | null;
};

const parseDbDate = (value: string) =>
  Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value);

function expired(order: Candidate, attempt: { status: string; createdAt: string } | undefined, now: number) {
  if (order.checkoutMode === "embedded") {
    if (!order.paymentExpiresAt || Date.parse(order.paymentExpiresAt) > now) return false;
    if (!attempt || canRetryPayment(attempt.status)) return true;
    // An issued Pix/boleto can still be paid; uncertain or settled charges are never closed here.
    return waitingOnProvider.includes(attempt.status) && parseDbDate(attempt.createdAt) <= now - ISSUED_PAYMENT_DAYS * DAY;
  }
  const age = now - parseDbDate(order.createdAt);
  if (order.mercadoPagoStatus && waitingOnProvider.includes(order.mercadoPagoStatus)) return age >= ISSUED_PAYMENT_DAYS * DAY;
  return age >= LEGACY_UNPAID_DAYS * DAY;
}

/**
 * Cancels unpaid orders whose payment window is over and gives their coupon use back.
 * A payment approved later still marks the order as paid through the Mercado Pago webhook.
 */
export async function expireUnpaidOrders({ now = new Date(), userId }: { now?: Date; userId?: string } = {}) {
  const db = await getDb();
  const nowMs = now.getTime();
  const legacyCutoff = new Date(nowMs - LEGACY_UNPAID_DAYS * DAY).toISOString();
  const candidates: Candidate[] = await db.select({
    id: orders.id,
    checkoutMode: orders.checkoutMode,
    paymentExpiresAt: orders.paymentExpiresAt,
    createdAt: orders.createdAt,
    mercadoPagoStatus: orders.mercadoPagoStatus,
  }).from(orders).where(and(
    eq(orders.status, "pending"),
    userId ? eq(orders.userId, userId) : undefined,
    or(
      lte(orders.paymentExpiresAt, now.toISOString()),
      and(isNull(orders.paymentExpiresAt), sql`julianday(${orders.createdAt}) <= julianday(${legacyCutoff})`),
    ),
  ));
  if (!candidates.length) return 0;

  const embeddedIds = candidates.filter(order => order.checkoutMode === "embedded").map(order => order.id);
  const attempts = embeddedIds.length
    ? await db.select({ orderId: paymentAttempts.orderId, status: paymentAttempts.status, createdAt: paymentAttempts.createdAt })
      .from(paymentAttempts).where(inArray(paymentAttempts.orderId, embeddedIds))
      .orderBy(desc(paymentAttempts.createdAt), desc(paymentAttempts.id))
    : [];
  const latestAttempt = new Map<string, { status: string; createdAt: string }>();
  for (const attempt of attempts) if (!latestAttempt.has(attempt.orderId)) latestAttempt.set(attempt.orderId, attempt);

  let count = 0;
  for (const order of candidates) {
    if (!expired(order, latestAttempt.get(order.id), nowMs)) continue;
    const cancelled = await retryTransaction(() => db.transaction(async tx => {
      // Only a still-pending order is closed, so a payment approved meanwhile always wins.
      const [row] = await tx.update(orders).set({ status: "cancelled", updatedAt: now.toISOString() })
        .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
        .returning({ couponId: orders.couponId, couponRedeemedAt: orders.couponRedeemedAt });
      if (row?.couponId && !row.couponRedeemedAt) {
        await tx.update(coupons).set({ allocatedUses: sql`max(0, ${coupons.allocatedUses} - 1)` }).where(eq(coupons.id, row.couponId));
      }
      return Boolean(row);
    }, { behavior: "immediate" }));
    if (cancelled) count++;
  }
  return count;
}

/** Page loads call this so nobody sees an expired order as payable; a failure must not break the page. */
export async function expireUnpaidOrdersQuietly(options?: { userId?: string }) {
  try {
    return await expireUnpaidOrders(options);
  } catch (error) {
    console.error("Falha ao expirar pedidos não pagos.", error);
    return 0;
  }
}
