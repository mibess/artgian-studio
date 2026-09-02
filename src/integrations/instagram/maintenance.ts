import { and, eq, isNull, lt, or } from "drizzle-orm";
import { auditLogs, integrationStates } from "../../../db/schema";
import { getCommercialDb } from "../../db/commercial";
import { syncInstagramConversations } from "./sync";
import {
  getInstagramAccessToken,
  getInstagramIntegrationState,
  refreshInstagramAccessToken,
  saveInstagramAccessToken,
  shouldRefreshInstagramToken,
} from "./token-store";

const INTEGRATION_KEY = "instagram";
const LOCK_DURATION_MS = 5 * 60 * 1_000;

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha desconhecida.";
  return message.replace(/[A-Za-z0-9_-]{80,}/g, "[segredo ocultado]").slice(0, 500);
}

async function acquireMaintenanceLock(now: Date) {
  const db = await getCommercialDb();
  const nowIso = now.toISOString();
  await db
    .insert(integrationStates)
    .values({ key: INTEGRATION_KEY, status: "unknown", updatedAt: nowIso })
    .onConflictDoNothing();
  const claimed = await db
    .update(integrationStates)
    .set({
      lockUntil: new Date(now.getTime() + LOCK_DURATION_MS).toISOString(),
      lastRunStartedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(
      and(
        eq(integrationStates.key, INTEGRATION_KEY),
        or(
          isNull(integrationStates.lockUntil),
          lt(integrationStates.lockUntil, nowIso),
        ),
      ),
    )
    .returning({ key: integrationStates.key });
  return claimed.length > 0;
}

async function releaseMaintenanceLock() {
  const db = await getCommercialDb();
  await db
    .update(integrationStates)
    .set({ lockUntil: null, updatedAt: new Date().toISOString() })
    .where(eq(integrationStates.key, INTEGRATION_KEY));
}

export async function runInstagramMaintenance() {
  const startedAt = new Date();
  if (!(await acquireMaintenanceLock(startedAt))) {
    return { status: "locked" as const };
  }

  const db = await getCommercialDb();
  try {
    let state = await getInstagramIntegrationState();
    let accessToken = await getInstagramAccessToken();
    if (!state?.encryptedAccessToken) {
      await saveInstagramAccessToken({ accessToken });
      state = await getInstagramIntegrationState();
    }

    let tokenRefreshed = false;
    let refreshWarning: string | null = null;
    if (shouldRefreshInstagramToken(state, startedAt)) {
      try {
        const refreshed = await refreshInstagramAccessToken(accessToken);
        accessToken = refreshed.accessToken;
        tokenRefreshed = true;
      } catch (error) {
        refreshWarning = safeError(error);
      }
    }

    const previousSync = state?.lastSuccessfulSyncAt
      ? Date.parse(state.lastSuccessfulSyncAt)
      : Number.NaN;
    const since = new Date(
      Number.isFinite(previousSync)
        ? previousSync - 60 * 60 * 1_000
        : startedAt.getTime() - 48 * 60 * 60 * 1_000,
    );
    const sync = await syncInstagramConversations({ since, accessToken });
    const finishedAt = new Date().toISOString();
    const publicSync = {
      inspectedConversations: sync.inspectedConversations,
      inspectedMessages: sync.inspectedMessages,
      recoveredMessages: sync.recoveredMessages,
      duplicateMessages: sync.duplicateMessages,
    };
    await db.transaction(async (tx) => {
      await tx
        .update(integrationStates)
        .set({
          status: refreshWarning ? "warning" : "healthy",
          lastHealthCheckAt: finishedAt,
          lastSuccessfulSyncAt: finishedAt,
          lastError: refreshWarning,
          metadata: JSON.stringify({ ...publicSync, tokenRefreshed }),
          updatedAt: finishedAt,
        })
        .where(eq(integrationStates.key, INTEGRATION_KEY));
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "system",
        action: "instagram_maintenance_completed",
        entityType: "integration",
        entityId: INTEGRATION_KEY,
        metadata: JSON.stringify({ ...publicSync, tokenRefreshed, refreshWarning: Boolean(refreshWarning) }),
        createdAt: finishedAt,
      });
    });
    return {
      status: refreshWarning ? ("warning" as const) : ("healthy" as const),
      tokenRefreshed,
      refreshWarning,
      sync: publicSync,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = safeError(error);
    await db.transaction(async (tx) => {
      await tx
        .update(integrationStates)
        .set({
          status: "error",
          lastHealthCheckAt: failedAt,
          lastError: message,
          updatedAt: failedAt,
        })
        .where(eq(integrationStates.key, INTEGRATION_KEY));
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "system",
        action: "instagram_maintenance_failed",
        entityType: "integration",
        entityId: INTEGRATION_KEY,
        metadata: JSON.stringify({ error: message }),
        createdAt: failedAt,
      });
    });
    return { status: "error" as const, error: message };
  } finally {
    await releaseMaintenanceLock();
  }
}
