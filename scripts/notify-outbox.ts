// This CLI deliberately does not auto-load .env.local. Supply one environment
// explicitly using Node's --env-file; access requires that environment's DB credentials.
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { notifyOutbox } from "../db/schema";
import { notifyTargetOrigin } from "../lib/mibess-notify/config";
import { requeueNotifyEvent, runNotifyBatch } from "../lib/mibess-notify/publisher";

const [command, id] = process.argv.slice(2);
try {
  if (command === "run") console.log(await runNotifyBatch());
  else if (command === "retry" && id) {
    if (!await requeueNotifyEvent(id)) throw new Error("Registro não está em falha recuperável neste ambiente.");
  } else if (command === "list") {
    const rows = await (await getDb()).select({
      id: notifyOutbox.id, key: notifyOutbox.idempotencyKey, correlationId: notifyOutbox.correlationId,
      type: notifyOutbox.type, status: notifyOutbox.status, attempts: notifyOutbox.attempts, nextAttemptAt: notifyOutbox.nextAttemptAt,
      lastError: notifyOutbox.lastError, eventId: notifyOutbox.notifyEventId, updatedAt: notifyOutbox.updatedAt,
    }).from(notifyOutbox).where(eq(notifyOutbox.targetOrigin, notifyTargetOrigin())).orderBy(desc(notifyOutbox.createdAt)).limit(100);
    console.table(rows);
  } else throw new Error("Uso: notify-outbox.ts list | run | retry <id-local>");
} catch {
  console.error("Falha na operação da outbox. Confira comando, ID, ambiente, acesso ao banco e migração; nenhum segredo é registrado.");
  process.exitCode = 1;
}
