import { createClient } from "@libsql/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";
import { verifyFulfillmentSchema } from "./verify-store-schema.mjs";

// Explicit opt-in: a backup and local restore rehearsal always precede remote writes.
const envFile = process.argv.find(arg => arg.startsWith("--env="))?.slice(6);
if (!envFile) throw new Error("Informe --env=/caminho/seguro.env.");
const env = parseEnv(await readFile(envFile, "utf8"));
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) throw new Error("Credenciais ausentes.");
const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")).entries;
const contactOnly = process.argv.includes("--contact");
const paymentsOnly = process.argv.includes("--payments");
const fulfillmentOnly = process.argv.includes("--fulfillment");
if ([contactOnly, paymentsOnly, fulfillmentOnly].filter(Boolean).length > 1) throw new Error("Selecione apenas uma migração: --contact, --payments ou --fulfillment.");
const baselineTag = fulfillmentOnly ? "0019_sparkling_dust" : paymentsOnly ? "0018_sticky_phantom_reporter" : contactOnly ? "0017_gorgeous_talon" : "0014_unusual_cassandra_nova";
const pendingTags = fulfillmentOnly ? ["0020_order_fulfillment"] : paymentsOnly ? ["0019_sparkling_dust"] : contactOnly ? ["0018_sticky_phantom_reporter"] : ["0015_gray_manta", "0016_volatile_namor", "0017_gorgeous_talon"];
const migrations = await Promise.all(journal.map(async entry => {
  const sql = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
  return { ...entry, sql, hash: createHash("sha256").update(sql).digest("hex") };
}));
const quote = name => `"${name.replaceAll('"', '""')}"`;
const encode = value => {
  if (typeof value === "bigint") return { type: "bigint", value: String(value) };
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
    return { type: "blob", value: Buffer.from(value instanceof ArrayBuffer ? value : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).toString("base64") };
  return value;
};
const decode = value => {
  if (value?.type === "bigint") return BigInt(value.value);
  if (value?.type === "blob") return Buffer.from(value.value, "base64");
  return value;
};
const sortedRows = rows => rows.map(row => JSON.stringify(row)).sort();
const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN, intMode: "bigint" });

