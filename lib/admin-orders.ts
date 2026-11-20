import "server-only";
import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { orderFulfillmentEvents, orderItems, orders } from "../db/schema";
import { digitsOnly, formatPhone, hasFullName, maskCpf } from "./brazil";
import { fulfillmentStep } from "./fulfillment-status";
import { ISSUED_PAYMENT_DAYS, LEGACY_UNPAID_DAYS } from "./order-expiration";
import { getOrderMessageUnreadCounts } from "./order-messages";
import { getShippingProviderEnvironment, resolveShippingProvider, shippingProviderName } from "./shipping";
import type { AdminOrder, OrderQueue, OrderQueueCounts } from "./admin-order-view";

export const ADMIN_ORDERS_PAGE_SIZE = 25;
const TIME_ZONE = "America/Sao_Paulo";
const closedPayments = ["rejected", "cancelled", "refunded", "charged_back"];

type OrderRow = typeof orders.$inferSelect;

function queueCondition(queue: OrderQueue): SQL | undefined {
  switch (queue) {
    case "a-enviar": return and(eq(orders.status, "paid"), inArray(orders.fulfillmentStatus, ["preparing", "ready_to_ship"]));
    case "em-transito": return and(eq(orders.status, "paid"), inArray(orders.fulfillmentStatus, ["shipped", "out_for_delivery"]));
    case "entregues": return and(eq(orders.status, "paid"), eq(orders.fulfillmentStatus, "delivered"));
    case "aguardando-pagamento": return eq(orders.status, "pending");
    case "cancelados": return inArray(orders.status, closedPayments);
    case "todos": return undefined;
  }
}

