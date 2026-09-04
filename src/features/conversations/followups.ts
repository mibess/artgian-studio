import { eq } from "drizzle-orm";
import { auditLogs, jobs } from "../../../db/schema";
import { getCommercialDb, getSystemSettings } from "../../db/commercial";
import { scheduleFollowupWake } from "../../worker/followup-scheduler";

export function getFollowupSchedule(lastInboundAt: string, now = new Date()) {
  const configured = Number(process.env.FOLLOWUP_INTERVAL_HOURS || 18);
  const hours = Number.isFinite(configured)
    ? Math.min(20, Math.max(1, configured))
    : 18;
  const inboundTime = Date.parse(lastInboundAt);
  if (!Number.isFinite(inboundTime)) throw new Error("Data inbound inválida.");
  return new Date(Math.max(now.getTime(), inboundTime + hours * 60 * 60 * 1_000)).toISOString();
}

export function buildFollowupDraft(productInterest?: string | null) {
  const subject = productInterest?.trim();
  return subject
    ? `Oi! Passando só para saber se você ainda quer continuar com a ideia do ${subject}. Se quiser, me chama por aqui 😊`
    : "Oi! Passando só para saber se você ainda quer continuar com aquela ideia. Se quiser, me chama por aqui 😊";
}

export async function scheduleFollowupReview(input: {
  leadId: string;
  conversationId: string;
  sourceMessageId: string;
  sentAt: string;
  lastInboundAt: string;
  followupsSent?: number;
}) {
  const settings = await getSystemSettings();
  if (
    process.env.FOLLOWUP_REVIEW_ENABLED !== "true" ||
    settings.automation_paused === "true" ||
    settings.followups_paused !== "false"
  ) {
    return { status: "disabled" as const };
  }

  const db = await getCommercialDb();
  const scheduledAt = getFollowupSchedule(input.lastInboundAt);
  const jobId = crypto.randomUUID();
  const inserted = await db
    .insert(jobs)
    .values({
      id: jobId,
      type: "execute_followup",
      payload: JSON.stringify({
        leadId: input.leadId,
        conversationId: input.conversationId,
        sourceMessageId: input.sourceMessageId,
        followupsSent: input.followupsSent || 0,
        lastInboundAt: input.lastInboundAt,
      }),
      status: "pending",
      maxAttempts: 2,
      scheduledAt,
      idempotencyKey: `followup:${input.sourceMessageId}`,
      createdAt: input.sentAt,
    })
    .onConflictDoNothing()
    .returning({ id: jobs.id });
  if (!inserted.length) return { status: "exists" as const, scheduledAt };

  let wake: { status: "qstash" | "database_only" };
  try {
    wake = await scheduleFollowupWake({ jobId, scheduledAt });
  } catch {
    wake = { status: "database_only" };
    await db.update(jobs).set({
      lastError: "Agendador externo indisponível; job preservado no banco",
    }).where(eq(jobs.id, jobId));
  }
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actor: "system",
    action: "instagram_followup_scheduled",
    entityType: "job",
    entityId: jobId,
    metadata: JSON.stringify({
      scheduledAt,
      scheduler: wake.status,
      followupsSent: input.followupsSent || 0,
    }),
    createdAt: input.sentAt,
  });
  return { status: "scheduled" as const, scheduledAt, scheduler: wake.status };
}
