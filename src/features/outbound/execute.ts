import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import {
  auditLogs,
  campaigns,
  conversations,
  experiments,
  jobs,
  leads,
  messages,
  outboundEvents,
  outboundProspects,
  timelineEvents,
} from "../../../db/schema";
import { getCommercialDb, getSystemSettings } from "../../db/commercial";
import { InstagramBrowserSendError, runInstagramFirstContact } from "../../integrations/browser/instagram-cdp";
import { isWithinOperatingHours } from "../conversations/automation";
import { evaluateBrowserFirstContactPolicy } from "./policy";
import { getWarmupDailyLimit } from "./domain";
import {
  acquireOutboundBrowserLease,
  recordOutboundIntegrationFailure,
  recordOutboundIntegrationSuccess,
  releaseOutboundBrowserLease,
} from "./safety";

function randomIntervalSeconds() {
  const rawMinimum = Number(
    process.env.MIN_SECONDS_BETWEEN_DMS ||
      process.env.MIN_SECONDS_BETWEEN_OUTBOUND ||
      90,
  );
  const minimum = Number.isFinite(rawMinimum)
    ? Math.max(30, Math.trunc(rawMinimum))
    : 90;
  const rawMaximum = Number(
    process.env.MAX_SECONDS_BETWEEN_DMS ||
      process.env.MAX_SECONDS_BETWEEN_OUTBOUND ||
      240,
  );
  const maximum = Number.isFinite(rawMaximum)
    ? Math.max(minimum, Math.trunc(rawMaximum))
    : 240;
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

export async function executeOutboundBrowserJob(input: {
  jobId: string;
  prospectId: string;
}) {
  const db = await getCommercialDb();
  const [row] = await db
    .select({ prospect: outboundProspects, campaign: campaigns, lead: leads })
    .from(outboundProspects)
    .innerJoin(campaigns, eq(outboundProspects.campaignId, campaigns.id))
    .leftJoin(leads, eq(outboundProspects.leadId, leads.id))
    .where(eq(outboundProspects.id, input.prospectId))
    .limit(1);
  if (!row) return { status: "not_found" as const };
  if (!row.lead || !row.prospect.draftBody) {
    return { status: "invalid_state" as const };
  }

  const settings = await getSystemSettings();
  const rawEnvironmentLimit = Number(
    process.env.MAX_DMS_PER_DAY ||
      process.env.MAX_OUTBOUND_CONTACTS_PER_DAY ||
      5,
  );
  const environmentLimit = Number.isFinite(rawEnvironmentLimit)
    ? Math.max(1, Math.trunc(rawEnvironmentLimit))
    : 5;
  const warmupLimit = getWarmupDailyLimit(
    new Date(),
    process.env.OUTBOUND_WARMUP_STARTED_AT,
    Number(process.env.OUTBOUND_WARMUP_START_DAILY || 5),
    Number(process.env.OUTBOUND_WARMUP_WEEKLY_INCREASE || 5),
    environmentLimit,
  );
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const contactsToday = await db
    .select({ id: outboundProspects.id })
    .from(outboundProspects)
    .where(
      and(
        eq(outboundProspects.campaignId, row.campaign.id),
        isNotNull(outboundProspects.contactedAt),
        gte(outboundProspects.contactedAt, since),
      ),
    );
  const policy = evaluateBrowserFirstContactPolicy({
    environmentEnabled: process.env.OUTBOUND_AUTOMATION_ENABLED === "true",
    browserSendEnabled: process.env.BROWSER_SEND_ENABLED === "true",
    automationPaused: settings.automation_paused === "true",
    outboundPaused: settings.outbound_paused !== "false",
    campaignEnabled: row.campaign.outboundEnabled,
    doNotContact: row.lead.doNotContact,
    approved: row.prospect.status === "queued" || row.prospect.status === "approved_manual",
    withinOperatingHours: isWithinOperatingHours(
      new Date(),
      row.campaign.operatingHours,
      row.campaign.operatingTimezone,
    ),
    sentToday: contactsToday.length,
    dailyLimit: Math.min(row.campaign.dailyLimit, environmentLimit, warmupLimit),
  });
  if (!policy.allowed) {
    return {
      status: policy.reason === "outside_operating_hours" ? "reschedule" as const : "paused" as const,
      reason: policy.reason,
      retryAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
    };
  }

  const [lastContact] = await db
    .select({ contactedAt: outboundProspects.contactedAt })
    .from(outboundProspects)
    .where(isNotNull(outboundProspects.contactedAt))
    .orderBy(desc(outboundProspects.contactedAt))
    .limit(1);
  if (lastContact?.contactedAt) {
    const nextAllowedAt = new Date(
      Date.parse(lastContact.contactedAt) + randomIntervalSeconds() * 1_000,
    );
    if (nextAllowedAt.getTime() > Date.now()) {
      return { status: "reschedule" as const, retryAt: nextAllowedAt.toISOString() };
    }
  }

  const now = new Date().toISOString();
  const leaseAcquired = await acquireOutboundBrowserLease(new Date(now));
  if (!leaseAcquired) {
    return {
      status: "reschedule" as const,
      retryAt: new Date(Date.now() + 60 * 1_000).toISOString(),
    };
  }
  try {
    await db
      .update(outboundProspects)
      .set({ status: "sending", lastAttemptAt: now, lastError: null, updatedAt: now })
      .where(eq(outboundProspects.id, row.prospect.id));
    try {
      const result = await runInstagramFirstContact({
        jobId: input.jobId,
        username: row.prospect.instagramUsername,
        message: row.prospect.draftBody,
        allowSend: true,
      });
      if (result.status !== "sent") throw new Error("O navegador não confirmou o envio.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha desconhecida";
      await db
        .update(outboundProspects)
        .set({ status: error instanceof InstagramBrowserSendError && error.kind === "uncertain" ? "send_uncertain" : "failed", lastError: reason.slice(0, 1_000), updatedAt: now })
        .where(eq(outboundProspects.id, row.prospect.id))
        .catch(() => undefined);
      await recordOutboundIntegrationFailure(
        reason,
        error instanceof InstagramBrowserSendError && error.kind === "unavailable",
      ).catch(() => undefined);
      if (error instanceof InstagramBrowserSendError && error.kind === "uncertain") {
        return { status: "uncertain" as const, reason };
      }
      throw error;
    }

    await recordOutboundIntegrationSuccess();
    try {
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.leadId, row.lead.id))
        .orderBy(desc(conversations.updatedAt))
        .limit(1);
      const conversationId = conversation?.id || crypto.randomUUID();
      const messageId = crypto.randomUUID();
      await db.transaction(async (tx) => {
        if (!conversation) {
          await tx.insert(conversations).values({
            id: conversationId,
            leadId: row.lead!.id,
            channel: "instagram",
            externalId: `browser:${row.prospect.instagramUsername}`,
            channelOwner: "browser",
            status: "active",
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await tx
            .update(conversations)
            .set({ channelOwner: "browser", lastMessageAt: now, updatedAt: now })
            .where(eq(conversations.id, conversation.id));
        }
        await tx.insert(messages).values({
          id: messageId,
          conversationId,
          direction: "outbound",
          sender: "assistant",
          body: row.prospect.draftBody!,
          action: "outbound_first_contact",
          status: "sent",
          sentAt: now,
          createdAt: now,
        });
        await tx
          .update(leads)
          .set({
            pipelineStage: "contacted",
            channelState: "waiting_inbound_reply",
            lastContactAt: now,
            updatedAt: now,
          })
          .where(eq(leads.id, row.lead!.id));
        await tx
          .update(outboundProspects)
          .set({
            status: "waiting_reply",
            pipelineStage: "contacted",
            contactedAt: now,
            lastError: null,
            updatedAt: now,
          })
          .where(eq(outboundProspects.id, row.prospect.id));
        await tx.insert(outboundEvents).values({
          id: crypto.randomUUID(),
          prospectId: row.prospect.id,
          campaignId: row.campaign.id,
          leadId: row.lead!.id,
          type: "first_contact_sent",
          variant: row.prospect.experimentVariant,
          metadata: JSON.stringify({ channel: "browser", messageId }),
          occurredAt: now,
        });
        if (row.prospect.experimentId) {
          await tx
            .update(experiments)
            .set({ sampleSize: sql`${experiments.sampleSize} + 1` })
            .where(eq(experiments.id, row.prospect.experimentId));
        }
        await tx.insert(timelineEvents).values({
          id: crypto.randomUUID(),
          leadId: row.lead!.id,
          type: "outbound_message",
          title: "Primeiro contato enviado pelo navegador dedicado",
          metadata: JSON.stringify({ prospectId: row.prospect.id, messageId }),
          createdAt: now,
        });
        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actor: "operator_approved_worker",
          action: "instagram_browser_first_contact_sent",
          entityType: "outbound_prospect",
          entityId: row.prospect.id,
          metadata: JSON.stringify({ campaignId: row.campaign.id, messageId }),
          createdAt: now,
        });
        await tx
          .update(jobs)
          .set({ status: "completed", finishedAt: now, lastError: null })
          .where(eq(jobs.id, input.jobId));
      });
      return { status: "sent" as const, messageId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha ao registrar o envio";
      await db
        .update(outboundProspects)
        .set({
          status: "send_uncertain",
          lastError: `Mensagem enviada, mas o registro local falhou: ${reason}`.slice(0, 1_000),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(outboundProspects.id, row.prospect.id))
        .catch(() => undefined);
      return {
        status: "uncertain" as const,
        reason: "A mensagem pode ter sido enviada, mas a persistência falhou. Confira o Instagram.",
      };
    }
  } finally {
    await releaseOutboundBrowserLease().catch(() => undefined);
  }
}
