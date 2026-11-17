import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const digest = value => createHash("sha256").update(value).digest("hex");

export async function verifyCustomerNotificationsSchema(connection) {
  const columns = (await connection.execute("PRAGMA table_info(orders)")).rows;
  if (!columns.some(row => row.name === "whatsapp_opt_in" && row.type === "INTEGER" && Number(row.notnull) === 1 && ["0", "false"].includes(String(row.dflt_value).toLowerCase())) ||
      !["whatsapp_opt_in_at", "whatsapp_opt_in_source"].every(name => columns.some(row => row.name === name && row.type === "TEXT" && Number(row.notnull) === 0))) throw new Error("As colunas de consentimento para notificações do cliente estão ausentes ou inválidas.");
}

export async function verifyOrderMessagesSchema(connection) {
  const columns = (await connection.execute("PRAGMA table_info(order_item_messages)")).rows;
  const required = { id: "INTEGER", order_item_id: "INTEGER", sender: "TEXT", body: "TEXT", client_id: "TEXT", created_at: "TEXT", read_at: "TEXT" };
  if (!Object.entries(required).every(([name, type]) => columns.some(row => row.name === name && row.type === type && Number(row.notnull) === (name === "read_at" ? 0 : 1))) ||
      !columns.some(row => row.name === "id" && Number(row.pk) === 1)) throw new Error("A tabela de mensagens de compras está ausente ou incompleta.");
  const indexes = (await connection.execute("PRAGMA index_list(order_item_messages)")).rows;
  for (const [name, names, unique] of [
    ["order_item_messages_thread_idx", "order_item_id,id", 0],
    ["order_item_messages_unread_idx", "order_item_id,sender,read_at", 0],
    ["order_item_messages_client_unique", "order_item_id,sender,client_id", 1],
  ]) {
    const fields = (await connection.execute(`PRAGMA index_info(${name})`)).rows;
    if (!indexes.some(row => row.name === name && Number(row.unique) === unique) || fields.map(row => row.name).join(",") !== names) throw new Error(`Índice de mensagens de compras inválido: ${name}.`);
  }
  const references = (await connection.execute("PRAGMA foreign_key_list(order_item_messages)")).rows;
  if (!references.some(row => row.table === "order_items" && row.from === "order_item_id" && row.to === "id" && row.on_delete === "CASCADE")) throw new Error("Referência de mensagens de compras inválida.");
}

export async function verifyMcpSchema(connection) {
  const required = {
    mcp_clients: ["id", "name", "redirect_uris", "secret_hash", "created_at"],
    mcp_connections: ["id", "client_id", "scopes", "created_at", "revoked_at"],
    mcp_credentials: ["hash", "kind", "connection_id", "details", "expires_at"],
    mcp_product_operations: ["id", "connection_id", "key", "fingerprint", "product_id", "response"],
    mcp_rate_limits: ["key", "count", "expires_at"],
    product_images: ["id", "owner", "content_hash", "data", "width", "height", "created_at"],
  };
  for (const [table, names] of Object.entries(required)) {
    const columns = (await connection.execute(`PRAGMA table_info(${table})`)).rows;
    if (!names.every(name => columns.some(row => row.name === name))) throw new Error(`Schema MCP ausente ou incompleto: ${table}.`);
  }
  for (const [table, name, columns] of [["mcp_product_operations", "mcp_product_operations_key_unique", "connection_id,key"], ["product_images", "product_images_owner_hash_unique", "owner,content_hash"]]) {
    const indexes = (await connection.execute(`PRAGMA index_list(${table})`)).rows;
    const index = (await connection.execute(`PRAGMA index_info(${name})`)).rows;
    if (!indexes.some(row => row.name === name && Number(row.unique) === 1) || index.map(row => row.name).join(",") !== columns) throw new Error(`Índice MCP inválido: ${name}.`);
  }
}

