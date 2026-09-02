import { describe, expect, it } from "vitest";
import { evaluateOutboundCampaignPolicy } from "../src/features/outbound/policy";

const safeBase = {
  environmentEnabled: true,
  automationPaused: false,
  outboundPaused: false,
  campaignEnabled: true,
  doNotContact: false,
  contactPolicy: "inbound_window" as const,
  withinOperatingHours: true,
  sentToday: 0,
  dailyLimit: 5,
};

describe("política de prospecção outbound", () => {
  it("nunca libera primeiro contato frio pela API do Instagram", () => {
    expect(evaluateOutboundCampaignPolicy({ ...safeBase, contactPolicy: "manual_only" })).toEqual({
      allowed: false,
      reason: "manual_contact_required",
    });
  });

  it("respeita opt-out, pausas e limite diário", () => {
    expect(evaluateOutboundCampaignPolicy({ ...safeBase, doNotContact: true }).reason).toBe("do_not_contact");
    expect(evaluateOutboundCampaignPolicy({ ...safeBase, outboundPaused: true }).reason).toBe("outbound_paused");
    expect(evaluateOutboundCampaignPolicy({ ...safeBase, sentToday: 5 }).reason).toBe("daily_limit_reached");
  });

  it("libera apenas contato com janela inbound e todas as travas abertas", () => {
    expect(evaluateOutboundCampaignPolicy(safeBase)).toEqual({ allowed: true, reason: "inbound_window" });
  });
});