async function snapshot(connection) {
  const schema = (await connection.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name")).rows;
  const tables = [];
  const entries = schema.filter(row => row.type === "table");
  const results = await connection.batch(entries.map(entry => `SELECT * FROM ${quote(entry.name)}`));
  for (const [index, entry] of entries.entries()) {
    const result = results[index];
    tables.push({ name: entry.name, columns: result.columns, rows: result.rows.map(row => result.columns.map(column => encode(row[column]))) });
  }
  const sequenceExists = (await connection.execute("SELECT name FROM sqlite_master WHERE name='sqlite_sequence'")).rows.length;
  if (sequenceExists) {
    const result = await connection.execute("SELECT * FROM sqlite_sequence");
    tables.push({ name: "sqlite_sequence", columns: result.columns, rows: result.rows.map(row => result.columns.map(column => encode(row[column]))) });
  }
  return { at: new Date().toISOString(), schema: schema.map(row => ({ type: row.type, name: row.name, sql: row.sql })), tables };
}

async function latestMigration(connection) {
  const row = (await connection.execute("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1")).rows[0];
  const migration = migrations.find(entry => entry.when === Number(row?.created_at));
  if (!migration || migration.hash !== row.hash) throw new Error("Migração remota ou hash inesperado. Nenhuma alteração autorizada.");
  return migration;
}

async function validateNewSchema(connection) {
  if (fulfillmentOnly) {
    await verifyFulfillmentSchema(connection);
  } else if (paymentsOnly) {
    const columns = (await connection.execute("PRAGMA table_info(orders)")).rows;
    if (!columns.some(row => row.name === "checkout_mode" && row.type === "TEXT" && Number(row.notnull) === 1 && row.dflt_value === "'redirect'") ||
        !columns.some(row => row.name === "payment_expires_at" && row.type === "TEXT" && Number(row.notnull) === 0)) throw new Error("Colunas de pagamento inválidas.");
    const attempts = (await connection.execute("PRAGMA table_info(payment_attempts)")).rows;
    if (!["id", "order_id", "method", "status", "provider_payment_id", "request_payload", "device_id", "result", "provider_updated_at", "created_at", "updated_at"].every(name => attempts.some(row => row.name === name && row.type === "TEXT"))) throw new Error("Tabela de tentativas inválida.");
    const indexes = (await connection.execute("PRAGMA index_list(payment_attempts)")).rows;
    if (!indexes.some(row => row.name === "payment_attempts_order_idx") || !indexes.some(row => row.name === "payment_attempts_provider_unique" && Number(row.unique) === 1)) throw new Error("Índices de pagamento inválidos.");
    const references = (await connection.execute("PRAGMA foreign_key_list(payment_attempts)")).rows;
    if (!references.some(row => row.table === "orders" && row.from === "order_id" && row.to === "id" && row.on_delete === "CASCADE")) throw new Error("Referência de pagamento inválida.");
  } else if (contactOnly) {
    const columns = (await connection.execute("PRAGMA table_info(store_user)")).rows;
    if (!columns.some(row => row.name === "phone" && row.type === "TEXT" && Number(row.notnull) === 0)) throw new Error("Coluna de telefone inválida.");
  } else {
  const products = (await connection.execute("SELECT store_id, storefront FROM catalog_products WHERE store_id IS NOT NULL")).rows;
  if (products.length !== 6 || products.some(row => !JSON.parse(row.storefront).variants.length)) throw new Error("Catálogo unificado inválido.");
  const indexes = (await connection.execute("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'customer_addresses_%'")).rows;
  if (indexes.length !== 3) throw new Error("Índices de endereços inválidos.");
  }
  const violations = (await connection.execute("PRAGMA foreign_key_check")).rows;
  if (violations.length) throw new Error("Integridade referencial inválida.");
}

async function applyPending(connection, latest) {
  const target = migrations.find(entry => entry.tag === pendingTags.at(-1));
  const pending = migrations.filter(entry => entry.idx > latest.idx && entry.idx <= target.idx);
  if (JSON.stringify(pending.map(entry => entry.tag)) !== JSON.stringify(pendingTags)) throw new Error("Lista de migrações pendentes inesperada.");
  for (const migration of pending) {
    const statements = migration.sql.split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean);
    await connection.batch([...statements, { sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", args: [migration.hash, migration.when] }]);
    console.log(`Validada: ${migration.tag}`);
  }
}

let readTx;
let writeTx;
let rehearsal;
let stage = "read remote snapshot";
try {
  readTx = await client.transaction("read");
  const latest = await latestMigration(readTx);
  if (latest.tag === pendingTags.at(-1)) {
    await validateNewSchema(readTx);
    await readTx.rollback();
    console.log("Migrações solicitadas já aplicadas; nenhuma alteração.");
    process.exitCode = 0;
  } else {
    if (latest.tag !== baselineTag) throw new Error(`O banco não está na migração ${baselineTag} esperada.`);
    const source = await snapshot(readTx);
    await readTx.rollback();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    stage = "encrypt backup";
    const backupDir = path.resolve("backups");
    const keyDir = path.join(homedir(), ".codex", "backup-keys", "artgian-studio");
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    await mkdir(keyDir, { recursive: true, mode: 0o700 });
    await chmod(keyDir, 0o700);
    const backupPath = path.join(backupDir, `store-before-migrations-${stamp}.json.aes`);
    const keyPath = path.join(keyDir, `store-before-migrations-${stamp}.key`);
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(source), "utf8"), cipher.final()]);
    await writeFile(keyPath, key, { mode: 0o600, flag: "wx" });
    await writeFile(backupPath, Buffer.concat([Buffer.from("ARTGIAN1"), iv, cipher.getAuthTag(), ciphertext]), { mode: 0o600, flag: "wx" });
    const saved = await readFile(backupPath);
    if (saved.subarray(0, 8).toString() !== "ARTGIAN1") throw new Error("Formato do backup inválido.");
    const decipher = createDecipheriv("aes-256-gcm", await readFile(keyPath), saved.subarray(8, 20));
    decipher.setAuthTag(saved.subarray(20, 36));
    const restored = JSON.parse(Buffer.concat([decipher.update(saved.subarray(36)), decipher.final()]).toString("utf8"));
    stage = "restore local snapshot";
    rehearsal = createClient({ url: "file::memory:", intMode: "bigint" });
    // Restore related tables in schema order, then check all foreign keys.
    await rehearsal.execute("PRAGMA foreign_keys = OFF");
    for (const entry of restored.schema.filter(row => row.type === "table")) await rehearsal.execute(entry.sql);
    for (const table of restored.tables) {
      if (table.name === "sqlite_sequence") await rehearsal.execute("DELETE FROM sqlite_sequence");
      for (const row of table.rows) await rehearsal.execute({ sql: `INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(",")}) VALUES (${row.map(() => "?").join(",")})`, args: row.map(decode) });
    }
    for (const entry of restored.schema.filter(row => row.type !== "table")) await rehearsal.execute(entry.sql);
    await rehearsal.execute("PRAGMA foreign_keys = ON");
    const verified = await snapshot(rehearsal);
    for (const table of restored.tables) {
      const actual = verified.tables.find(item => item.name === table.name);
      if (!actual || JSON.stringify(sortedRows(actual.rows)) !== JSON.stringify(sortedRows(table.rows))) throw new Error(`Restauração falhou: ${table.name}`);
    }
    stage = "rehearse migrations locally";
    await applyPending(rehearsal, latest);
    await validateNewSchema(rehearsal);
    console.log(`Backup criptografado e restauração local verificados: ${backupPath}`);
    console.log(`Chave de recuperação (fora do repositório): ${keyPath}`);
    console.log(`Snapshot: ${restored.tables.length} tabelas, ${restored.tables.reduce((count, table) => count + table.rows.length, 0)} registros.`);
    if (!process.argv.includes("--apply")) {
      console.log("Ensaio concluído. Use --apply para alterar o banco remoto.");
    } else {
      writeTx = await client.transaction("write");
      stage = "apply remote migrations";
      const current = await latestMigration(writeTx);
      if (current.tag !== latest.tag) throw new Error("O banco mudou durante o backup.");
      const before = await snapshot(writeTx);
      await applyPending(writeTx, current);
      await validateNewSchema(writeTx);
      // Compare original columns, not newly added columns or catalog migration data.
      const excluded = contactOnly || paymentsOnly || fulfillmentOnly ? ["__drizzle_migrations", "sqlite_sequence"] : ["__drizzle_migrations", "catalog_products", "sqlite_sequence"];
      const originalTables = before.tables.filter(row => !excluded.includes(row.name));
      const originalResults = await writeTx.batch(originalTables.map(table => `SELECT ${table.columns.map(quote).join(",")} FROM ${quote(table.name)}`));
      for (const [index, table] of originalTables.entries()) {
        const rows = originalResults[index].rows;
        const after = rows.map(row => table.columns.map(column => encode(row[column])));
        if (JSON.stringify(sortedRows(after)) !== JSON.stringify(sortedRows(table.rows))) throw new Error(`Registros alterados inesperadamente: ${table.name}`);
      }
      const result = (await writeTx.execute("PRAGMA integrity_check")).rows;
      if (result.length !== 1 || result[0].integrity_check !== "ok") throw new Error("Falha na verificação de integridade.");
      await writeTx.commit();
      console.log("Migrações remotas aplicadas atomicamente. Dados anteriores e integridade preservados.");
    }
  }
} catch (error) {
  await writeTx?.rollback().catch(() => {});
  await readTx?.rollback().catch(() => {});
  // Do not emit URLs, credentials or database records in errors.
  console.error(error instanceof Error && !error.code ? error.message : `Falha no backup/migração (${stage}, ${error.code || "unknown"}); nenhuma transação pendente foi confirmada.`);
  process.exitCode = 1;
} finally {
  readTx?.close();
  writeTx?.close();
  rehearsal?.close();
  client.close();
}
