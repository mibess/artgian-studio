import type { BusinessConfig } from "../../config/business";

export const OUTBOUND_FUNNELS = ["consumer", "partner"] as const;
export type OutboundFunnel = (typeof OUTBOUND_FUNNELS)[number];

export const OUTBOUND_PIPELINES = {
  consumer: [
    "discovered",
    "qualified",
    "contacted",
    "replied",
    "interested",
    "whatsapp_handoff",
    "order_confirmed",
    "closed",
  ],
  partner: [
    "discovered",
    "qualified",
    "contacted",
    "replied",
    "interested",
    "partnership_review",
    "active_partner",
    "generated_customer",
    "closed",
  ],
} as const;

export const OUTBOUND_PIPELINE_LABELS: Record<string, string> = {
  discovered: "Descoberto",
  qualified: "Qualificado",
  contacted: "Abordado",
  replied: "Respondeu",
  interested: "Interessado",
  whatsapp_handoff: "Encaminhado ao WhatsApp",
  order_confirmed: "Pedido confirmado",
  partnership_review: "Parceria em análise",
  active_partner: "Parceiro ativo",
  generated_customer: "Gerou cliente",
  closed: "Encerrado",
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

export function scorePublicProfile(
  input: {
    category?: string;
    bio?: string;
    location?: string;
    publicSignal?: string;
    funnelType: OutboundFunnel;
  },
  business: BusinessConfig,
) {
  const searchable = normalize(
    [input.category, input.bio, input.location, input.publicSignal]
      .filter(Boolean)
      .join(" "),
  );
  const segmentTerms =
    input.funnelType === "partner"
      ? business.partnershipSegments
      : business.icpSegments;
  const keywords = [...business.icpKeywords, ...segmentTerms]
    .map(normalize)
    .filter(Boolean);
  const matches = [...new Set(keywords.filter((term) => searchable.includes(term)))];
  const geography = normalize(business.targetGeography);
  const geographyMatch = Boolean(
    input.location &&
      geography &&
      (normalize(input.location).includes(geography) || geography.includes(normalize(input.location))),
  );
  const signalScore = input.publicSignal?.trim() ? 20 : 0;
  const categoryScore = input.category?.trim() ? 10 : 0;
  const keywordScore = Math.min(50, matches.length * 15);
  const geographyScore = geographyMatch ? 20 : 0;
  const score = Math.min(100, signalScore + categoryScore + keywordScore + geographyScore);
  return {
    score,
    matches,
    priority: score >= 70 ? "high" : score >= 40 ? "normal" : "low",
  } as const;
}

export function assignExperimentVariant(
  stableKey: string,
  experimentId: string,
) {
  const value = `${experimentId}:${stableKey}`;
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? "control" : "variant";
}

export function buildSafeOutboundOpening(input: {
  firstName?: string | null;
  companyName: string;
  publicSignal?: string | null;
  funnelType: OutboundFunnel;
}) {
  const greeting = input.firstName?.trim()
    ? `Oi, ${input.firstName.trim().split(/\s+/)[0]}!`
    : "Oi!";
  const signal = input.publicSignal?.trim();
  const context = signal
    ? `Vi ${signal.replace(/[.!?]+$/, "")} no seu perfil.`
    : "Encontrei seu perfil no Instagram.";
  const idea =
    input.funnelType === "partner"
      ? `Trabalho com a ${input.companyName} e enxerguei uma possível conexão entre nossos trabalhos.`
      : `Trabalho com a ${input.companyName} e pensei em uma ideia que pode combinar com você.`;
  return `${greeting} ${context} ${idea} Posso te contar brevemente?`;
}

export function isValidOutboundTransition(
  funnelType: OutboundFunnel,
  from: string,
  to: string,
) {
  if (to === "closed") return true;
  const pipeline = OUTBOUND_PIPELINES[funnelType];
  const currentIndex = pipeline.indexOf(from as never);
  const nextIndex = pipeline.indexOf(to as never);
  return currentIndex >= 0 && nextIndex === currentIndex + 1;
}

export function getWarmupDailyLimit(
  now: Date,
  startedAt: string | undefined,
  startDaily = 5,
  weeklyIncrease = 5,
  maximum = 30,
) {
  const safeMaximum = Number.isFinite(maximum) ? Math.max(1, Math.trunc(maximum)) : 30;
  const safeStartDaily = Number.isFinite(startDaily)
    ? Math.max(1, Math.trunc(startDaily))
    : 5;
  const safeWeeklyIncrease = Number.isFinite(weeklyIncrease)
    ? Math.max(0, Math.trunc(weeklyIncrease))
    : 5;
  if (!startedAt) return Math.min(safeMaximum, safeStartDaily);
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start) || start > now.getTime()) {
    return Math.min(safeMaximum, safeStartDaily);
  }
  const weeks = Math.floor((now.getTime() - start) / (7 * 24 * 60 * 60 * 1_000));
  return Math.min(safeMaximum, safeStartDaily + weeks * safeWeeklyIncrease);
}
