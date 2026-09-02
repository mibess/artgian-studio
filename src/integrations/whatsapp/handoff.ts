import { getBusinessConfig, isDefinedBusinessValue } from "../../config/business";
import { buildBriefingSummary, type BriefingData } from "../../features/leads/domain";

export async function prepareWhatsAppHandoff(username: string, briefing: BriefingData) {
  const business = await getBusinessConfig();
  const summary = buildBriefingSummary(username, briefing);
  if (!isDefinedBusinessValue(business.company.whatsappLink)) {
    return {
      enabled: false as const,
      reason: "WHATSAPP_LINK está A_DEFINIR",
      url: null,
      summary,
    };
  }
  const separator = business.company.whatsappLink.includes("?") ? "&" : "?";
  return {
    enabled: true as const,
    reason: null,
    url: `${business.company.whatsappLink}${separator}text=${encodeURIComponent(summary)}`,
    summary,
  };
}