export async function verifyNotifySchema(connection) {
  const columns = (await connection.execute("PRAGMA table_info(notify_outbox)")).rows;
  const names = ["id", "idempotency_key", "type", "correlation_id", "target_origin", "payload", "status", "attempts", "cycle_attempts", "next_attempt_at", "lease_token", "lease_expires_at", "last_error", "notify_event_id", "occurred_at", "created_at", "updated_at", "last_attempt_at", "accepted_at"];
  if (!names.every(name => columns.some(row => row.name === name))) throw new Error("A outbox do Notify está ausente ou incompleta.");
  const indexes = (await connection.execute("PRAGMA index_list(notify_outbox)")).rows;
  if (!indexes.some(row => row.name === "notify_outbox_key_unique" && Number(row.unique) === 1) ||
    !indexes.some(row => row.name === "notify_outbox_pending_idx") || !indexes.some(row => row.name === "notify_outbox_lease_idx")) throw new Error("Índices da outbox do Notify inválidos.");
  const key = (await connection.execute("PRAGMA index_info(notify_outbox_key_unique)")).rows;
  if (key.map(row => row.name).join(",") !== "idempotency_key") throw new Error("Chave única da outbox do Notify inválida.");
  const trigger = (await connection.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='notify_outbox_immutable'")).rows;
  if (trigger.length !== 1) throw new Error("Proteção de imutabilidade da outbox ausente.");
}

export async function verifyFulfillmentSchema(connection) {
  const columns = (await connection.execute("PRAGMA table_info(orders)")).rows;
  if (!columns.some(row => row.name === "fulfillment_status" && row.type === "TEXT" && Number(row.notnull) === 1 && row.dflt_value === "'preparing'") ||
      !columns.some(row => row.name === "fulfillment_revision" && row.type === "INTEGER" && Number(row.notnull) === 1 && String(row.dflt_value) === "0") ||
      !["fulfillment_note", "fulfillment_updated_at"].every(name => columns.some(row => row.name === name && row.type === "TEXT" && Number(row.notnull) === 0))) throw new Error("As colunas de acompanhamento da entrega estão ausentes ou inválidas.");
  const events = (await connection.execute("PRAGMA table_info(order_fulfillment_events)")).rows;
  if (!["id", "order_id", "status", "note", "tracking_code", "source", "created_at"].every(name => events.some(row => row.name === name && row.type === "TEXT"))) throw new Error("O histórico de acompanhamento da entrega está ausente ou incompleto.");
  const indexes = (await connection.execute("PRAGMA index_info(order_fulfillment_events_order_idx)")).rows;
  if (indexes.map(row => row.name).join(",") !== "order_id,created_at") throw new Error("Índice do histórico de acompanhamento inválido.");
  const references = (await connection.execute("PRAGMA foreign_key_list(order_fulfillment_events)")).rows;
  if (!references.some(row => row.table === "orders" && row.from === "order_id" && row.to === "id" && row.on_delete === "CASCADE")) throw new Error("Referência do histórico de acompanhamento inválida.");
}

export async function verifyStoreSchema(client, { applyContact = false } = {}) {
  const { entries } = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const migrations = await Promise.all(entries.map(async entry => {
    const sql = await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), "utf8");
    return { ...entry, sql, hash: digest(sql) };
  }));
  const expected = migrations.at(-1);
  const contact = migrations.find(entry => entry.tag === "0018_sticky_phantom_reporter");
  const previous = migrations.find(entry => entry.idx === contact.idx - 1);
  const tx = await client.transaction(applyContact ? "write" : "read");
  try {
    const latest = (await tx.execute("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1")).rows[0];
    const matches = migration => Number(latest?.created_at) === migration.when && latest.hash === migration.hash;
    if (applyContact && matches(previous)) {
      // This recovery can only add the reviewed nullable phone column. It never
      // runs arbitrary pending migrations or changes existing customer values.
      if (contact.sql.trim() !== 'ALTER TABLE `store_user` ADD `phone` text;') throw new Error("Migração de telefone inesperada.");
      const before = await tx.execute("SELECT * FROM store_user ORDER BY id");
      const fingerprint = result => digest(JSON.stringify(result.rows.map(row => before.columns.map(column => row[column]))));
      const original = fingerprint(before);
      await tx.execute(contact.sql);
      const after = await tx.execute("SELECT * FROM store_user ORDER BY id");
      if (fingerprint(after) !== original || after.rows.some(row => row.phone !== null)) throw new Error("Os dados existentes não foram preservados.");
      await tx.execute({ sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", args: [contact.hash, contact.when] });
      if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("Integridade referencial inválida.");
      if (expected.hash !== contact.hash) throw new Error("Existem outras migrações pendentes; publique-as separadamente.");
      console.log("Migração 0018 aplicada; todos os dados existentes dos clientes preservados.");
    } else if (!matches(expected)) {
      throw new Error(`Banco desatualizado ou migração divergente. A publicação requer ${expected.tag}. Aplique as migrações no banco deste ambiente antes de publicar.`);
    }
    const columns = (await tx.execute("PRAGMA table_info(store_user)")).rows;
    if (!columns.some(row => row.name === "phone" && row.type === "TEXT" && Number(row.notnull) === 0)) throw new Error("A coluna de telefone está ausente ou inválida.");
    const orderColumns = (await tx.execute("PRAGMA table_info(orders)")).rows;
    if (!["checkout_mode", "payment_expires_at"].every(name => orderColumns.some(row => row.name === name))) throw new Error("As colunas do checkout integrado estão ausentes.");
    const paymentColumns = (await tx.execute("PRAGMA table_info(payment_attempts)")).rows;
    if (!["id", "order_id", "method", "status", "provider_payment_id", "request_payload", "device_id", "result", "provider_updated_at", "created_at", "updated_at"].every(name => paymentColumns.some(row => row.name === name))) throw new Error("A tabela de tentativas de pagamento está ausente ou incompleta.");
    await verifyFulfillmentSchema(tx);
    await verifyNotifySchema(tx);
    await verifyMcpSchema(tx);
    await verifyOrderMessagesSchema(tx);
    await verifyCustomerNotificationsSchema(tx);
    if (applyContact) await tx.commit();
    else await tx.rollback();
    console.log(`Schema do banco verificado: ${expected.tag}.`);
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  } finally {
    tx.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Never load .env.local here: use only the deployment's actual credentials.
  const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;
  if (!url || !authToken || url === "[SENSITIVE]" || authToken === "[SENSITIVE]") throw new Error("Credenciais reais do ambiente de publicação ausentes.");
  const client = createClient({ url, authToken });
  try {
    await verifyStoreSchema(client, {
      applyContact: process.argv.includes("--apply-contact") || process.env.ARTGIAN_APPLY_CONTACT_MIGRATION === "1",
    });
  } finally {
    client.close();
  }
}
