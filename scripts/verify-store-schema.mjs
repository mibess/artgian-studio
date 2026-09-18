import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const digest = value => createHash("sha256").update(value).digest("hex");

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
