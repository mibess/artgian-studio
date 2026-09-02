import { jobs } from "../../../db/schema";
import { getCommercialDb, getSystemSettings } from "../../db/commercial";

export function getFollowupSchedule(sentAt: string) {
  const configured = Number(process.env.FOLLOWUP_INTERVAL_HOURS || 20);
  const hours = Number.isFinite(configured)
    ? Math.min(20, Math.max(1, configured))
    : 20;
  return new Date(Date.parse(sentAt) + hours * 60 * 60 * 1_000).toISOString();
}

export async function scheduleFollowupReview(input: {
  leadId: string;
  conversationId: string;
  sourceMessageId: string;
  sentAt: string;
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
  const scheduledAt = getFollowupSchedule(input.sentAt);
  const inserted = await db
    .insert(jobs)
    .values({
      id: crypto.randomUUID(),
      type: "execute_followup",
      payload: JSON.stringify({
        leadId: input.leadId,
        conversationId: input.conversationId,
        sourceMessageId: input.sourceMessageId,
        followupsSent: 0,
      }),
      status: "pending",
      maxAttempts: 2,
      scheduledAt,
      idempotencyKey: `followup:${input.sourceMessageId}`,
      createdAt: input.sentAt,
    })
    .onConflictDoNothing()
    .returning({ id: jobs.id });
  return inserted.length
    ? { status: "scheduled" as const, scheduledAt }
    : { status: "exists" as const, scheduledAt };
}
