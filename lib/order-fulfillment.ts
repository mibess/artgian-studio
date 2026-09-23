import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { orderFulfillmentEvents, orderItems, orders } from "../db/schema";
import { retryTransaction } from "./checkout-orders";

export class FulfillmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const fulfillmentUpdateSchema = z.object({
  status: z.enum(["preparing", "ready_to_ship", "shipped", "out_for_delivery", "delivered"], { error: "Selecione uma etapa válida para a entrega." }),
  revision: z.coerce.number().int().nonnegative(),
  note: z.string().trim().max(500, "Use até 500 caracteres na observação."),
  trackingCode: z.string().trim().max(80, "Use até 80 caracteres no código de rastreio.").regex(/^[a-zA-Z0-9 ._-]*$/, "Informe apenas o código de rastreio, sem links ou caracteres especiais."),
}).strict();

export async function getCustomerFulfillment(orderId: string, userId: string) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
  if (!order) throw new FulfillmentError("Pedido não encontrado.", 404);
  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(orderFulfillmentEvents).where(eq(orderFulfillmentEvents.orderId, order.id)).orderBy(desc(orderFulfillmentEvents.createdAt), desc(orderFulfillmentEvents.id)),
  ]);
  return { order, items, events };
}

export async function updateOrderFulfillment(orderId: string, input: z.infer<typeof fulfillmentUpdateSchema>) {
  const db = await getDb();
  return retryTransaction(() => db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new FulfillmentError("Pedido não encontrado.", 404);
    if (order.status !== "paid") throw new FulfillmentError("O acompanhamento só pode ser atualizado para pedidos com pagamento aprovado.", 409);
    const note = input.note || null;
    const trackingCode = input.trackingCode || null;
    // Repeating the same submission never creates duplicate history entries.
    if (order.fulfillmentStatus === input.status && order.fulfillmentNote === note && order.shippingTrackingCode === trackingCode) return false;
    if (order.fulfillmentRevision !== input.revision) throw new FulfillmentError("Este pedido foi atualizado em outra aba. Recarregue e confira a etapa atual antes de salvar.", 409);
    const now = new Date().toISOString();
    await tx.update(orders).set({
      fulfillmentStatus: input.status, fulfillmentNote: note, shippingTrackingCode: trackingCode,
      fulfillmentUpdatedAt: now, fulfillmentRevision: order.fulfillmentRevision + 1,
    }).where(eq(orders.id, order.id));
    await tx.insert(orderFulfillmentEvents).values({ id: crypto.randomUUID(), orderId, status: input.status, note, trackingCode, source: "manual", createdAt: now });
    return true;
  }, { behavior: "immediate" }));
}
