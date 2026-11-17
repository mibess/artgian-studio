import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { coupons, orders } from "../db/schema";
import { retryTransaction } from "./checkout-orders";
import { mapPaymentStatus, type MercadoPagoPayment } from "./mercado-pago";
import { enqueueOrderPaid } from "./mibess-notify/outbox";

// The legacy checkout also needs one atomic approval, even without a coupon.
export async function applyRedirectPayment(payment: MercadoPagoPayment) {
  if (!payment.external_reference) return false;
  const db = await getDb();
  return retryTransaction(() => db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.external_reference!));
    const total = payment.transaction_details?.total_paid_amount ?? payment.transaction_amount + (payment.shipping_amount ?? 0);
    if (!order || order.checkoutMode !== "redirect" || payment.currency_id !== "BRL" || Math.round(total * 100) !== order.totalCents) return false;
    const settled = ["paid", "refunded", "charged_back"].includes(order.status);
    if (settled && (order.mercadoPagoPaymentId !== String(payment.id) || !["approved", "refunded", "charged_back"].includes(payment.status))) return false;
    if (["refunded", "charged_back"].includes(order.status) && payment.status === "approved") return false;
    const now = new Date().toISOString();
    await tx.update(orders).set({ status: mapPaymentStatus(payment.status), mercadoPagoPaymentId: String(payment.id), mercadoPagoStatus: payment.status, mercadoPagoStatusDetail: payment.status_detail ?? null, updatedAt: now }).where(eq(orders.id, order.id));
    if (payment.status === "approved") {
      const method = payment.payment_method_id === "pix" ? "PIX" : payment.payment_type_id === "ticket" ? "Boleto" : ["credit_card", "debit_card", "prepaid_card"].includes(payment.payment_type_id || "") ? "Cartão" : payment.payment_method_id || "Não informado";
      await enqueueOrderPaid(tx, order, now, method);
      if (order.couponId) {
        const [redeemed] = await tx.update(orders).set({ couponRedeemedAt: now }).where(and(eq(orders.id, order.id), isNull(orders.couponRedeemedAt))).returning({ couponId: orders.couponId });
        if (redeemed?.couponId) await tx.delete(coupons).where(and(eq(coupons.id, redeemed.couponId), eq(coupons.source, "game")));
      }
    }
    return true;
  }, { behavior: "immediate" }));
}
