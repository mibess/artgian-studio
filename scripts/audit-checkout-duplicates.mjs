import { createClient } from "@libsql/client";

const prefixes = (process.env.ARTGIAN_AUDIT_ORDER_PREFIXES || "").split(",");
if (prefixes.length !== 2 || prefixes.some(value => !/^[a-f0-9]{8}$/.test(value))) throw new Error("Informe exatamente dois prefixos de pedidos com oito caracteres.");
const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;
if (!url || !authToken || url === "[SENSITIVE]" || authToken === "[SENSITIVE]") throw new Error("Credenciais reais de produção ausentes.");
const client = createClient({ url, authToken });
const tx = await client.transaction("read");
try {
  const found = await tx.execute({ sql: "SELECT * FROM orders WHERE id LIKE ? OR id LIKE ?", args: prefixes.map(prefix => `${prefix}%`) });
  if (found.rows.length !== 2 || prefixes.some(prefix => found.rows.filter(row => row.id.startsWith(prefix)).length !== 1)) throw new Error("Os prefixos não identificam exatamente dois pedidos.");
  const [first, second] = found.rows;
  const technical = new Set(["id", "created_at", "updated_at", "shipping_quoted_at", "mercado_pago_preference_id", "checkout_url", "mercado_pago_payment_id", "mercado_pago_status", "mercado_pago_status_detail"]);
  const businessFields = found.columns.filter(column => !technical.has(column));
  const differences = businessFields.filter(column => first[column] !== second[column]);
  const itemResults = await Promise.all(found.rows.map(order => tx.execute({ sql: "SELECT product_id, product_name, color, personalization, quantity, unit_price_cents, shipping_package_snapshot FROM order_items WHERE order_id = ?", args: [order.id] })));
  const canonical = result => JSON.stringify(result.rows.map(row => JSON.stringify(result.columns.map(column => row[column]))).sort());
  console.log("CHECKOUT_DUPLICATE_AUDIT", JSON.stringify({
    orders: found.rows.map(order => ({ id: order.id.slice(0, 8), status: order.status, createdAt: order.created_at, totalCents: order.total_cents, hasPaymentPreference: Boolean(order.mercado_pago_preference_id), hasCheckoutUrl: Boolean(order.checkout_url), hasPayment: Boolean(order.mercado_pago_payment_id) })),
    sameCustomer: Boolean(first.user_id) && first.user_id === second.user_id,
    differingBusinessFields: differences,
    sameItems: canonical(itemResults[0]) === canonical(itemResults[1]),
    distinctPaymentPreferences: first.mercado_pago_preference_id !== second.mercado_pago_preference_id,
    businessFieldsCompared: businessFields.length,
    itemCounts: itemResults.map(result => result.rows.length),
  }));
} finally {
  await tx.rollback();
  tx.close();
  client.close();
}
