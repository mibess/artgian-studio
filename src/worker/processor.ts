import { and, asc, desc, eq, lte, ne } from "drizzle-orm";
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
  prospectId?: string;
};

type OutboundExecutionResult = {
  status: string;
  reason?: string;
  retryAt?: string;
};

type WorkerDependencies = {
  executeOutboundBrowserJob?: (input: {
    jobId: string;
    prospectId: string;
  }) => Promise<OutboundExecutionResult>;
};

async function getPauseState() {
  const db = await getCommercialDb();
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value === "true"]));
}

export async function recoverStaleJobs(now = new Date()) {
  const db = await getCommercialDb();
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1_000).toISOString();
  const stale = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "running"), lte(jobs.startedAt, staleBefore)));
  if (!stale.length) return { recovered: 0, uncertain: 0 };
  const recoveredAt = now.toISOString();
  await db.transaction(async (tx) => {
    for (const job of stale) {
      const outbound = job.type === "send_outbound";
      await tx
        .update(jobs)
        .set({
          status: outbound ? "waiting_review" : "pending",
          startedAt: null,
          scheduledAt: recoveredAt,
          lastError: outbound
            ? "Worker reiniciado durante o envio. Confira o Instagram antes de tentar novamente."
            : "Job recuperado após reinício do worker.",
        })
        .where(and(eq(jobs.id, job.id), eq(jobs.status, "running")));
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "system",
        action: outbound ? "outbound_send_recovery_requires_review" : "job_recovered_after_restart",
        entityType: "job",
        entityId: job.id,
        metadata: JSON.stringify({ previousStartedAt: job.startedAt }),
        createdAt: recoveredAt,
      });
    }
  });
  return {
    recovered: stale.filter((job) => job.type !== "send_outbound").length,
    uncertain: stale.filter((job) => job.type === "send_outbound").length,
  };
}

export async function runWorkerOnce(
  targetJobId?: string,
  dependencies: WorkerDependencies = {},
) {
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await recoverStaleJobs(new Date(now));
  const defaultQueueFilter = process.env.VERCEL
    ? and(
        eq(jobs.status, "pending"),
        lte(jobs.scheduledAt, now),
        ne(jobs.type, "send_outbound"),
      )
    : and(eq(jobs.status, "pending"), lte(jobs.scheduledAt, now));
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
        : defaultQueueFilter,
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

    if (job.type === "send_outbound") {
      if (!payload.prospectId) throw new Error("Job outbound sem prospectId.");
      if (!dependencies.executeOutboundBrowserJob) {
        throw new Error("Executor outbound disponível somente no worker local.");
      }
      const outbound = await dependencies.executeOutboundBrowserJob({
        jobId: job.id,
        prospectId: payload.prospectId,
      });
      if (outbound.status === "sent") {
        return { processed: true as const, sent: true as const };
      }
      if (outbound.status === "uncertain") {
        await db
          .update(jobs)
          .set({
            status: "waiting_review",
            finishedAt: now,
            lastError: "Envio incerto: confira o Instagram antes de qualquer nova tentativa.",
          })
          .where(eq(jobs.id, job.id));
        return { processed: true as const, waitingReview: true as const };
      }
      if (outbound.status === "blocked") {
        await db
          .update(jobs)
          .set({
            status: "waiting_review",
            finishedAt: now,
            lastError:
              outbound.reason ||
              "Envio outbound bloqueado pela política de canal.",
          })
          .where(eq(jobs.id, job.id));
        return { processed: true as const, waitingReview: true as const };
      }
      if (outbound.status === "paused" || outbound.status === "reschedule") {
        const retryAt =
          outbound.retryAt || new Date(Date.now() + 15 * 60 * 1_000).toISOString();
        await db
          .update(jobs)
          .set({
            status: "pending",
            attempts: job.attempts,
            startedAt: null,
            scheduledAt: retryAt,
            lastError: `Aguardando liberação: ${outbound.reason}`,
          })
          .where(eq(jobs.id, job.id));
        return { processed: true as const, paused: true as const };
      }
      throw new Error(`Job outbound inválido: ${outbound.status}`);
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

export async function runWorkerBatch(
  limit = 3,
  dependencies: WorkerDependencies = {},
) {
  const results: Awaited<ReturnType<typeof runWorkerOnce>>[] = [];
  const safeLimit = Math.min(10, Math.max(1, Math.trunc(limit)));
  for (let index = 0; index < safeLimit; index += 1) {
    const result = await runWorkerOnce(undefined, dependencies);
    results.push(result);
    if (!result.processed || ("paused" in result && result.paused)) break;
  }
  return {
    processed: results.filter((result) => result.processed).length,
    results,
  };
}
