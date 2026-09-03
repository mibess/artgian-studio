import { describe, expect, it } from "vitest";
import { evaluateBrowserFirstContactPolicy, evaluateOutboundCampaignPolicy } from "../src/features/outbound/policy";

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

describe("política do primeiro contato pelo navegador", () => {
  const browserBase = {
    environmentEnabled: true,
    browserSendEnabled: true,
    automationPaused: false,
    outboundPaused: false,
    campaignEnabled: true,
    doNotContact: false,
    approved: true,
    withinOperatingHours: true,
    sentToday: 0,
    dailyLimit: 5,
  };

  it("exige aprovação humana e as duas travas de ambiente", () => {
    expect(evaluateBrowserFirstContactPolicy({ ...browserBase, approved: false }).reason).toBe("human_approval_required");
    expect(evaluateBrowserFirstContactPolicy({ ...browserBase, environmentEnabled: false }).reason).toBe("environment_disabled");
    expect(evaluateBrowserFirstContactPolicy({ ...browserBase, browserSendEnabled: false }).reason).toBe("browser_send_disabled");
  });

  it("libera somente dentro do horário e do limite", () => {
    expect(evaluateBrowserFirstContactPolicy(browserBase)).toEqual({
      allowed: true,
      reason: "approved_browser_first_contact",
    });
    expect(evaluateBrowserFirstContactPolicy({ ...browserBase, withinOperatingHours: false }).reason).toBe("outside_operating_hours");
    expect(evaluateBrowserFirstContactPolicy({ ...browserBase, sentToday: 5 }).reason).toBe("daily_limit_reached");
  });
});
