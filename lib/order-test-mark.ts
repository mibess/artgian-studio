import "server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { orders } from "../db/schema";

export const TEST_ORDER_BLOCKED = "Pedido marcado como teste: desmarque-o antes de comprar etiqueta ou atualizar a entrega.";

/**
 * Flags or unflags an order as a store test. Nothing is deleted: the order only leaves
 * the work queues. Bumping updatedAt lets the CRM integration pick up the change.
 * Callers must authenticate the seller before calling. Returns false when nothing changed.
 */
export async function setOrderTestMark(orderId: string, marked: boolean) {
  const db = await getDb();
  const now = new Date().toISOString();
  const changed = await db.update(orders)
    .set({ testMarkedAt: marked ? now : null, updatedAt: now })
    .where(and(eq(orders.id, orderId), marked ? isNull(orders.testMarkedAt) : isNotNull(orders.testMarkedAt)))
    .returning({ id: orders.id });
  return changed.length > 0;
}
