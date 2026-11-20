import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, gte, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { orderItems, orders } from "../db/schema";

export class OrdersIntegrationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const tokenPattern = /^[A-Za-z0-9._~+/-]{32,512}={0,2}$/;
const isoDate = z.iso.datetime({ offset: true, precision: 3 });
const inputDate = z.iso.datetime({ offset: true });
const canonicalDate = (value: string) => new Date(value).toISOString();
const cursorSchema = z.object({
  v: z.literal(1),
  updatedSince: isoDate,
  until: isoDate,
  limit: z.number().int().min(1).max(100),
  after: z.object({ updatedAt: isoDate, id: z.string().min(1).max(200) }).strict(),
}).strict();
type Cursor = z.infer<typeof cursorSchema>;
type Query = Omit<Cursor, "v" | "after"> & { after: Cursor["after"] | null };

// Fixed-length digests avoid both length-dependent comparison and token disclosure.
export function authorizeOrdersIntegration(headers: Headers): string {
  const expected = process.env.ARTGIAN_CRM_API_TOKEN;
  if (!expected || !tokenPattern.test(expected)) {
    throw new OrdersIntegrationError("Integração de pedidos não configurada.", 503);
  }
  const match = /^Bearer ([A-Za-z0-9._~+/-]+={0,2})$/i.exec(headers.get("authorization") ?? "");
  const supplied = match?.[1] ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(expected), digest(supplied))) {
    throw new OrdersIntegrationError("Autenticação necessária.", 401);
  }
  return expected;
}

function cursorSignature(payload: string, token: string) {
  return createHmac("sha256", token).update(`artgian-orders-v1:${payload}`).digest();
}

function encodeCursor(query: Query, after: Cursor["after"], token: string) {
  const payload = Buffer.from(JSON.stringify({ v: 1, updatedSince: query.updatedSince, until: query.until, limit: query.limit, after })).toString("base64url");
  return `${payload}.${cursorSignature(payload, token).toString("base64url")}`;
}

function decodeCursor(value: string, token: string): Cursor {
  try {
    if (value.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) throw new Error();
    const [payload, signature] = value.split(".");
    const suppliedSignature = Buffer.from(signature, "base64url");
    if (suppliedSignature.length !== 32 || !timingSafeEqual(cursorSignature(payload, token), suppliedSignature)) throw new Error();
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (parsed.updatedSince > parsed.until || parsed.after.updatedAt < parsed.updatedSince || parsed.after.updatedAt > parsed.until) throw new Error();
    return parsed;
  } catch {
    throw new OrdersIntegrationError("Cursor inválido. Reinicie a sincronização da janela.");
  }
}

