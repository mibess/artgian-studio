import { createClient } from "@libsql/client";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import path from "node:path";

const database = "artgian-prod";
const target = { readyToShip: false, preparationDays: 5 };

/** One-off fulfillment update authorized by the owner on 2026-11-17. */
export async function setCatalogPreparation(client, {
  apply = false,
  expectedCount = 10,
  backupDirectory = path.resolve("backups"),
} = {}) {
  const tx = await client.transaction(apply ? "write" : "read");
  try {
    const before = (await tx.execute("SELECT * FROM catalog_products ORDER BY id")).rows;
    if (before.length !== expectedCount || before.some(row => !row.storefront)) {
      throw new Error("O catálogo mudou ou possui produtos sem apresentação. Revise antes de aplicar.");
    }
    const pending = before.filter(row => {
      const store = JSON.parse(String(row.storefront));
      if (!store || typeof store !== "object" || Array.isArray(store)) throw new Error("Apresentação inválida.");
      return !isDeepStrictEqual(store.fulfillment, target);
    });
    const result = { database, apply, target, products: before.length, pending: pending.length };
    if (!apply || !pending.length) {
      await tx.rollback();
      return result;
    }

    const runId = randomUUID();
    const now = new Date().toISOString();
    const backup = path.join(backupDirectory, `catalog-preparation-${now.replace(/[:.]/g, "-")}-${runId}.json`);
    // This snapshot contains only product identity and changed fields: no tokens,
    // customer data, prices, images or unrelated catalog content.
    const snapshot = {
      database,
      runId,
      createdAt: now,
      target,
      products: pending.map(row => {
        const store = JSON.parse(String(row.storefront));
        return {
          id: row.id,
          name: row.name,
          before: {
            version: row.version,
            updatedAt: row.updated_at,
            hadFulfillment: Object.hasOwn(store, "fulfillment"),
            fulfillment: store.fulfillment ?? null,
          },
          after: { version: Number(row.version) + 1, updatedAt: now, fulfillment: target },
        };
      }),
      rollback: "Restore only storefront.fulfillment (remove the key when hadFulfillment=false), preserve other fields, increment version and record a new audit entry. Require the current version and fulfillment to match this snapshot's after state before restoring; a snapshot alone does not prove commit succeeded.",
    };
    await mkdir(backupDirectory, { recursive: true });
    await writeFile(backup, JSON.stringify(snapshot, null, 2) + "\n", { mode: 0o600, flag: "wx" });

    for (const row of pending) {
      const changed = await tx.execute({
        sql: "UPDATE catalog_products SET storefront=json_set(storefront,'$.fulfillment',json(?)),version=version+1,updated_at=? WHERE id=? AND version=? AND storefront=?",
        args: [JSON.stringify(target), now, row.id, row.version, row.storefront],
      });
      if (changed.rowsAffected !== 1) throw new Error("Edição concorrente detectada; atualização cancelada.");
      await tx.execute({
        sql: "INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,metadata,created_at) VALUES (?,?,?,?,?,?,?)",
        args: [randomUUID(), "admin:codex", "product_updated", "product", row.id,
          JSON.stringify({ runId, fields: ["storefront.fulfillment"], version: Number(row.version) + 1,
            previousFulfillment: JSON.parse(String(row.storefront)).fulfillment ?? null,
            fulfillment: target, reason: "Prazo inicial de 5 dias úteis para todos os produtos, conforme solicitação do responsável em 17/11/2026." }), now],
      });
    }

    const after = (await tx.execute("SELECT * FROM catalog_products ORDER BY id")).rows;
    if (after.length !== before.length) throw new Error("A contagem do catálogo mudou.");
    const changedIds = new Set(pending.map(row => row.id));
    for (let index = 0; index < before.length; index++) {
      const original = before[index];
      const expected = { ...original };
      const originalStore = JSON.parse(String(original.storefront));
      if (changedIds.has(original.id)) {
        expected.version = Number(original.version) + 1;
        expected.updated_at = now;
        originalStore.fulfillment = target;
      }
      const actual = { ...after[index] };
      const actualStore = JSON.parse(String(actual.storefront));
      delete expected.storefront;
      delete actual.storefront;
      if (!isDeepStrictEqual(expected, actual) || !isDeepStrictEqual(originalStore, actualStore)) {
        throw new Error("A validação encontrou uma alteração fora do prazo autorizado; atualização cancelada.");
      }
    }
    await tx.commit();
    return { ...result, committed: true, changed: pending.length, runId, backup };
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  } finally {
    tx.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const apply = process.argv.includes("--apply");
  if (process.argv.slice(2).some(argument => argument !== "--apply")) throw new Error("Use sem argumentos para conferir ou --apply para aplicar.");
  const url = execFileSync("turso", ["db", "show", database, "--url"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  // Keep the short-lived token only in process memory, never in args or files.
  const tokenArgs = ["db", "tokens", "create", database, "--expiration", "1d",
    ...(apply ? ["--permissions", "catalog_products:data_read,data_update", "--permissions", "audit_logs:data_insert"] : ["--read-only"])];
  const authToken = execFileSync("turso", tokenArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const client = createClient({ url, authToken });
  try {
    console.log(JSON.stringify(await setCatalogPreparation(client, { apply }), null, 2));
  } finally {
    client.close();
  }
}