/** Matches name, e-mail, order number, tracking code and, for digits, CPF, phone or CEP. */
function searchCondition(raw: string): SQL | undefined {
  const query = raw.trim().replace(/^#/, "").slice(0, 80);
  if (!query) return undefined;
  const escaped = query.replace(/[\\%_]/g, match => `\\${match}`);
  const contains = `%${escaped}%`;
  const conditions = [
    sql`${orders.customerName} like ${contains} escape '\\'`,
    sql`${orders.customerEmail} like ${contains} escape '\\'`,
    sql`${orders.id} like ${`${escaped.toLowerCase()}%`} escape '\\'`,
    sql`${orders.shippingTrackingCode} like ${contains} escape '\\'`,
  ];
  const digits = digitsOnly(query);
  if (digits.length >= 3) {
    conditions.push(
      sql`${orders.customerDocument} like ${`%${digits}%`}`,
      sql`${orders.customerPhone} like ${`%${digits}%`}`,
      sql`${orders.postalCode} like ${`%${digits}%`}`,
    );
  }
  return or(...conditions);
}

async function countQueues(search: SQL | undefined): Promise<OrderQueueCounts> {
  const db = await getDb();
  const sum = (condition: SQL) => sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`.mapWith(Number);
  const [row] = await db.select({
    "a-enviar": sum(queueCondition("a-enviar")!),
    "em-transito": sum(queueCondition("em-transito")!),
    entregues: sum(queueCondition("entregues")!),
    "aguardando-pagamento": sum(queueCondition("aguardando-pagamento")!),
    cancelados: sum(queueCondition("cancelados")!),
    todos: count(),
  }).from(orders).where(search);
  return row;
}

export async function listAdminOrders({ queue, query, page }: { queue: OrderQueue; query: string; page: number }) {
  const db = await getDb();
  const search = searchCondition(query);
  const [counts, totals] = await Promise.all([countQueues(search), search ? countQueues(undefined) : null]);
  const total = counts[queue];
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  // The shipping queue is a to-do list: whoever paid first is served first.
  const order = queue === "a-enviar" ? [asc(orders.createdAt), asc(orders.id)] : [desc(orders.createdAt), desc(orders.id)];
  const rows = await db.select().from(orders)
    .where(and(queueCondition(queue), search))
    .orderBy(...order)
    .limit(ADMIN_ORDERS_PAGE_SIZE)
    .offset((currentPage - 1) * ADMIN_ORDERS_PAGE_SIZE);
  return {
    orders: await toAdminOrders(rows),
    counts,
    totals: totals ?? counts,
    page: currentPage,
    pageCount,
    total,
  };
}

export async function getAdminOrder(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const db = await getDb();
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return (await toAdminOrders(rows))[0] ?? null;
}

function parseDbDate(value: string) {
  return new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value);
}

function absoluteDate(value: string) {
  const date = parseDbDate(value);
  const day = date.toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
  const time = date.toLocaleTimeString("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

function relativeDate(value: string, now: number) {
  const date = parseDbDate(value);
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "há 1 dia" : `há ${days} dias`;
  return date.toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });
}

/** Explains when an unpaid order closes, following the rules in order-expiration.ts. */
function paymentDeadlineLabel(order: OrderRow, now: number) {
  if (order.status === "cancelled" && order.paymentExpiresAt && parseDbDate(order.paymentExpiresAt).getTime() <= now) {
    return `Cancelado automaticamente: o prazo para pagar terminou em ${absoluteDate(order.paymentExpiresAt)}.`;
  }
  if (order.status !== "pending") return null;
  if (order.paymentExpiresAt) {
    return parseDbDate(order.paymentExpiresAt).getTime() > now
      ? `Prazo para pagar até ${absoluteDate(order.paymentExpiresAt)}. Depois disso, o pedido é cancelado automaticamente.`
      : `O prazo terminou em ${absoluteDate(order.paymentExpiresAt)}, mas há um Pix ou boleto emitido que ainda pode ser pago.`;
  }
  const waiting = ["pending", "in_process", "authorized"].includes(order.mercadoPagoStatus ?? "");
  const closesAt = new Date(parseDbDate(order.createdAt).getTime() + (waiting ? ISSUED_PAYMENT_DAYS : LEGACY_UNPAID_DAYS) * 86_400_000);
  return `Se não for pago, será cancelado automaticamente em ${absoluteDate(closesAt.toISOString())}.`;
}

function formatPostalCode(value: string) {
  const digits = digitsOnly(value, 8);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
}

async function toAdminOrders(rows: OrderRow[]): Promise<AdminOrder[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const ids = rows.map(row => row.id);
  const [items, events, unread] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, ids)).orderBy(asc(orderItems.id)),
    db.select().from(orderFulfillmentEvents).where(inArray(orderFulfillmentEvents.orderId, ids))
      .orderBy(desc(orderFulfillmentEvents.createdAt), desc(orderFulfillmentEvents.id)),
    getOrderMessageUnreadCounts(ids, "seller"),
  ]);
  const now = Date.now();

  return rows.map(order => {
    const orderItemsForOrder = items.filter(item => item.orderId === order.id).map(item => ({
      id: item.id,
      name: item.productName,
      color: item.color,
      personalization: item.personalization?.trim() || null,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      unread: unread[item.id] ?? 0,
    }));
    const phoneDigits = digitsOnly(order.customerPhone);
    const contactPhone = /^\d{10,11}$/.test(phoneDigits) ? `55${phoneDigits}` : /^55\d{10,11}$/.test(phoneDigits) ? phoneDigits : null;
    const provider = resolveShippingProvider(order.shippingProvider);
    const isPaid = order.status === "paid";
    const labelState: AdminOrder["label"]["state"] = !isPaid ? "unavailable"
      : order.shippingLabelUrl ? "ready"
      : order.shippingLabelId ? "bought"
      : !order.customerDocument ? "missing-cpf"
      : "to-buy";
    const addressLine = `${order.streetAddress}, ${order.addressNumber}${order.addressComplement ? ` · ${order.addressComplement}` : ""}`;
    const postalCode = formatPostalCode(order.postalCode);

    return {
      id: order.id,
      shortId: order.id.slice(0, 8),
      status: order.status,
      createdAt: order.createdAt,
      createdLabel: absoluteDate(order.createdAt),
      createdRelative: relativeDate(order.createdAt, now),
      paymentExpiresLabel: paymentDeadlineLabel(order, now),
      paymentId: order.mercadoPagoPaymentId,
      customer: {
        name: order.customerName || "Cliente sem nome",
        email: order.customerEmail,
        phoneLabel: contactPhone ? formatPhone(contactPhone.slice(2)) : order.customerPhone,
        phoneHref: contactPhone ? `tel:+${contactPhone}` : null,
        whatsappHref: contactPhone ? `https://wa.me/${contactPhone}` : null,
        cpfMasked: maskCpf(order.customerDocument),
        hasCpf: Boolean(order.customerDocument),
        hasFullName: hasFullName(order.customerName),
      },
      address: {
        street: addressLine,
        complement: order.addressComplement,
        district: order.neighborhood,
        city: `${order.city}/${order.state}`,
        postalCode,
        copyText: [order.customerName, addressLine, `${order.neighborhood} · ${order.city}/${order.state}`, `CEP ${postalCode}`].join("\n"),
      },
      items: orderItemsForOrder,
      itemCount: orderItemsForOrder.reduce((sum, item) => sum + item.quantity, 0),
      hasPersonalization: orderItemsForOrder.some(item => item.personalization),
      unread: orderItemsForOrder.reduce((sum, item) => sum + item.unread, 0),
      totals: {
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        couponCode: order.couponCode,
        shippingCents: order.shippingCents,
        totalCents: order.totalCents,
      },
      shipping: {
        providerName: shippingProviderName(provider),
        company: order.shippingCompanyName,
        service: order.shippingServiceName,
        deliveryDays: order.shippingDeliveryTimeDays,
        sandbox: getShippingProviderEnvironment(provider) === "sandbox",
        superFrete: provider === "super_frete",
      },
      label: {
        state: labelState,
        canceled: order.shippingLabelStatus === "canceled",
        url: order.shippingLabelUrl,
        error: order.shippingLabelError,
        canSync: isPaid && provider === "super_frete" && Boolean(order.shippingLabelId),
      },
      fulfillment: {
        status: fulfillmentStep(order.fulfillmentStatus).id,
        revision: order.fulfillmentRevision,
        note: order.fulfillmentNote,
        trackingCode: order.shippingTrackingCode,
        updatedLabel: order.fulfillmentUpdatedAt ? absoluteDate(order.fulfillmentUpdatedAt) : null,
      },
      events: events.filter(event => event.orderId === order.id).slice(0, 12).map(event => ({
        id: event.id,
        status: fulfillmentStep(event.status).id,
        note: event.note,
        trackingCode: event.trackingCode,
        createdAt: event.createdAt,
        createdLabel: absoluteDate(event.createdAt),
      })),
    };
  });
}