export function parseOrdersIntegrationQuery(params: URLSearchParams, token: string, now = new Date()): Query {
  const allowed = new Set(["updated_since", "until", "limit", "cursor"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new OrdersIntegrationError("Parâmetros inválidos ou repetidos.");
  }
  const readDate = (key: string) => {
    const value = params.get(key);
    if (value === null) return null;
    if (!inputDate.safeParse(value).success) throw new OrdersIntegrationError(`Informe ${key} em ISO 8601 com fuso horário.`);
    return canonicalDate(value);
  };
  const updatedSince = readDate("updated_since");
  const until = readDate("until");
  const rawLimit = params.get("limit");
  if (rawLimit !== null && !/^(?:[1-9]\d?|100)$/.test(rawLimit)) throw new OrdersIntegrationError("limit deve ser um inteiro entre 1 e 100.");
  const limit = rawLimit === null ? null : Number(rawLimit);
  const rawCursor = params.get("cursor");
  if (rawCursor !== null) {
    const cursor = decodeCursor(rawCursor, token);
    if ((updatedSince !== null && updatedSince !== cursor.updatedSince) || (until !== null && until !== cursor.until) || (limit !== null && limit !== cursor.limit)) {
      throw new OrdersIntegrationError("Os filtros e o limite devem permanecer iguais entre páginas.");
    }
    return { updatedSince: cursor.updatedSince, until: cursor.until, limit: cursor.limit, after: cursor.after };
  }
  const query = { updatedSince: updatedSince ?? "1970-01-01T00:00:00.000Z", until: until ?? now.toISOString(), limit: limit ?? 50, after: null };
  if (query.updatedSince > query.until || query.until > now.toISOString()) throw new OrdersIntegrationError("A janela deve ter updated_since ≤ until ≤ agora.");
  return query;
}

// SQLite defaults contain a space and no timezone; later updates use ISO UTC.
// Normalize every component before max/filter/order, including fulfillment-only changes.
const effectiveUpdatedAt = sql<string>`max(
  strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.updatedAt}),
  coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.fulfillmentUpdatedAt}), strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.updatedAt})),
  coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.shippingLabelUpdatedAt}), strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.updatedAt}))
)`;

// Allowlist at the SQL boundary: payment/checkout links, CPF, raw payloads,
// label URLs/errors, internal notes and provider payment IDs are never selected.
const orderSelection = {
  id: orders.id, status: orders.status, testMarkedAt: orders.testMarkedAt,
  customerName: orders.customerName, customerEmail: orders.customerEmail, customerPhone: orders.customerPhone,
  postalCode: orders.postalCode, streetAddress: orders.streetAddress, addressNumber: orders.addressNumber,
  addressComplement: orders.addressComplement, neighborhood: orders.neighborhood, city: orders.city, state: orders.state,
  subtotalCents: orders.subtotalCents, discountCents: orders.discountCents, shippingCents: orders.shippingCents, totalCents: orders.totalCents,
  shippingProvider: orders.shippingProvider, shippingServiceName: orders.shippingServiceName, shippingCompanyName: orders.shippingCompanyName,
  shippingDeliveryTimeDays: orders.shippingDeliveryTimeDays, shippingLabelStatus: orders.shippingLabelStatus, shippingTrackingCode: orders.shippingTrackingCode,
  fulfillmentStatus: orders.fulfillmentStatus,
  fulfillmentUpdatedAt: sql<string | null>`strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.fulfillmentUpdatedAt})`.as("integration_fulfillment_updated_at"),
  shippingLabelUpdatedAt: sql<string | null>`strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.shippingLabelUpdatedAt})`.as("integration_shipping_label_updated_at"),
  mercadoPagoStatus: orders.mercadoPagoStatus,
  createdAt: sql<string>`strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.createdAt})`.as("integration_created_at"),
  updatedAt: sql<string>`strftime('%Y-%m-%dT%H:%M:%fZ', ${orders.updatedAt})`.as("integration_updated_at"),
  effectiveUpdatedAt: effectiveUpdatedAt.as("integration_effective_updated_at"),
};

export interface IntegrationOrder {
  source: "artgian_studio";
  id: string;
  status: string;
  /** True when the seller flagged the order as a store test; the CRM should not count it as a sale. */
  test: boolean;
  payment: { provider: "mercado_pago"; status: string | null };
  fulfillment: { status: string; updatedAt: string | null };
  customer: { name: string; email: string; phone: string };
  shippingAddress: { postalCode: string; street: string; number: string; complement: string | null; neighborhood: string; city: string; state: string; country: "BR" };
  items: { id: string; productId: string; name: string; color: string; personalization: string | null; quantity: number; unitPriceCents: number; totalCents: number }[];
  totals: { currency: "BRL"; subtotalCents: number; discountCents: number; shippingCents: number; totalCents: number };
  shipping: { provider: string | null; service: string | null; company: string | null; deliveryTimeDays: number | null; labelStatus: string | null; trackingCode: string | null; updatedAt: string | null };
  createdAt: string;
  updatedAt: string;
  effectiveUpdatedAt: string;
}

async function readOrders(condition: SQL, limit: number): Promise<IntegrationOrder[]> {
  const db = await getDb();
  const page = db.select(orderSelection).from(orders).where(condition)
    .orderBy(asc(effectiveUpdatedAt), asc(orders.id)).limit(limit).as("integration_order_page");
  const items = db.select({
    id: orderItems.id, orderId: orderItems.orderId, productId: orderItems.productId, productName: orderItems.productName,
    color: orderItems.color, personalization: orderItems.personalization, quantity: orderItems.quantity, unitPriceCents: orderItems.unitPriceCents,
  }).from(orderItems).as("integration_items");
  // A single SQL statement reads the bounded order page and its items consistently.
  // The limit applies to orders before the join, never to item rows.
  const rows = await db.select().from(page).leftJoin(items, eq(items.orderId, page.id))
    .orderBy(asc(page.effectiveUpdatedAt), asc(page.id), asc(items.id));
  const result = new Map<string, IntegrationOrder>();
  for (const { integration_order_page: order, integration_items: item } of rows) {
    let dto = result.get(order.id);
    if (!dto) {
      dto = {
        source: "artgian_studio", id: order.id, status: order.status, test: Boolean(order.testMarkedAt),
        payment: { provider: "mercado_pago", status: order.mercadoPagoStatus },
        fulfillment: { status: order.fulfillmentStatus, updatedAt: order.fulfillmentUpdatedAt },
        customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone },
        shippingAddress: { postalCode: order.postalCode, street: order.streetAddress, number: order.addressNumber, complement: order.addressComplement, neighborhood: order.neighborhood, city: order.city, state: order.state, country: "BR" },
        items: [],
        totals: { currency: "BRL", subtotalCents: order.subtotalCents, discountCents: order.discountCents, shippingCents: order.shippingCents, totalCents: order.totalCents },
        shipping: { provider: order.shippingProvider, service: order.shippingServiceName, company: order.shippingCompanyName, deliveryTimeDays: order.shippingDeliveryTimeDays, labelStatus: order.shippingLabelStatus, trackingCode: order.shippingTrackingCode, updatedAt: order.shippingLabelUpdatedAt },
        createdAt: order.createdAt, updatedAt: order.updatedAt, effectiveUpdatedAt: order.effectiveUpdatedAt,
      };
      result.set(order.id, dto);
    }
    if (item) dto.items.push({ id: String(item.id), productId: item.productId, name: item.productName, color: item.color, personalization: item.personalization, quantity: item.quantity, unitPriceCents: item.unitPriceCents, totalCents: item.quantity * item.unitPriceCents });
  }
  return [...result.values()];
}

