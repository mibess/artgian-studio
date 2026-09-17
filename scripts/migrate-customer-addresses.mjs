import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const envFile = process.argv.find(arg => arg.startsWith("--env="))?.slice(6);
if (!envFile && !process.argv.includes("--runtime-env")) throw new Error("Informe --env=/caminho/seguro.env ou --runtime-env.");
const env = envFile ? parseEnv(readFileSync(envFile, "utf8")) : process.env;
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN || env.TURSO_AUTH_TOKEN === "[SENSITIVE]")
  throw new Error("Credenciais do banco ausentes.");
const entries = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries;
const migration = entries.find(entry => entry.tag === "0017_gorgeous_talon");
const previous = entries.find(entry => entry.idx === migration.idx - 1);
const sql = readFileSync(`drizzle/${migration.tag}.sql`, "utf8");
const hash = createHash("sha256").update(sql).digest("hex");
const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
const tx = await client.transaction("write");
try {
  const latest = (await tx.execute("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1")).rows[0];
  if (Number(latest?.created_at) === migration.when) {
    if (latest.hash !== hash) throw new Error("A migração já aplicada possui outro conteúdo.");
    await tx.rollback();
    console.log("Migração já aplicada; nenhuma alteração.");
  } else {
    const previousHash = createHash("sha256").update(readFileSync(`drizzle/${previous.tag}.sql`, "utf8")).digest("hex");
    if (Number(latest?.created_at) !== previous.when || latest.hash !== previousHash)
      throw new Error("O banco não está na migração anterior esperada. Nenhuma alteração realizada.");
    const counts = async () => (await tx.execute("SELECT (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM store_user) AS users")).rows[0];
    const before = await counts();
    console.log("Migração anterior e hash confirmados. Alteração aditiva: uma tabela e três índices.");
    if (!process.argv.includes("--apply")) {
      await tx.rollback();
      console.log("Verificação concluída. Use --apply para executar a migração aditiva.");
    } else {
      for (const statement of sql.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) await tx.execute(statement);
      await tx.execute({ sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", args: [hash, migration.when] });
      const after = await counts();
      if (String(before.orders) !== String(after.orders) || String(before.users) !== String(after.users)) throw new Error("A contagem de pedidos ou usuários mudou.");
      const indexes = (await tx.execute("SELECT count(*) AS total FROM sqlite_master WHERE type='index' AND name LIKE 'customer_addresses_%'")).rows[0];
      if (Number(indexes.total) !== 3) throw new Error("Validação dos índices falhou.");
      await tx.commit();
      console.log("Migração aplicada. Usuários e pedidos preservados; três índices verificados.");
    }
  }
} catch (error) {
  await tx.rollback().catch(() => {});
  throw error;
} finally {
  tx.close();
  client.close();
}
