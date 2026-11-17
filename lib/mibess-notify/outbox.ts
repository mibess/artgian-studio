import "server-only";
import { notifyOutbox, orders } from "../../db/schema";
import type { getDb } from "../../db";
import { notifyEnabled, notifyTargetOrigin } from "./config";

type Database = Awaited<ReturnType<typeof getDb>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Order = typeof orders.$inferSelect;
type Event = {
  type: "ORDER_PAID" | "TRACKING_POSTED" | "TRACKING_STATUS_CHANGED";
  occurredAt: string;
  correlationId: string;
  data: Record<string, string | number>;
};

async function enqueue(tx: Transaction, key: string, event: Event) {
  if (!notifyEnabled()) return;
  const payload = JSON.stringify(event);
  // All fields come from bounded order inputs; keep a hard contract guard as well.
  if (Buffer.byteLength(payload, "utf8") >= 64 * 1024) throw new Error("Notify event exceeds contract size");
  await tx.insert(notifyOutbox).values({
    id: crypto.randomUUID(), idempotencyKey: key, type: event.type,
    correlationId: event.correlationId, targetOrigin: notifyTargetOrigin(), payload,
    occurredAt: event.occurredAt, createdAt: event.occurredAt, updatedAt: event.occurredAt,
    nextAttemptAt: event.occurredAt,
  }).onConflictDoNothing({ target: notifyOutbox.idempotencyKey });
}

function orderData(order: Order) {
  return { orderId: order.id, orderNumber: order.id.slice(0, 8), customerName: order.customerName };
}

// Called only after provider validation, inside the transaction that marks paid.
export async function enqueueOrderPaid(tx: Transaction, order: Order, occurredAt: string, paymentMethod: string) {
  if (["paid", "refunded", "charged_back"].includes(order.status)) return;
  const reais = Math.floor(order.totalCents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  await enqueue(tx, `artgian:order:${order.id}:paid:v1`, {
    type: "ORDER_PAID", occurredAt, correlationId: `artgian-order-${order.id}`,
    data: { ...orderData(order), amount: order.totalCents / 100, amountFormatted: `R$ ${reais},${String(order.totalCents % 100).padStart(2, "0")}`, currency: "BRL", paymentMethod },
  });
}

export async function enqueueFulfillment(tx: Transaction, order: Order, event: { id: string; status: string; trackingCode: string | null; createdAt: string }) {
  if (event.status === order.fulfillmentStatus) return;
  const statuses: Record<string, { status: string; statusLabel: string }> = {
    shipped: { status: "POSTED", statusLabel: "Enviado" },
    out_for_delivery: { status: "OUT_FOR_DELIVERY", statusLabel: "Saiu para entrega" },
    delivered: { status: "DELIVERED", statusLabel: "Entregue" },
  };
  const status = statuses[event.status];
  if (!status) return;
  await enqueue(tx, `artgian:order:${order.id}:fulfillment:${event.id}:v1`, {
    type: event.status === "shipped" ? "TRACKING_POSTED" : "TRACKING_STATUS_CHANGED",
    occurredAt: event.createdAt, correlationId: `artgian-order-${order.id}`,
    data: { ...orderData(order), ...status, ...(event.trackingCode ? { trackingCode: event.trackingCode } : {}) },
  });
}
