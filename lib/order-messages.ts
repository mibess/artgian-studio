import "server-only";
import { and, count, countDistinct, desc, eq, inArray, isNull, lt, lte, max, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { orderItemMessages, orderItems, orders } from "../db/schema";
import { ORDER_MESSAGE_MAX_LENGTH, type OrderMessage, type OrderMessageInboxThread, type OrderMessageSender, type OrderMessageThread } from "./order-message-types";

export type OrderMessageViewer = { role: "customer"; userId: string } | { role: "seller" };

export class OrderMessageError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export const sendOrderMessageSchema = z.object({
  body: z.string().trim().min(1).max(ORDER_MESSAGE_MAX_LENGTH),
  clientId: z.uuid(),
}).strict();
export const readOrderMessagesSchema = z.object({
  action: z.literal("read"),
  throughId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();

const messageFields = {
  id: orderItemMessages.id,
  sender: orderItemMessages.sender,
  body: orderItemMessages.body,
  createdAt: orderItemMessages.createdAt,
  readAt: orderItemMessages.readAt,
};

async function getThreadContext(orderId: string, itemId: number, viewer: OrderMessageViewer) {
  if (!orderId || !Number.isSafeInteger(itemId) || itemId < 1)
    throw new OrderMessageError("Conversa não encontrada.", 404);
  const [thread] = await (await getDb()).select({
    order: { id: orders.id, customerName: orders.customerName },
    item: { id: orderItems.id, productName: orderItems.productName, color: orderItems.color, personalization: orderItems.personalization, quantity: orderItems.quantity },
  }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(
    eq(orders.id, orderId), eq(orderItems.id, itemId),
    viewer.role === "customer" ? eq(orders.userId, viewer.userId) : undefined,
  )).limit(1);
  if (!thread) throw new OrderMessageError("Conversa não encontrada.", 404);
  return thread;
}

export async function getOrderMessageThread(orderId: string, itemId: number, viewer: OrderMessageViewer, before?: number): Promise<OrderMessageThread> {
  const thread = await getThreadContext(orderId, itemId, viewer);
  if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
    throw new OrderMessageError("Página de mensagens inválida.", 400);
  const rows = await (await getDb()).select(messageFields).from(orderItemMessages).where(and(
    eq(orderItemMessages.orderItemId, itemId), before !== undefined ? lt(orderItemMessages.id, before) : undefined,
  )).orderBy(desc(orderItemMessages.id)).limit(51);
  return { ...thread, messages: rows.slice(0, 50).reverse(), hasMore: rows.length > 50 };
}

export async function sendOrderMessage(orderId: string, itemId: number, viewer: OrderMessageViewer, input: unknown): Promise<OrderMessage> {
  const parsed = sendOrderMessageSchema.parse(input);
  await getThreadContext(orderId, itemId, viewer);
  const db = await getDb();
  await db.insert(orderItemMessages).values({
    orderItemId: itemId, sender: viewer.role, ...parsed, createdAt: new Date().toISOString(),
  }).onConflictDoNothing({ target: [orderItemMessages.orderItemId, orderItemMessages.sender, orderItemMessages.clientId] });
  const [message] = await db.select(messageFields).from(orderItemMessages).where(and(
    eq(orderItemMessages.orderItemId, itemId), eq(orderItemMessages.sender, viewer.role), eq(orderItemMessages.clientId, parsed.clientId),
  )).limit(1);
  if (!message) throw new OrderMessageError("Não foi possível enviar a mensagem. Tente novamente.", 500);
  if (message.body !== parsed.body) throw new OrderMessageError("Esta tentativa já foi usada para outra mensagem. Atualize a conversa e tente novamente.", 409);
  return message;
}

export async function markOrderMessagesRead(orderId: string, itemId: number, viewer: OrderMessageViewer, throughId: number) {
  readOrderMessagesSchema.parse({ action: "read", throughId });
  await getThreadContext(orderId, itemId, viewer);
  await (await getDb()).update(orderItemMessages).set({ readAt: new Date().toISOString() }).where(and(
    eq(orderItemMessages.orderItemId, itemId),
    eq(orderItemMessages.sender, viewer.role === "customer" ? "seller" : "customer"),
    lte(orderItemMessages.id, throughId), isNull(orderItemMessages.readAt),
  ));
}

/** Call only with orders already authorized for the current viewer. */
export async function getOrderMessageUnreadCounts(orderIds: string[], viewer: OrderMessageSender): Promise<Record<number, number>> {
  if (!orderIds.length) return {};
  const rows = await (await getDb()).select({ itemId: orderItems.id, unreadCount: count() }).from(orderItemMessages)
    .innerJoin(orderItems, eq(orderItems.id, orderItemMessages.orderItemId)).where(and(
      inArray(orderItems.orderId, orderIds), isNull(orderItemMessages.readAt),
      eq(orderItemMessages.sender, viewer === "customer" ? "seller" : "customer"),
    )).groupBy(orderItems.id);
  return Object.fromEntries(rows.map(row => [row.itemId, row.unreadCount]));
}

/** Administrative inbox; callers must authenticate the seller before calling. */
export async function listOrderMessageInbox(requestedPage = 1): Promise<{ threads: OrderMessageInboxThread[]; total: number; page: number; pageCount: number }> {
  const db = await getDb();
  const [{ total }] = await db.select({ total: countDistinct(orderItemMessages.orderItemId) }).from(orderItemMessages);
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, pageCount)) : 1;
  const latest = db.select({ itemId: orderItemMessages.orderItemId, messageId: max(orderItemMessages.id).as("message_id") })
    .from(orderItemMessages).groupBy(orderItemMessages.orderItemId).as("latest");
  const threads = await db.select({
    orderId: orders.id, itemId: orderItems.id, productName: orderItems.productName, color: orderItems.color,
    customerName: orders.customerName, lastBody: orderItemMessages.body, lastSender: orderItemMessages.sender,
    updatedAt: orderItemMessages.createdAt,
    unreadCount: sql<number>`(select count(*) from order_item_messages unread where unread.order_item_id = ${orderItems.id} and unread.sender = 'customer' and unread.read_at is null)`.mapWith(Number),
  }).from(latest).innerJoin(orderItemMessages, eq(orderItemMessages.id, latest.messageId))
    .innerJoin(orderItems, eq(orderItems.id, latest.itemId)).innerJoin(orders, eq(orders.id, orderItems.orderId))
    .orderBy(desc(orderItemMessages.id)).limit(20).offset((page - 1) * 20);
  return { threads, total, page, pageCount };
}
