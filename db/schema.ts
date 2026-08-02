import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("pending"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerDocument: text("customer_document"),
    postalCode: text("postal_code").notNull(),
    streetAddress: text("street_address").notNull(),
    addressNumber: text("address_number").notNull(),
    addressComplement: text("address_complement"),
    neighborhood: text("neighborhood").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    shippingProvider: text("shipping_provider"),
    shippingServiceId: text("shipping_service_id"),
    shippingServiceName: text("shipping_service_name"),
    shippingCompanyId: text("shipping_company_id"),
    shippingCompanyName: text("shipping_company_name"),
    shippingDeliveryTimeDays: integer("shipping_delivery_time_days"),
    shippingQuotedAt: text("shipping_quoted_at"),
    shippingLabelId: text("shipping_label_id"),
    shippingLabelStatus: text("shipping_label_status"),
    shippingLabelUrl: text("shipping_label_url"),
    shippingTrackingCode: text("shipping_tracking_code"),
    shippingLabelError: text("shipping_label_error"),
    shippingLabelUpdatedAt: text("shipping_label_updated_at"),
    totalCents: integer("total_cents").notNull(),
    mercadoPagoPreferenceId: text("mercado_pago_preference_id"),
    mercadoPagoPaymentId: text("mercado_pago_payment_id"),
    mercadoPagoStatus: text("mercado_pago_status"),
    mercadoPagoStatusDetail: text("mercado_pago_status_detail"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("orders_status_idx").on(table.status),
    index("orders_payment_id_idx").on(table.mercadoPagoPaymentId),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    productName: text("product_name").notNull(),
    color: text("color").notNull(),
    personalization: text("personalization"),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (table) => [index("order_items_order_id_idx").on(table.orderId)],
);

export const paymentEvents = sqliteTable(
  "payment_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventKey: text("event_key").notNull(),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    paymentId: text("payment_id").notNull(),
    action: text("action"),
    payload: text("payload").notNull(),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("payment_events_event_key_unique").on(table.eventKey),
    index("payment_events_order_id_idx").on(table.orderId),
  ],
);
