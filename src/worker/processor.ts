import { and, asc, eq, lte } from "drizzle-orm";
import { jobs, leads, systemSettings } from "../../db/schema";
import { getCommercialDb } from "../db/commercial";
import { tryAutoSendInstagramReply } from "../features/conversations/automation";
import {
  createReplyDraftForLead,
  enhanceReplyDraftWithAi,
} from "../features/conversations/replies";
import { canScheduleFollowup } from "../features/leads/domain";

type JobPayload = {
  leadId?: string;
  conversationId?: string;
  suggestedMessage?: string;
  draftMessageId?: string;
  followupsSent?: number;
};

async function getPauseState() {
  const db = await getCommercialDb();
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value === "true"]));
}

export async function runWorkerOnce() {
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "pending"), lte(jobs.scheduledAt, now)))
    .orderBy(asc(jobs.scheduledAt))
    .limit(1);
  if (!job) return { processed: false as const };

  const claimed = await db
    .update(jobs)
    .set({ status: "running", attempts: job.attempts + 1, startedAt: now })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, "pending")))
    .returning();
  if (!claimed.length) return { processed: false as const };

  try {
    const pauses = await getPauseState();
    if (pauses.automation_paused) {
      await db.update(jobs).set({ status: "pending", startedAt: null }).where(eq(jobs.id, job.id));
      return { processed: true as const, paused: true as const };
    }
    const payload = JSON.parse(job.payload) as JobPayload;
    if (!payload.leadId) throw new Error("Job sem leadId.");
    const [lead] = await db.select().from(leads).where(eq(leads.id, payload.leadId)).limit(1);
    if (!lead) throw new Error("Lead não encontrado.");
    if (lead.doNotContact) throw new Error("Contato está em do_not_contact.");

    if (job.type === "generate_reply") {
      let draftMessageId = payload.draftMessageId;
      if (!draftMessageId) {
        const draft = await createReplyDraftForLead(lead.id);
        if (draft.status === "created" || draft.status === "exists") {
          draftMessageId = draft.messageId;
        } else if (draft.status === "already_replied") {
          await db
            .update(jobs)
            .set({ status: "completed", finishedAt: now, lastError: null })
            .where(eq(jobs.id, job.id));
          return { processed: true as const, alreadyReplied: true as const };
        } else {
          throw new Error(`Não foi possível criar o rascunho: ${draft.status}`);
        }
      }
      const enhanced = await enhanceReplyDraftWithAi({
        leadId: lead.id,
        messageId: draftMessageId,
      });
      if (enhanced.status === "enhanced") {
        const automatic = await tryAutoSendInstagramReply({
          leadId: lead.id,
          messageId: enhanced.messageId,
          decision: enhanced.decision,
        });
        if (automatic.status === "sent") {
          await db
            .update(jobs)
            .set({ status: "completed", finishedAt: now, lastError: null })
            .where(eq(jobs.id, job.id));
          return { processed: true as const, sent: true as const };
        }
      }
      await db
        .update(jobs)
        .set({ status: "waiting_review", finishedAt: now, lastError: null })
        .where(eq(jobs.id, job.id));
      return { processed: true as const, waitingReview: true as const };
    }

    if (job.type === "execute_followup") {
      const allowed = canScheduleFollowup({ doNotContact: lead.doNotContact, explicitRefusal: lead.pipelineStage === "closed", followupsSent: payload.followupsSent || 0, maxFollowups: Number(process.env.MAX_FOLLOWUPS || 2), hasRepliedSinceLastContact: false });
      if (!allowed || pauses.followups_paused) {
        await db.update(jobs).set({ status: "completed", finishedAt: now, lastError: allowed ? "Follow-ups pausados" : "Follow-up cancelado pelas regras comerciais" }).where(eq(jobs.id, job.id));
        return { processed: true as const, cancelled: true as const };
      }
      await db.update(jobs).set({ status: "waiting_review", finishedAt: now }).where(eq(jobs.id, job.id));
      return { processed: true as const, waitingReview: true as const };
    }

    await db.update(jobs).set({ status: "completed", finishedAt: now, lastError: null }).where(eq(jobs.id, job.id));
    return { processed: true as const, jobId: job.id };
  } catch (error) {
    const exhausted = job.attempts + 1 >= job.maxAttempts;
    await db.update(jobs).set({ status: exhausted ? "dead_letter" : "pending", finishedAt: exhausted ? now : null, lastError: error instanceof Error ? error.message : "Falha desconhecida" }).where(eq(jobs.id, job.id));
    return { processed: true as const, failed: true as const, exhausted };
  }
}
