// One-off, explicitly authorized recovery. Never called by the normal build.
import { createClient } from "@libsql/client";
import { createCipheriv, createHash, publicEncrypt, randomBytes } from "node:crypto";

const keepPrefix = "af614521";
const removePrefix = "2d4481d6";
const mode = process.env.DUPLICATE_OPERATION;
if (!["backup", "remove"].includes(mode)) throw new Error("Escolha backup ou remove explicitamente.");
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const sha = value => createHash("sha256").update(value).digest("hex");
const normalize = result => result.rows.map(row => Object.fromEntries(result.columns.map(column => [column, row[column]])));
const canonicalItems = items => JSON.stringify(items.map(item => JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => !["id", "order_id"].includes(key))))).sort());

async function snapshot(connection) {
  const result = await connection.execute({ sql: "SELECT * FROM orders WHERE id LIKE ? OR id LIKE ? ORDER BY id", args: [`${keepPrefix}%`, `${removePrefix}%`] });
  const rows = normalize(result);
  const keep = rows.filter(row => row.id.startsWith(keepPrefix));
  const remove = rows.filter(row => row.id.startsWith(removePrefix));
  if (keep.length !== 1 || remove.length !== 1) throw new Error("Os dois alvos precisam existir sem ambiguidade.");
  const original = keep[0], duplicate = remove[0];
  if (!original.user_id || original.user_id !== duplicate.user_id) throw new Error("Clientes diferentes.");
  const ignored = new Set(["id", "created_at", "updated_at", "shipping_quoted_at", "mercado_pago_preference_id", "checkout_url"]);
  if (result.columns.some(column => !ignored.has(column) && original[column] !== duplicate[column])) throw new Error("Os dados dos pedidos mudaram ou diferem.");
  for (const row of rows) {
    if (row.status !== "pending" || row.mercado_pago_payment_id || row.mercado_pago_status || row.coupon_id || row.discount_cents || row.shipping_label_id || row.shipping_tracking_code) throw new Error("Pedido possui pagamento, cupom ou atividade; remoção bloqueada.");
  }
  const events = await connection.execute({ sql: "SELECT count(*) AS total FROM payment_events WHERE order_id IN (?, ?)", args: [original.id, duplicate.id] });
  if (Number(events.rows[0].total)) throw new Error("Há eventos de pagamento; remoção bloqueada.");
  const items = normalize(await connection.execute({ sql: "SELECT * FROM order_items WHERE order_id IN (?, ?) ORDER BY id", args: [original.id, duplicate.id] }));
  if (!items.length || canonicalItems(items.filter(row => row.order_id === original.id)) !== canonicalItems(items.filter(row => row.order_id === duplicate.id))) throw new Error("Itens diferentes.");
  return { original, duplicate, items };
}

async function mp(path, init = {}) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Credencial do Mercado Pago ausente.");
  const response = await fetch(`https://api.mercadopago.com${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`Mercado Pago HTTP ${response.status}; operação interrompida.`);
  return response.json();
}
async function noPayments(order) {
  const payments = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(order.id)}&limit=1`);
  if (!Array.isArray(payments.results) || payments.results.length || payments.paging?.total !== 0) throw new Error("Pagamento encontrado ou busca inconclusiva no Mercado Pago.");
}

let tx;
try {
  tx = await client.transaction("read");
  const data = await snapshot(tx);
  await tx.rollback(); tx.close(); tx = null;
  await noPayments(data.original);
  await noPayments(data.duplicate);
  const preferencePath = `/checkout/preferences/${encodeURIComponent(data.duplicate.mercado_pago_preference_id)}`;
  const preference = await mp(preferencePath);
  if (preference.external_reference !== data.duplicate.id) throw new Error("Preferência não pertence à duplicata.");
  const json = JSON.stringify(data);
  const digest = sha(json);
  console.log("DUPLICATE_VERIFIED", JSON.stringify({ keep: keepPrefix, remove: removePrefix, status: "pending", totalCents: data.duplicate.total_cents, payments: 0, digest }));
  if (mode === "backup") {
    const publicKey = Buffer.from(process.env.DUPLICATE_BACKUP_PUBLIC_KEY || "", "base64").toString();
    const key = randomBytes(32), iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
    const envelope = {
      version: 1, digest,
      key: publicEncrypt({ key: publicKey, oaepHash: "sha256" }, key).toString("base64"),
      iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64"),
    };
    const encoded = Buffer.from(JSON.stringify(envelope)).toString("base64");
    const chunks = encoded.match(/.{1,1000}/g);
    chunks.forEach((chunk, index) => console.log(`DUPLICATE_BACKUP_CHUNK ${index}/${chunks.length} ${chunk}`));
  } else {
    if (process.env.DUPLICATE_BACKUP_DIGEST !== digest) throw new Error("Backup confirmado não corresponde ao estado atual.");
    await mp(preferencePath, { method: "PUT", body: JSON.stringify({ expires: true, expiration_date_from: new Date(Date.now() - 120000).toISOString(), expiration_date_to: new Date(Date.now() - 60000).toISOString() }) });
    const expired = await mp(preferencePath);
    if (!expired.expires || !(Date.parse(expired.expiration_date_to) < Date.now())) throw new Error("Não foi possível confirmar a expiração do link.");
    await noPayments(data.duplicate);
    tx = await client.transaction("write");
    const current = await snapshot(tx);
    if (sha(JSON.stringify(current)) !== digest) throw new Error("Os registros mudaram; nenhuma exclusão realizada.");
    const deleted = await tx.execute({ sql: "DELETE FROM orders WHERE id = ? AND status = 'pending' AND mercado_pago_payment_id IS NULL RETURNING id", args: [data.duplicate.id] });
    if (deleted.rows.length !== 1) throw new Error("Exclusão não atingiu exatamente um pedido.");
    // Explicitly handle items even if foreign-key cascades are not enabled.
    await tx.execute({ sql: "DELETE FROM order_items WHERE order_id = ?", args: [data.duplicate.id] });
    const remaining = await tx.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [data.original.id] });
    if (JSON.stringify(normalize(remaining)[0]) !== JSON.stringify(data.original)) throw new Error("O pedido preservado mudou.");
    if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("Integridade referencial inválida.");
    await tx.commit(); tx.close(); tx = null;
    const check = await client.execute({ sql: "SELECT substr(id,1,8) AS id, status FROM orders WHERE id IN (?, ?)", args: [data.original.id, data.duplicate.id] });
    if (check.rows.length !== 1 || check.rows[0].id !== keepPrefix) throw new Error("Verificação final inesperada.");
    console.log("DUPLICATE_REMOVED", JSON.stringify({ removed: removePrefix, preserved: keepPrefix, backupDigest: digest, paymentLinkExpired: true, remaining: normalize(check) }));
  }
} finally {
  if (tx) { await tx.rollback().catch(() => {}); tx.close(); }
  client.close();
}
