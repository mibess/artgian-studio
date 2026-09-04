import { and, eq, gte } from "drizzle-orm";
import { auditLogs } from "../../../db/schema";
import { getCommercialDb, getSystemSettings } from "../../db/commercial";
import {
  getAutomaticReplyDelayMs,
  wait as waitForHumanDelay,
} from "../automation/human-pacing";
import type { AiAction, Intent, IntentDecision } from "../leads/domain";
import { approveAndSendInstagramReply } from "./replies";

const SAFE_AUTO_REPLY_INTENTS = new Set<Intent>([
  "interested",
  "asked_price",
  "asked_customization",
  "asked_product",
  "sent_reference",
  "wants_quote",
]);

const LOW_RISK_CONVERSATIONAL_ACTIONS: Partial<Record<Intent, Set<AiAction>>> = {
  greeting: new Set(["ask_question"]),
  general_question: new Set(["ask_question"]),
};

const SAFE_AUTO_REPLY_ACTIONS = new Set<AiAction>([
  "reply",
  "ask_question",
  "show_product",
  "explain_customization",
  "collect_requirement",
  "request_reference",
  "prepare_briefing",
  "prepare_quote_request",
]);

export type AutoReplyDecision = IntentDecision & {
  source: "rules" | "openai";
};

type AutoReplyPolicyInput = {
  decision: AutoReplyDecision;
  enabled: boolean;
  automationPaused: boolean;
  autoRepliesPaused: boolean;
  withinOperatingHours: boolean;
  sentToday: number;
  dailyLimit: number;
};

export function evaluateAutoReplyPolicy(input: AutoReplyPolicyInput) {
  if (!input.enabled) return { allowed: false as const, reason: "disabled" as const };
  if (input.automationPaused) return { allowed: false as const, reason: "automation_paused" as const };
  if (input.autoRepliesPaused) return { allowed: false as const, reason: "auto_replies_paused" as const };
  if (!input.withinOperatingHours) return { allowed: false as const, reason: "outside_operating_hours" as const };
  if (input.dailyLimit <= 0 || input.sentToday >= input.dailyLimit) {
    return { allowed: false as const, reason: "daily_limit_reached" as const };
  }
  if (input.decision.source !== "openai") {
    return { allowed: false as const, reason: "rules_fallback" as const };
  }
  if (input.decision.requiresHuman) {
    return { allowed: false as const, reason: "human_review_required" as const };
  }
  const isSafeCommercialIntent = SAFE_AUTO_REPLY_INTENTS.has(input.decision.intent);
  const isSafeConversationalTurn = LOW_RISK_CONVERSATIONAL_ACTIONS[
    input.decision.intent
  ]?.has(input.decision.action) === true;
  if (!isSafeCommercialIntent && !isSafeConversationalTurn) {
    return { allowed: false as const, reason: "unsafe_intent" as const };
  }
  if (!SAFE_AUTO_REPLY_ACTIONS.has(input.decision.action)) {
    return { allowed: false as const, reason: "unsafe_action" as const };
  }
  return { allowed: true as const, reason: "safe_inbound" as const };
}

function minutesInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

function parseClock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isWithinOperatingHours(
  date = new Date(),
  range = process.env.OPERATING_HOURS || "09:00-18:00",
  timezone = process.env.OPERATING_TIMEZONE || "America/Sao_Paulo",
) {
  const [startRaw, endRaw] = range.split("-");
  const start = parseClock(startRaw || "");
  const end = parseClock(endRaw || "");
  if (start == null || end == null) return false;
  let current: number;
  try {
    current = minutesInTimezone(date, timezone);
  } catch {
    return false;
  }
  if (start === end) return true;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export async function tryAutoSendInstagramReply(input: {
  leadId: string;
  messageId: string;
  decision: AutoReplyDecision;
  inboundText?: string;
}, dependencies: {
  wait?: (milliseconds: number) => Promise<void>;
} = {}) {
  const settings = await getSystemSettings();
  const db = await getCommercialDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const sentRows = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "instagram_auto_reply_sent"),
        gte(auditLogs.createdAt, since),
      ),
    );
  const configuredDailyLimit = Number(process.env.MAX_AUTO_REPLIES_PER_DAY || 20);
  const dailyLimit = Number.isFinite(configuredDailyLimit)
    ? Math.max(0, Math.trunc(configuredDailyLimit))
    : 20;
  const policy = evaluateAutoReplyPolicy({
    decision: input.decision,
    enabled: process.env.INSTAGRAM_AUTO_REPLY_ENABLED === "true",
    automationPaused: settings.automation_paused === "true",
    autoRepliesPaused: settings.auto_replies_paused !== "false",
    withinOperatingHours: isWithinOperatingHours(),
    sentToday: sentRows.length,
    dailyLimit,
  });
  if (!policy.allowed) return { status: "waiting_review" as const, reason: policy.reason };

  const responseDelayMs = getAutomaticReplyDelayMs({
    inboundText: input.inboundText,
    outboundText: input.decision.message,
  });
  await (dependencies.wait || waitForHumanDelay)(responseDelayMs);
  const result = await approveAndSendInstagramReply(
    {
      leadId: input.leadId,
      messageId: input.messageId,
      body: input.decision.message,
    },
    {
      actor: "assistant",
      auditAction: "instagram_auto_reply_sent",
      timelineTitle: "Resposta segura enviada automaticamente pelo Instagram",
    },
  );
  return result.status === "sent"
    ? { status: "sent" as const, reason: policy.reason, responseDelayMs }
    : { status: "waiting_review" as const, reason: result.status };
}
