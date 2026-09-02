import { and, asc, desc, eq, lte } from "drizzle-orm";
import {
  auditLogs,
  conversations,
  jobs,
  leads,
  messages,
  systemSettings,
  timelineEvents,
} from "../../db/schema";
import { getCommercialDb } from "../db/commercial";
import { tryAutoSendInstagramReply } from "../features/conversations/automation";
import {
  createReplyDraftForLead,
  enhanceReplyDraftWithAi,
} from "../features/conversations/replies";
import { canScheduleFollowup } from "../features/leads/domain";
import { buildFollowupDraft } from "../features/conversations/followups";
import { isInstagramReplyWindowOpen } from "../integrations/instagram/send";
import { scheduleFollowupWake } from "./followup-scheduler";

type JobPayload = {
  leadId?: string;
  conversationId?: string;
  suggestedMessage?: string;
  draftMessageId?: string;
  sourceMessageId?: string;
  followupsSent?: number;
  lastInboundAt?: string;
};

async function getPauseState() {
  const db = await getCommercialDb();
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value === "true"]));
}

export async function runWorkerOnce(targetJobId?: string) {
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  const [job] = await db
    .select()
    .from(jobs)
    .where(
      targetJobId
        ? and(
            eq(jobs.id, targetJobId),
            eq(jobs.status, "pending"),
            lte(jobs.scheduledAt, now),
          )
        : and(eq(jobs.status, "pending"), lte(jobs.scheduledAt, now)),
    )
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
      const retryAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
      await db.update(jobs).set({ status: "pending", attempts: job.attempts, startedAt: null, scheduledAt: retryAt }).where(eq(jobs.id, job.id));
      if (job.type === "execute_followup") {
        await scheduleFollowupWake({ jobId: job.id, scheduledAt: retryAt }).catch(() => undefined);
      }
      return { processed: true as const, paused: true as const };
    }
    const payload = JSON.parse(job.payload) as JobPayload;
    if (!payload.leadId) throw new Error("Job sem leadId.");
    const [lead] = await db.select().from(leads).where(eq(leads.id, payload.leadId)).limit(1);
    if (!lead) throw new Error("Lead não encontrado.");
    if (lead.doNotContact) {
      await db
        .update(jobs)
        .set({
          status: "completed",
          finishedAt: now,
          lastError: "Cancelado: contato está em do_not_contact",
        })
        .where(eq(jobs.id, job.id));
      return { processed: true as const, cancelled: true as const };
    }

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
      if (pauses.followups_paused) {
        const retryAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
        await db
          .update(jobs)
          .set({ status: "pending", attempts: job.attempts, startedAt: null, scheduledAt: retryAt, lastError: "Follow-ups pausados" })
          .where(eq(jobs.id, job.id));
        await scheduleFollowupWake({ jobId: job.id, scheduledAt: retryAt }).catch(() => undefined);
        return { processed: true as const, paused: true as const };
      }
      if (!payload.conversationId || !payload.sourceMessageId) {
        throw new Error("Follow-up sem conversa ou mensagem de origem.");
      }
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, payload.conversationId),
            eq(conversations.leadId, lead.id),
          ),
        )
        .limit(1);
      if (!conversation) throw new Error("Conversa do follow-up não encontrada.");
      if (conversation.externalId?.startsWith("comment:")) {
        await db.update(jobs).set({ status: "completed", finishedAt: now, lastError: "Follow-up cancelado: comentários exigem tratamento separado" }).where(eq(jobs.id, job.id));
        return { processed: true as const, cancelled: true as const };
      }
      const recent = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(desc(messages.sentAt));
      const source = recent.find((message) => message.id === payload.sourceMessageId);
      if (!source || source.direction !== "outbound" || source.status !== "sent") {
        throw new Error("Mensagem de origem do follow-up não está confirmada como enviada.");
      }
      const latestInbound = recent.find((message) => message.direction === "inbound");
      const hasRepliedSinceLastContact = Boolean(
        source &&
          latestInbound &&
          Date.parse(latestInbound.sentAt) > Date.parse(source.sentAt),
      );
      const sameInboundContext = Boolean(
        !payload.lastInboundAt || latestInbound?.sentAt === payload.lastInboundAt,
      );
      const allowed = canScheduleFollowup({
        doNotContact: lead.doNotContact,
        explicitRefusal: lead.pipelineStage === "closed",
        followupsSent: payload.followupsSent || 0,
        maxFollowups: Number(process.env.MAX_FOLLOWUPS || 1),
        hasRepliedSinceLastContact,
      });
      if (
        !allowed ||
        !sameInboundContext ||
        !latestInbound ||
        !isInstagramReplyWindowOpen(latestInbound.sentAt)
      ) {
        await db.update(jobs).set({ status: "completed", finishedAt: now, lastError: !allowed || !sameInboundContext ? "Follow-up cancelado pelas regras comerciais" : "Follow-up cancelado: janela de 24 horas encerrada" }).where(eq(jobs.id, job.id));
        return { processed: true as const, cancelled: true as const };
      }
      const existingDraft = recent.find(
        (message) =>
          message.direction === "outbound" &&
          ["draft", "failed", "sending", "send_uncertain"].includes(message.status),
      );
      const draftMessageId = existingDraft?.id || crypto.randomUUID();
      await db.transaction(async (tx) => {
        if (!existingDraft) {
          await tx.insert(messages).values({
            id: draftMessageId,
            conversationId: conversation.id,
            direction: "outbound",
            sender: "assistant",
            body: buildFollowupDraft(lead.productInterest),
            intent: "general_question",
            action: "ask_question",
            status: "draft",
            sentAt: now,
            createdAt: now,
          });
        }
        await tx
          .update(jobs)
          .set({
            status: "waiting_review",
            finishedAt: now,
            lastError: null,
            payload: JSON.stringify({ ...payload, draftMessageId }),
          })
          .where(eq(jobs.id, job.id));
        await tx.insert(timelineEvents).values({
          id: crypto.randomUUID(),
          leadId: lead.id,
          type: "followup_review",
          title: "Follow-up preparado para revisão",
          description: "A mensagem não foi enviada automaticamente.",
          metadata: JSON.stringify({ jobId: job.id, draftMessageId }),
          createdAt: now,
        });
        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actor: "system",
          action: "instagram_followup_drafted",
          entityType: "message",
          entityId: draftMessageId,
          metadata: JSON.stringify({ jobId: job.id }),
          createdAt: now,
        });
      });
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

export async function runWorkerBatch(limit = 3) {
  const results: Awaited<ReturnType<typeof runWorkerOnce>>[] = [];
  const safeLimit = Math.min(10, Math.max(1, Math.trunc(limit)));
  for (let index = 0; index < safeLimit; index += 1) {
    const result = await runWorkerOnce();
    results.push(result);
    if (!result.processed || ("paused" in result && result.paused)) break;
  }
  return {
    processed: results.filter((result) => result.processed).length,
    results,
  };
}
