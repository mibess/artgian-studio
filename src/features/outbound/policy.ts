export type OutboundContactPolicy =
  | "inbound_window"
  | "comment_private_reply"
  | "manual_only";

export function evaluateOutboundCampaignPolicy(input: {
  environmentEnabled: boolean;
  automationPaused: boolean;
  outboundPaused: boolean;
  campaignEnabled: boolean;
  doNotContact: boolean;
  contactPolicy: OutboundContactPolicy;
  withinOperatingHours: boolean;
  sentToday: number;
  dailyLimit: number;
}) {
  if (!input.environmentEnabled) return { allowed: false as const, reason: "environment_disabled" as const };
  if (input.automationPaused) return { allowed: false as const, reason: "automation_paused" as const };
  if (input.outboundPaused) return { allowed: false as const, reason: "outbound_paused" as const };
  if (!input.campaignEnabled) return { allowed: false as const, reason: "campaign_disabled" as const };
  if (input.doNotContact) return { allowed: false as const, reason: "do_not_contact" as const };
  if (!input.withinOperatingHours) return { allowed: false as const, reason: "outside_operating_hours" as const };
  if (input.dailyLimit <= 0 || input.sentToday >= input.dailyLimit) {
    return { allowed: false as const, reason: "daily_limit_reached" as const };
  }
  if (input.contactPolicy !== "inbound_window") {
    return { allowed: false as const, reason: "manual_contact_required" as const };
  }
  return { allowed: true as const, reason: "inbound_window" as const };
}
