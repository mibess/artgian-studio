import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { notifyOutbox } from "../../db/schema";
import { retryTransaction } from "../checkout-orders";
import { notifyEnabled, notifyPublisherConfig, notifyTargetOrigin } from "./config";

export const NOTIFY_MAX_ATTEMPTS = 10;
export const NOTIFY_LEASE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
type Publication = typeof notifyOutbox.$inferSelect;
const acceptedResponse = z.object({ eventId: z.uuid(), status: z.literal("ACCEPTED"), duplicate: z.boolean() });

function log(row: Publication) {
  console.info("[mibess-notify]", {
    id: row.id, idempotencyKey: row.idempotencyKey, correlationId: row.correlationId,
    eventId: row.notifyEventId, attempt: row.attempts, status: row.status, error: row.lastError,
  });
}

export async function claimNotifyEvent(now = new Date()) {
  const db = await getDb();
  const at = now.toISOString();
  const targetOrigin = notifyTargetOrigin();
  return retryTransaction(() => db.transaction(async tx => {
    // A crash on the last permitted attempt must also reach recoverable failure.
    const abandoned = await tx.update(notifyOutbox).set({ status: "failed", lastError: "attempts_exhausted_after_interruption", leaseToken: null, leaseExpiresAt: null, nextAttemptAt: null, updatedAt: at })
      .where(sql`${notifyOutbox.targetOrigin} = ${targetOrigin} AND ${notifyOutbox.status} = 'publishing' AND ${notifyOutbox.leaseExpiresAt} <= ${at} AND ${notifyOutbox.cycleAttempts} >= ${NOTIFY_MAX_ATTEMPTS}`).returning();
    const [row] = await tx.update(notifyOutbox).set({
      status: "publishing", leaseToken: crypto.randomUUID(), leaseExpiresAt: new Date(now.getTime() + NOTIFY_LEASE_MS).toISOString(),
      attempts: sql`${notifyOutbox.attempts} + 1`, cycleAttempts: sql`${notifyOutbox.cycleAttempts} + 1`, lastAttemptAt: at, updatedAt: at,
    }).where(sql`${notifyOutbox.id} = (
      SELECT id FROM notify_outbox WHERE target_origin = ${targetOrigin} AND cycle_attempts < ${NOTIFY_MAX_ATTEMPTS}
      AND ((status = 'pending' AND next_attempt_at <= ${at}) OR (status = 'publishing' AND lease_expires_at <= ${at}))
      ORDER BY created_at, id LIMIT 1
    )`).returning();
    return { row, abandoned };
  }, { behavior: "immediate" })).then(({ row, abandoned }) => { abandoned.forEach(log); if (row) log(row); return row; });
}

function retryAfter(value: string | null, now: number) {
  if (!value) return 0;
  const milliseconds = /^\d+$/.test(value.trim()) ? Number(value) * 1_000 : Date.parse(value) - now;
  // Reject nonsensical/out-of-range dates without turning a provider header into an exception.
  return Number.isFinite(milliseconds) && milliseconds > 0 && now + milliseconds <= 253402300799999 ? milliseconds : 0;
}

async function readSmallJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_response");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8_192) throw new Error("oversized_response");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); }
}

async function publish(row: Publication, config: NonNullable<ReturnType<typeof notifyPublisherConfig>>) {
  let eventId: string | null = null;
  let error: string | null = null;
  let permanent = false;
  let minimumDelay = 0;
  // Abort covers the response body too; no network operations run inside a DB transaction.
  try {
    const response = await fetch(`${config.targetOrigin}/api/v1/events`, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey, "Idempotency-Key": row.idempotencyKey },
      body: row.payload,
    });
    minimumDelay = retryAfter(response.headers.get("retry-after"), Date.now());
    if (response.status === 202) {
      try {
        const parsed = acceptedResponse.safeParse(await readSmallJson(response));
        if (parsed.success) eventId = parsed.data.eventId;
        else error = "invalid_acceptance_response";
      } catch { error = "invalid_acceptance_response"; }
    } else {
      await response.body?.cancel().catch(() => {});
      permanent = ![408, 429].includes(response.status) && response.status < 500;
      error = ({ 400: "contract_error", 401: "credentials_rejected", 403: "permission_denied", 409: "idempotency_conflict" } as Record<number, string>)[response.status] ?? `http_${response.status}`;
    }
  } catch { error = "network_or_timeout"; }
  const now = new Date();
  const failed = !eventId && (permanent || row.cycleAttempts >= NOTIFY_MAX_ATTEMPTS);
  const delay = Math.max(minimumDelay, Math.min(60 * 60_000, 30_000 * 2 ** (row.cycleAttempts - 1)) * (0.75 + Math.random() * 0.5));
  const db = await getDb();
  const [updated] = await retryTransaction(() => db.update(notifyOutbox).set({
    status: eventId ? "accepted" : failed ? "failed" : "pending", notifyEventId: eventId,
    lastError: error, acceptedAt: eventId ? now.toISOString() : null,
    nextAttemptAt: eventId || failed ? null : new Date(now.getTime() + delay).toISOString(),
    leaseToken: null, leaseExpiresAt: null, updatedAt: now.toISOString(),
  }).where(and(eq(notifyOutbox.id, row.id), eq(notifyOutbox.status, "publishing"), eq(notifyOutbox.leaseToken, row.leaseToken!))).returning());
  // A recovered worker owns the result; a stale worker may never overwrite it.
  if (updated) log(updated);
}

export async function runNotifyBatch(limit = 4) {
  if (!notifyEnabled()) return { status: "disabled", processed: 0 };
  const config = notifyPublisherConfig();
  if (!config) {
    console.error("[mibess-notify] configuration_missing_or_environment_mismatch");
    return { status: "configuration_error", processed: 0 };
  }
  let processed = 0;
  const started = Date.now();
  while (processed < Math.min(4, limit) && Date.now() - started < 35_000 && notifyEnabled()) {
    const row = await claimNotifyEvent();
    if (!row) break;
    await publish(row, config);
    processed++;
  }
  return { status: "completed", processed };
}

// Operator-only CLI: no new keys, snapshots, or retries of already accepted events.
export async function requeueNotifyEvent(id: string) {
  const db = await getDb();
  const now = new Date().toISOString();
  const [row] = await db.update(notifyOutbox).set({ status: "pending", cycleAttempts: 0, nextAttemptAt: now, updatedAt: now })
    .where(and(eq(notifyOutbox.id, id), eq(notifyOutbox.status, "failed"), eq(notifyOutbox.targetOrigin, notifyTargetOrigin()))).returning();
  if (row) log(row);
  return Boolean(row);
}
