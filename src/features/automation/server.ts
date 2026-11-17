import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { aiUsage, auditLogs } from "../../../db/schema";
import { getCommercialDb, getSystemSettings } from "../../db/commercial";
import { getFollowupSchedulerStatus } from "../../worker/followup-scheduler";
import { AUTOMATION_SETTING_KEYS, buildAutomationOverview, resolveAutomationControls } from "./domain";

export async function getAutomationControls() {
  return resolveAutomationControls(await getSystemSettings(), process.env);
}

export async function isAiFeatureEnabled(feature: "replies" | "openings" | "qualification") {
  const controls = await getAutomationControls();
  return feature === "replies" ? controls.repliesEnabled
    : feature === "openings" ? controls.openingsEnabled : controls.qualificationEnabled;
}

export async function getAutomationOverview() {
  const db = await getCommercialDb();
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const [settings, [usage], logs] = await Promise.all([
    getSystemSettings(),
    db.select({ total: sql<number>`coalesce(sum(${aiUsage.estimatedCostUsdMicros}), 0)` })
      .from(aiUsage).where(gte(aiUsage.createdAt, month.toISOString())),
    db.select().from(auditLogs).where(and(eq(auditLogs.action, "setting_updated"),
      inArray(auditLogs.entityId, [...AUTOMATION_SETTING_KEYS])))
      .orderBy(desc(auditLogs.createdAt)).limit(12),
  ]);
  const history = logs.map(log => {
    let value = "";
    try {
      const saved = JSON.parse(log.metadata || "{}").value;
      if (saved === "true" || saved === "false") value = saved;
    } catch { /* Older audit records may lack a value. */ }
    return { id: log.id, key: log.entityId || "", value, createdAt: log.createdAt };
  });
  return { ...buildAutomationOverview({ settings, env: process.env,
    spentUsd: Number(usage.total) / 1_000_000, schedulerReady: getFollowupSchedulerStatus().ready }), history };
}