export function ordersIntegrationResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Vary": "Authorization",
      ...(status === 401 ? { "WWW-Authenticate": 'Bearer realm="artgian-orders"' } : {}),
    },
  });
}

function errorResponse(error: unknown) {
  return ordersIntegrationResponse({ error: error instanceof OrdersIntegrationError ? error.message : "Não foi possível consultar os pedidos." }, error instanceof OrdersIntegrationError ? error.status : 500);
}

export async function handleIntegrationOrdersList(request: Request) {
  try {
    const token = authorizeOrdersIntegration(request.headers);
    const query = parseOrdersIntegrationQuery(new URL(request.url).searchParams, token);
    const bounds = and(gte(effectiveUpdatedAt, query.updatedSince), lte(effectiveUpdatedAt, query.until));
    const after = query.after && or(gt(effectiveUpdatedAt, query.after.updatedAt), and(eq(effectiveUpdatedAt, query.after.updatedAt), gt(orders.id, query.after.id)));
    const rows = await readOrders(and(bounds, after || undefined)!, query.limit + 1);
    const hasMore = rows.length > query.limit;
    const data = rows.slice(0, query.limit);
    const last = data.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(query, { updatedAt: last.effectiveUpdatedAt, id: last.id }, token) : null;
    // Existing checkout inserts use second-resolution SQLite timestamps. Re-read
    // an overlap after the complete window to catch these and concurrent commits.
    const resumeFrom = new Date(Math.max(0, Date.parse(query.until) - 120_000)).toISOString();
    return ordersIntegrationResponse({ data, pagination: { limit: query.limit, hasMore, nextCursor, updatedSince: query.updatedSince, until: query.until, resumeFrom } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleIntegrationOrderDetail(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    authorizeOrdersIntegration(request.headers);
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new OrdersIntegrationError("Identificador de pedido inválido.");
    const [data] = await readOrders(eq(orders.id, id), 1);
    if (!data) throw new OrdersIntegrationError("Pedido não encontrado.", 404);
    return ordersIntegrationResponse({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
