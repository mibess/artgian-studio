import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL || "file:./data/artgian.db";
if (!databaseUrl.startsWith("file:")) {
  throw new Error("O backup local só aceita DATABASE_URL com prefixo file:.");
}
const source = path.resolve(process.cwd(), databaseUrl.slice("file:".length));
const backupDirectory = path.join(process.cwd(), "backups");
await mkdir(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = path.join(backupDirectory, `artgian-${stamp}.db`);
await copyFile(source, destination);
console.log(`Backup criado em ${destination}`);
