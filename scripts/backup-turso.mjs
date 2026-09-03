import { spawn } from "node:child_process";
import { mkdir, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";

const databaseName = process.env.TURSO_BACKUP_DATABASE_NAME?.trim();
const recipient = process.env.BACKUP_AGE_RECIPIENT?.trim();
if (!databaseName || !recipient) {
  throw new Error(
    "Configure TURSO_BACKUP_DATABASE_NAME e BACKUP_AGE_RECIPIENT antes do backup.",
  );
}

await mkdir(path.join(process.cwd(), "backups"), { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(process.cwd(), "backups", `${databaseName}-${timestamp}.sql.age`);
const dump = spawn("turso", ["db", "shell", databaseName, ".dump"], {
  stdio: ["ignore", "pipe", "inherit"],
});
const encrypt = spawn("age", ["-r", recipient], {
  stdio: ["pipe", "pipe", "inherit"],
});
const output = createWriteStream(target, { mode: 0o600 });
dump.stdout.pipe(encrypt.stdin);
encrypt.stdout.pipe(output);
const outputFinished = new Promise((resolve, reject) => {
  output.once("finish", resolve);
  output.once("error", reject);
});

const waitForExit = (child) =>
  new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Processo encerrou com código ${code}`)),
    );
  });

try {
  await Promise.all([waitForExit(dump), waitForExit(encrypt), outputFinished]);
  console.log(`Backup criptografado criado em ${target}`);
} catch (error) {
  output.destroy();
  await unlink(target).catch(() => undefined);
  throw error;
}
