import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { orders } from "../db/schema";
import { getSuperFreteLabelStatus } from "./super-frete";

export async function syncSuperFreteLabelCancellation(labelId: string, orderId?: string) {
  const db = await getDb();
  const linkedLabel = and(
    eq(orders.shippingProvider, "super_frete"),
    eq(orders.shippingLabelId, labelId),
    orderId ? eq(orders.id, orderId) : undefined,
  );
  const [order] = await db.select({ id: orders.id }).from(orders).where(linkedLabel).limit(1);
  if (!order) return "unlinked";
  if (await getSuperFreteLabelStatus(labelId) !== "canceled") return "active";

  const now = new Date().toISOString();
  const updated = await db.update(orders).set({
    shippingLabelId: null,
    shippingLabelStatus: "canceled",
    shippingLabelUrl: null,
    shippingTrackingCode: null,
    shippingLabelError: null,
    shippingLabelUpdatedAt: now,
    updatedAt: now,
  }).where(and(linkedLabel, eq(orders.id, order.id))).returning({ id: orders.id });
  return updated.length ? "canceled" : "unlinked";
}
