import { createClient, type Client } from "@libsql/client";
import { generateKeyPairSync, privateDecrypt, createDecipheriv, createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, expect, it } from "vitest";

let directory: string;
let client: Client;
const keys = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-remove-test-"));
  client = createClient({ url: `file:${directory}/test.db` });
  await client.execute("CREATE TABLE orders (id TEXT PRIMARY KEY, user_id TEXT, status TEXT, total_cents INTEGER, mercado_pago_payment_id TEXT, mercado_pago_status TEXT, coupon_id TEXT, discount_cents INTEGER, shipping_label_id TEXT, shipping_tracking_code TEXT, mercado_pago_preference_id TEXT)");
  await client.execute("CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id TEXT, product_id TEXT)");
  await client.execute("CREATE TABLE payment_events (order_id TEXT)");
  for (const [index, prefix] of ["af614521", "2d4481d6"].entries()) {
    await client.execute({ sql: "INSERT INTO orders (id,user_id,status,total_cents,discount_cents,mercado_pago_preference_id) VALUES (?, 'customer', 'pending', 7718, 0, ?)", args: [`${prefix}-test`, `preference-${index}`] });
    await client.execute({ sql: "INSERT INTO order_items VALUES (?, ?, 'product')", args: [index + 1, `${prefix}-test`] });
  }
});
afterEach(async () => { client.close(); await rm(directory, { recursive: true, force: true }); });
function run(mode: string, digest = "") {
  return spawnSync(process.execPath, ["--import", "./tests/fixtures/duplicate-payment-provider.mjs", "scripts/remove-checkout-duplicate.mjs"], {
    encoding: "utf8", timeout: 10000,
    env: { ...process.env, TURSO_DATABASE_URL: `file:${directory}/test.db`, TURSO_AUTH_TOKEN: "", MERCADO_PAGO_ACCESS_TOKEN: "test", DUPLICATE_OPERATION: mode, DUPLICATE_BACKUP_DIGEST: digest, DUPLICATE_BACKUP_PUBLIC_KEY: Buffer.from(keys.publicKey).toString("base64") },
  });
}
it("backs up both orders, verifies decryption and removes only the authorized duplicate", async () => {
  const backup = run("backup");
  expect(backup.status, backup.stderr).toBe(0);
  const encoded = [...backup.stdout.matchAll(/DUPLICATE_BACKUP_CHUNK \d+\/\d+ ([A-Za-z0-9+/=]+)/g)].map(match => match[1]).join("");
  const envelope = JSON.parse(Buffer.from(encoded, "base64").toString());
  const key = privateDecrypt({ key: keys.privateKey, oaepHash: "sha256" }, Buffer.from(envelope.key, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
  expect(createHash("sha256").update(plaintext).digest("hex")).toBe(envelope.digest);
  expect(JSON.parse(plaintext.toString()).duplicate.id).toBe("2d4481d6-test");
  expect((await client.execute("SELECT * FROM orders")).rows).toHaveLength(2);
  const remove = run("remove", envelope.digest);
  expect(remove.status, remove.stderr).toBe(0);
  expect(remove.stdout).toContain("DUPLICATE_REMOVED");
  expect((await client.execute("SELECT id FROM orders")).rows).toEqual([{ id: "af614521-test" }]);
  expect((await client.execute("SELECT order_id FROM order_items")).rows).toEqual([{ order_id: "af614521-test" }]);
});
it.each(["UPDATE orders SET status='paid' WHERE id='2d4481d6-test'", "UPDATE orders SET total_cents=9000 WHERE id='2d4481d6-test'", "INSERT INTO payment_events VALUES ('2d4481d6-test')"])("refuses unsafe deletion: %s", async sql => {
  await client.execute(sql);
  expect(run("remove", "wrong").status).not.toBe(0);
  expect((await client.execute("SELECT * FROM orders")).rows).toHaveLength(2);
});
it("refuses deletion without a matching verified backup", async () => {
  expect(run("remove", "wrong").status).not.toBe(0);
  expect((await client.execute("SELECT * FROM orders")).rows).toHaveLength(2);
});
