import { and, eq, gte } from "drizzle-orm";
import {
  auditLogs,
  exceptions,
  integrationStates,
  outboundEvents,
  systemSettings,
} from "../../../db/schema";
import { getCommercialDb } from "../../db/commercial";

type FailureMetadata = {
  consecutiveFailures?: number;
};

export async function acquireOutboundBrowserLease(now = new Date()) {
  const db = await getCommercialDb();
  const leaseUntil = new Date(now.getTime() + 5 * 60 * 1_000).toISOString();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ lockUntil: integrationStates.lockUntil })
      .from(integrationStates)
      .where(eq(integrationStates.key, "instagram_browser"))
      .limit(1);
    if (current?.lockUntil && Date.parse(current.lockUntil) > now.getTime()) {
      return false;
    }
    await tx
      .insert(integrationStates)
      .values({
        key: "instagram_browser",
        status: "unknown",
        lockUntil: leaseUntil,
        metadata: "{}",
        updatedAt: now.toISOString(),
      })
      .onConflictDoUpdate({
        target: integrationStates.key,
        set: { lockUntil: leaseUntil, updatedAt: now.toISOString() },
      });
    return true;
  });
}

export async function releaseOutboundBrowserLease() {
  const db = await getCommercialDb();
  await db
    .update(integrationStates)
    .set({ lockUntil: null, updatedAt: new Date().toISOString() })
    .where(eq(integrationStates.key, "instagram_browser"));
}

function parseFailureMetadata(value: string): FailureMetadata {
  try {
    return JSON.parse(value) as FailureMetadata;
  } catch {
    return {};
  }
}

export async function recordOutboundIntegrationSuccess() {
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await db
    .insert(integrationStates)
    .values({
      key: "instagram_browser",
      status: "healthy",
      lastHealthCheckAt: now,
      lastError: null,
      metadata: JSON.stringify({ consecutiveFailures: 0 }),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: integrationStates.key,
      set: {
        status: "healthy",
        lastHealthCheckAt: now,
        lastError: null,
        metadata: JSON.stringify({ consecutiveFailures: 0 }),
        updatedAt: now,
      },
    });
}

export async function recordOutboundIntegrationFailure(reason: string, forceOpen = false) {
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  const [current] = await db
    .select()
    .from(integrationStates)
    .where(eq(integrationStates.key, "instagram_browser"))
    .limit(1);
  const recordedFailures =
    Number(parseFailureMetadata(current?.metadata || "{}").consecutiveFailures || 0) + 1;
  const configuredThreshold = Number(process.env.OUTBOUND_FAILURE_THRESHOLD || 3);
  const threshold = Number.isFinite(configuredThreshold)
    ? Math.min(10, Math.max(2, Math.trunc(configuredThreshold)))
    : 3;
  const failures = forceOpen ? Math.max(recordedFailures, threshold) : recordedFailures;
  const opened = failures >= threshold;

  await db.transaction(async (tx) => {
    await tx
      .insert(integrationStates)
      .values({
        key: "instagram_browser",
        status: opened ? "error" : "warning",
        lastHealthCheckAt: now,
        lastError: reason.slice(0, 1_000),
        metadata: JSON.stringify({ consecutiveFailures: failures }),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: integrationStates.key,
        set: {
          status: opened ? "error" : "warning",
          lastHealthCheckAt: now,
          lastError: reason.slice(0, 1_000),
          metadata: JSON.stringify({ consecutiveFailures: failures }),
          updatedAt: now,
        },
      });
    if (!opened) return;

    await tx
      .insert(systemSettings)
      .values({ key: "outbound_paused", value: "true", updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: "true", updatedAt: now },
      });
    const [existing] = await tx
      .select({ id: exceptions.id })
      .from(exceptions)
      .where(
        and(
          eq(exceptions.type, "outbound_circuit_open"),
          eq(exceptions.status, "open"),
        ),
      )
      .limit(1);
    if (!existing) {
      await tx.insert(exceptions).values({
        id: crypto.randomUUID(),
        type: "outbound_circuit_open",
        severity: "high",
        title: "Outbound pausado por falhas consecutivas",
        description: "O navegador precisa ser verificado antes de retomar a fila.",
        status: "open",
        createdAt: now,
      });
    }
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "system",
      action: "outbound_circuit_opened",
      entityType: "integration",
      entityId: "instagram_browser",
      metadata: JSON.stringify({ failures, threshold }),
      createdAt: now,
    });
  });
  return { opened, failures, threshold };
}

export async function monitorOutboundOptOutRate(now = new Date()) {
  const db = await getCommercialDb();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000).toISOString();
  const events = await db
    .select({ type: outboundEvents.type })
    .from(outboundEvents)
    .where(gte(outboundEvents.occurredAt, since));
  const sent = events.filter((event) => event.type === "first_contact_sent").length;
  const optOuts = events.filter((event) => event.type === "opt_out_received").length;
  const configuredMinimumSample = Number(process.env.OUTBOUND_OPT_OUT_MIN_SAMPLE || 5);
  const minimumSample = Number.isFinite(configuredMinimumSample)
    ? Math.max(5, Math.trunc(configuredMinimumSample))
    : 5;
  const configuredThreshold = Number(process.env.OUTBOUND_OPT_OUT_RATE_THRESHOLD || 0.2);
  const threshold = Number.isFinite(configuredThreshold)
    ? Math.min(1, Math.max(0.05, configuredThreshold))
    : 0.2;
  const rate = sent ? optOuts / sent : 0;
  if (sent < minimumSample || rate < threshold) {
    return { paused: false as const, sent, optOuts, rate };
  }

  const at = now.toISOString();
  const [existing] = await db
    .select({ id: exceptions.id })
    .from(exceptions)
    .where(
      and(
        eq(exceptions.type, "outbound_opt_out_rate"),
        eq(exceptions.status, "open"),
      ),
    )
    .limit(1);
  await db.transaction(async (tx) => {
    await tx
      .insert(systemSettings)
      .values({ key: "outbound_paused", value: "true", updatedAt: at })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: "true", updatedAt: at },
      });
    if (!existing) {
      await tx.insert(exceptions).values({
        id: crypto.randomUUID(),
        type: "outbound_opt_out_rate",
        severity: "high",
        title: "Outbound pausado por aumento de opt-out",
        description: "A taxa dos últimos sete dias ultrapassou o limite operacional.",
        status: "open",
        createdAt: at,
      });
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "system",
        action: "outbound_paused_by_opt_out_rate",
        entityType: "system_setting",
        entityId: "outbound_paused",
        metadata: JSON.stringify({ sent, optOuts, rate, threshold }),
        createdAt: at,
      });
    }
  });
  return { paused: true as const, sent, optOuts, rate };
}
