import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyStoreSchema } from "../scripts/verify-store-schema.mjs";

let client: Client;
let directory: string;
async function fixture() {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-schema-test-"));
  client = createClient({ url: `file:${directory}/test.db` });
  const { entries } = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  const previous = entries.find((entry: { idx: number }) => entry.idx === 17);
  const hash = createHash("sha256").update(await readFile(`drizzle/${previous.tag}.sql`)).digest("hex");
  await client.execute("CREATE TABLE __drizzle_migrations (hash TEXT, created_at INTEGER)");
  await client.execute({ sql: "INSERT INTO __drizzle_migrations VALUES (?, ?)", args: [hash, previous.when] });
  await client.execute("CREATE TABLE store_user (id TEXT PRIMARY KEY, name TEXT, email TEXT)");
  await client.execute("INSERT INTO store_user VALUES ('customer', 'Cliente Teste', 'test@example.com')");
}
afterEach(async () => {
  client?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe("deployment database schema gate", () => {
  it("blocks deployment against the previous schema without changing it", async () => {
    await fixture();
    await expect(verifyStoreSchema(client)).rejects.toThrow("Banco desatualizado");
    expect((await client.execute("PRAGMA table_info(store_user)")).rows.map(row => row.name)).not.toContain("phone");
  });
  it("applies only the contact migration, preserves customer data and is idempotent", async () => {
    await fixture();
    await verifyStoreSchema(client, { applyContact: true });
    await verifyStoreSchema(client);
    await verifyStoreSchema(client, { applyContact: true });
    expect((await client.execute("SELECT * FROM store_user")).rows).toEqual([{ id: "customer", name: "Cliente Teste", email: "test@example.com", phone: null }]);
    expect((await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count).toBe(2);
  });
  it("refuses an unexpected migration hash even with explicit repair enabled", async () => {
    await fixture();
    await client.execute("UPDATE __drizzle_migrations SET hash = 'unexpected'");
    await expect(verifyStoreSchema(client, { applyContact: true })).rejects.toThrow("migração divergente");
    expect((await client.execute("PRAGMA table_info(store_user)")).rows.map(row => row.name)).not.toContain("phone");
  });
  it("checks the physical column even when the migration journal is current", async () => {
    await fixture();
    await verifyStoreSchema(client, { applyContact: true });
    await client.execute("ALTER TABLE store_user DROP COLUMN phone");
    await expect(verifyStoreSchema(client)).rejects.toThrow("coluna de telefone");
  });
});
