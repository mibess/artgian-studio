import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { coupons, orderItems, orders, paymentAttempts } from "../db/schema";
import { canRetryPayment } from "./payment-types";
import { calculateDiscount, CouponError, couponCodeSchema, reserveCoupon } from "./coupons";

type Database = Awaited<ReturnType<typeof getDb>>;
type Order = typeof orders.$inferInsert;
type Item = typeof orderItems.$inferInsert;

// Compare the purchase itself, not its generated IDs, dates or address-book label.
const purchaseFields = [
  "userId", "customerName", "customerEmail", "customerPhone", "customerDocument",
  "postalCode", "streetAddress", "addressNumber", "addressComplement", "neighborhood", "city", "state",
  "subtotalCents", "shippingCents", "shippingProvider", "shippingServiceId", "shippingCompanyId",
  "shippingDeliveryTimeDays",
] as const;
const purchaseKey = (order: Order) => JSON.stringify(purchaseFields.map(field => order[field] ?? null));
const itemsKey = (items: Item[]) => JSON.stringify(items.map(item => JSON.stringify([
  item.productId, item.productName, item.color, item.personalization || null,
  item.quantity, item.unitPriceCents, item.shippingPackageSnapshot ?? null,
])).sort());

export type CheckoutOrderResult =
  | { kind: "reused"; orderId: string; checkoutUrl: string }
  | { kind: "processing"; orderId: string }
  | { kind: "created"; orderId: string; discountCents: number; couponCode?: string; expiresAt: string | null };

export async function retryTransaction<T>(write: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await write(); }
    catch (error) {
      let cause: unknown = error;
      let busy = false;
      while (cause && typeof cause === "object") {
        if ("code" in cause && String(cause.code).startsWith("SQLITE_BUSY")) busy = true;
        cause = "cause" in cause ? cause.cause : undefined;
      }
      if (!busy || attempt >= 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 30 * 2 ** attempt));
    }
  }
}

export async function saveCheckoutPreference(db: Database, orderId: string, preferenceId: string, checkoutUrl: string) {
  await retryTransaction(() => db.transaction(async tx => {
    await tx.update(orders).set({
      mercadoPagoPreferenceId: preferenceId, checkoutUrl, updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId));
  }, { behavior: "immediate" }));
}

export async function createOrReuseCheckoutOrder(
  db: Database,
  draft: Order,
  items: Item[],
  rawCouponCode?: unknown,
): Promise<CheckoutOrderResult> {
  if (!draft.userId) throw new Error("O pedido precisa de um cliente autenticado.");
  let couponCode: string | null = null;
  if (rawCouponCode !== undefined && rawCouponCode !== "") {
    const parsed = couponCodeSchema.safeParse(rawCouponCode);
    if (!parsed.success) throw new CouponError("Código de cupom inválido.");
    couponCode = parsed.data;
  }

  // libSQL opens a write transaction (BEGIN IMMEDIATE). The lookup and insert
  // must share it: two instances cannot both decide to create the same order.
  // No payment/shipping network requests run while holding this transaction.
  return retryTransaction(() => db.transaction(async tx => {
    const candidates = await tx.select().from(orders).where(and(
      eq(orders.userId, draft.userId!),
      eq(orders.status, "pending"),
      eq(orders.subtotalCents, draft.subtotalCents),
      eq(orders.shippingCents, draft.shippingCents),
      eq(orders.checkoutMode, draft.checkoutMode ?? "redirect"),
    )).orderBy(desc(orders.createdAt));
    const expectedPurchase = purchaseKey(draft);
    const expectedItems = itemsKey(items);
    for (const candidate of candidates) {
      if ((candidate.couponCode || null) !== couponCode || purchaseKey(candidate) !== expectedPurchase) continue;
      if (candidate.totalCents !== candidate.subtotalCents + candidate.shippingCents - candidate.discountCents) continue;
      const existingItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, candidate.id));
      if (itemsKey(existingItems) !== expectedItems) continue;
      if (candidate.checkoutMode === "embedded") {
        const [attempt] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, candidate.id)).orderBy(desc(paymentAttempts.createdAt), desc(paymentAttempts.id)).limit(1);
        // An issued Pix/boleto or an uncertain charge survives the session/coupon
        // deadline. Always resume it instead of creating a second payable order.
        if (attempt && !canRetryPayment(attempt.status)) return { kind: "reused", orderId: candidate.id, checkoutUrl: `/comprar/pagamento?pedido=${candidate.id}` };
        if (candidate.paymentExpiresAt && candidate.paymentExpiresAt <= new Date().toISOString()) {
          await tx.update(orders).set({ status: "cancelled", updatedAt: new Date().toISOString() }).where(eq(orders.id, candidate.id));
          if (candidate.couponId && !candidate.couponRedeemedAt) await tx.update(coupons).set({ allocatedUses: sql`max(0, ${coupons.allocatedUses} - 1)` }).where(eq(coupons.id, candidate.couponId));
          continue;
        }
      }
      if (couponCode) {
        if (!candidate.couponId) continue;
        const [coupon] = await tx.select().from(coupons).where(eq(coupons.id, candidate.couponId));
        const now = new Date().toISOString();
        if (!coupon || !coupon.active || coupon.code !== couponCode ||
          (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt <= now) ||
          coupon.kind !== candidate.couponKind || coupon.value !== candidate.couponValue) continue;
        // This order already owns a reservation; maxUses must not reserve it again.
        try {
          if (calculateDiscount(coupon, draft.subtotalCents) !== candidate.discountCents) continue;
        } catch (error) {
          if (error instanceof CouponError) continue;
          throw error;
        }
      } else if (candidate.discountCents !== 0) continue;
      if (candidate.checkoutMode === "embedded") {
        return { kind: "reused", orderId: candidate.id, checkoutUrl: `/comprar/pagamento?pedido=${candidate.id}` };
      }
      if (candidate.checkoutUrl && candidate.mercadoPagoPreferenceId) {
        return { kind: "reused", orderId: candidate.id, checkoutUrl: candidate.checkoutUrl };
      }
      return { kind: "processing", orderId: candidate.id };
    }

    const reservation = couponCode ? await reserveCoupon(tx, couponCode, draft.subtotalCents) : null;
    const discountCents = reservation?.discountCents ?? 0;
    if (draft.shippingCents === 0 && discountCents === draft.subtotalCents)
      throw new CouponError("Este cupom cobre o pedido inteiro; não é possível criar um pagamento de R$ 0,00.");
    await tx.insert(orders).values({
      ...draft,
      status: "pending",
      discountCents,
      totalCents: draft.subtotalCents + draft.shippingCents - discountCents,
      ...(draft.checkoutMode === "embedded" ? {
        paymentExpiresAt: new Date(Math.min(Date.now() + 24 * 60 * 60 * 1000,
          reservation?.coupon.expiresAt ? Date.parse(reservation.coupon.expiresAt) : Infinity)).toISOString(),
      } : {}),
      ...(reservation ? {
        couponId: reservation.coupon.id,
        couponCode: reservation.coupon.code,
        couponKind: reservation.coupon.kind,
        couponValue: reservation.coupon.value,
      } : {}),
    });
    await tx.insert(orderItems).values(items);
    return {
      kind: "created", orderId: draft.id, discountCents,
      couponCode: reservation?.coupon.code, expiresAt: reservation?.coupon.expiresAt ?? null,
    };
  }, { behavior: "immediate" }));
}
