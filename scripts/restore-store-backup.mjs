import { createClient } from "@libsql/client";
import { createDecipheriv } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import path from "node:path";

const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const backup = option("backup");
const key = option("key");
const output = option("output");
if (!backup || !key) throw new Error("Informe --backup=/arquivo.json.aes e --key=/arquivo.key. Sem --output, apenas verifica em memória.");
const saved = await readFile(backup);
if (saved.subarray(0, 8).toString() !== "ARTGIAN1") throw new Error("Formato de backup inválido.");
const decipher = createDecipheriv("aes-256-gcm", await readFile(key), saved.subarray(8, 20));
decipher.setAuthTag(saved.subarray(20, 36));
const snapshot = JSON.parse(Buffer.concat([decipher.update(saved.subarray(36)), decipher.final()]).toString("utf8"));
const quote = name => `"${name.replaceAll('"', '""')}"`;
const decode = value => value?.type === "bigint" ? BigInt(value.value) : value?.type === "blob" ? Buffer.from(value.value, "base64") : value;
let url = "file::memory:";
if (output) {
  const destination = path.resolve(output);
  // Never overwrite an existing database or create a readable plaintext backup.
  const file = await open(destination, "wx", 0o600);
  await file.close();
  url = `file:${destination}`;
}
const client = createClient({ url, intMode: "bigint" });
try {
  await client.execute("PRAGMA foreign_keys = OFF");
  for (const entry of snapshot.schema.filter(row => row.type === "table")) await client.execute(entry.sql);
  for (const table of snapshot.tables) {
    if (table.name === "sqlite_sequence") await client.execute("DELETE FROM sqlite_sequence");
    for (const row of table.rows) await client.execute({ sql: `INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(",")}) VALUES (${row.map(() => "?").join(",")})`, args: row.map(decode) });
  }
  for (const entry of snapshot.schema.filter(row => row.type !== "table")) await client.execute(entry.sql);
  await client.execute("PRAGMA foreign_keys = ON");
  const integrity = (await client.execute("PRAGMA integrity_check")).rows;
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok" || (await client.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("A restauração não passou na verificação de integridade.");
  for (const table of snapshot.tables) {
    const count = (await client.execute(`SELECT count(*) AS total FROM ${quote(table.name)}`)).rows[0].total;
    if (Number(count) !== table.rows.length) throw new Error("A contagem de registros não corresponde ao backup.");
  }
  console.log(`Backup autenticado e restauração verificada: ${snapshot.tables.length} tabelas. ${output ? "Arquivo local criado; o banco remoto não foi alterado." : "Ensaio apenas em memória; nenhum banco foi alterado."}`);
} finally {
  client.close();
}
