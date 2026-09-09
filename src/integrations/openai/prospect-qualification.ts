import OpenAI from "openai";
import { z } from "zod";
import { aiUsage } from "../../../db/schema";
import { getCommercialDb } from "../../db/commercial";
import { CircuitBreaker } from "../../features/leads/domain";
import type { DiscoveryStrategy, PublicInstagramCandidate } from "../../features/outbound/discovery-domain";
import type { OutboundFunnel } from "../../features/outbound/domain";
import { estimateCostMicros, getAiBudgetStatus } from "./conversation-engine";

const prospectQualificationCircuitBreaker = new CircuitBreaker(3, 60_000);

const classifications = [
  "consumer",
  "business",
  "organization",
  "public_figure_or_large_brand",
  "unknown",
] as const;

const decisionSchema = z.object({
  decisions: z.array(z.object({
    index: z.number().int().min(0),
    fits: z.boolean(),
    confidence: z.enum(["high", "medium", "low"]),
    classification: z.enum(classifications),
    reason: z.string().min(3).max(180),
  })).max(30),
});

export type ProspectCampaignFitDecision = z.infer<typeof decisionSchema>["decisions"][number];

export type ProspectCampaignFitInput = {
  campaign: {
    name: string;
    funnelType: OutboundFunnel;
    segment?: string | null;
    strategy: DiscoveryStrategy;
    keywords: string[];
    hashtags: string[];
    locations: string[];
    localNiche?: string;
    localLocation?: string;
  };
  candidates: PublicInstagramCandidate[];
};

export type ProspectCampaignFitResult =
  | { available: true; decisions: ProspectCampaignFitDecision[] }
  | { available: false; reason: string; decisions: [] };

export async function validateProspectCampaignFits(
  input: ProspectCampaignFitInput,
): Promise<ProspectCampaignFitResult> {
  if (!input.candidates.length) return { available: true, decisions: [] };
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL_FAST?.trim();
  if (!apiKey || !model) {
    return { available: false, reason: "OPENAI_API_KEY ou OPENAI_MODEL_FAST não configurado.", decisions: [] };
  }
  if (!prospectQualificationCircuitBreaker.canExecute()) {
    return { available: false, reason: "Circuit breaker da IA rápida está aberto.", decisions: [] };
  }
  const budget = await getAiBudgetStatus();
  if (!budget.available) {
    return { available: false, reason: budget.reason || "Orçamento da IA indisponível.", decisions: [] };
  }

  try {
    const client = new OpenAI({ apiKey, timeout: 12_000, maxRetries: 1 });
    const completion = await client.chat.completions.create({
      model,
      store: false,
      reasoning_effort: "none",
      max_completion_tokens: Math.min(600, 80 + input.candidates.length * 60),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "prospect_campaign_fit",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["decisions"],
            properties: {
              decisions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["index", "fits", "confidence", "classification", "reason"],
                  properties: {
                    index: { type: "integer", minimum: 0 },
                    fits: { type: "boolean" },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                    classification: { type: "string", enum: [...classifications] },
                    reason: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: "Você é um classificador conservador de adequação de prospectos. Responda uma decisão para cada índice. Aceite somente quando as evidências públicas tornam o perfil um alvo plausível para a campanha. Em campanhas de consumidores, rejeite empresas, marcas, organizações, órgãos, celebridades, perfis de grande audiência e perfis aceitos apenas por localização. Em campanhas de parceiros, aceite empresas somente quando houver alinhamento real com o segmento. Não invente informações. Evidência insuficiente significa fits=false. A confiança low deve sempre resultar em fits=false. Escreva o motivo em português, de forma curta e objetiva.",
        },
        {
          role: "user",
          content: JSON.stringify({
            campaign: {
              name: input.campaign.name.slice(0, 120),
              funnel: input.campaign.funnelType,
              segment: input.campaign.segment?.slice(0, 120) || null,
              strategy: input.campaign.strategy,
              keywords: input.campaign.keywords.slice(0, 12),
              hashtags: input.campaign.hashtags.slice(0, 12),
              locations: input.campaign.locations.slice(0, 8),
              localNiche: input.campaign.localNiche?.slice(0, 120) || null,
              localLocation: input.campaign.localLocation?.slice(0, 120) || null,
            },
            candidates: input.candidates.map((candidate, index) => ({
              index,
              username: candidate.instagramUsername.slice(0, 30),
              name: candidate.name?.slice(0, 120) || null,
              category: candidate.profileCategory?.slice(0, 120) || null,
              bio: candidate.profileBio?.slice(0, 500) || null,
              location: candidate.profileLocation?.slice(0, 120) || null,
              signal: candidate.publicSignal?.slice(0, 240) || null,
              discoveryQuery: candidate.discoveryQuery.slice(0, 120),
            })),
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    const parsed = raw ? decisionSchema.safeParse(JSON.parse(raw)) : null;
    const expectedIndexes = input.candidates.map((_, index) => index);
    const receivedIndexes = parsed?.success
      ? parsed.data.decisions.map((decision) => decision.index).sort((a, b) => a - b)
      : [];
    if (
      !parsed?.success ||
      receivedIndexes.length !== expectedIndexes.length ||
      receivedIndexes.some((value, index) => value !== expectedIndexes[index])
    ) {
      prospectQualificationCircuitBreaker.recordFailure();
      return { available: false, reason: "A IA rápida retornou uma classificação incompleta.", decisions: [] };
    }
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const db = await getCommercialDb();
    await db.insert(aiUsage).values({
      id: crypto.randomUUID(),
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsdMicros: estimateCostMicros(inputTokens, outputTokens, "fast"),
      purpose: "prospect_campaign_fit",
      createdAt: new Date().toISOString(),
    });
    prospectQualificationCircuitBreaker.recordSuccess();
    return { available: true, decisions: parsed.data.decisions };
  } catch (error) {
    prospectQualificationCircuitBreaker.recordFailure();
    return {
      available: false,
      reason: error instanceof Error ? error.message : "Falha desconhecida na IA rápida.",
      decisions: [],
    };
  }
}
