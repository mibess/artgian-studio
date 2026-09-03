import { and, eq } from "drizzle-orm";
import {
  auditLogs,
  exceptions,
  integrationStates,
  jobs,
} from "../../db/schema";
import { getCommercialDb } from "../db/commercial";

type QStashFailurePayload = {
  sourceBody?: unknown;
  sourceMessageId?: unknown;
  status?: unknown;
  retried?: unknown;
};

export function parseFollowupFailure(body: string) {
  try {
    const payload = JSON.parse(body) as QStashFailurePayload;
    if (typeof payload.sourceBody !== "string" || payload.sourceBody.length > 10_000) {
      return null;
    }
    const source = JSON.parse(
      Buffer.from(payload.sourceBody, "base64").toString("utf8"),
    ) as { jobId?: unknown };
    if (typeof source.jobId !== "string" || !source.jobId.trim()) return null;
    return {
      jobId: source.jobId.trim(),
      sourceMessageId:
        typeof payload.sourceMessageId === "string"
          ? payload.sourceMessageId
          : null,
      status: typeof payload.status === "number" ? payload.status : null,
      retried: typeof payload.retried === "number" ? payload.retried : null,
    };
  } catch {
    return null;
  }
}

export async function recordFollowupDeliveryFailure(input: {
  jobId: string;
  sourceMessageId: string | null;
  status: number | null;
  retried: number | null;
}) {
  const db = await getCommercialDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
  if (!job || job.type !== "execute_followup") return { status: "not_found" as const };

  const [alreadyRecorded] = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "qstash_followup_delivery_failed"),
        eq(auditLogs.entityId, job.id),
      ),
    )
    .limit(1);
  if (alreadyRecorded) return { status: "already_recorded" as const };

  const now = new Date().toISOString();
  let leadId: string | null = null;
  try {
    const payload = JSON.parse(job.payload) as { leadId?: unknown };
    leadId = typeof payload.leadId === "string" ? payload.leadId : null;
  } catch {
    leadId = null;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(jobs)
      .set({ lastError: "QStash esgotou as tentativas de entrega; revisão operacional necessária" })
      .where(eq(jobs.id, job.id));
    await tx
      .insert(integrationStates)
      .values({
        key: "followup_scheduler",
        status: "error",
        lastHealthCheckAt: now,
        lastError: "Falha na entrega de um despertar de follow-up pelo QStash.",
        metadata: JSON.stringify({ jobId: job.id }),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: integrationStates.key,
        set: {
          status: "error",
          lastHealthCheckAt: now,
          lastError: "Falha na entrega de um despertar de follow-up pelo QStash.",
          metadata: JSON.stringify({ jobId: job.id }),
          updatedAt: now,
        },
      });
    await tx.insert(exceptions).values({
      id: crypto.randomUUID(),
      leadId,
      type: "followup_scheduler_delivery_failed",
      severity: "high",
      title: "Agendador de follow-up requer atenção",
      description: `O QStash não conseguiu acionar o job ${job.id} após as retentativas.`,
      status: "open",
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "system",
      action: "qstash_followup_delivery_failed",
      entityType: "job",
      entityId: job.id,
      metadata: JSON.stringify({
        sourceMessageId: input.sourceMessageId,
        status: input.status,
        retried: input.retried,
      }),
      createdAt: now,
    });
  });
  return { status: "recorded" as const };
}
