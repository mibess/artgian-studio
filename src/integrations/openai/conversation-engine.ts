import OpenAI from "openai";
import { gte, sql } from "drizzle-orm";
import { z } from "zod";
import { aiUsage } from "../../../db/schema";
import { getBusinessConfig } from "../../config/business";
import { getCommercialDb } from "../../db/commercial";
import {
  AI_ACTIONS,
  INTENTS,
  classifyIntent,
  decideNextAction,
  type CatalogTruth,
  type IntentDecision,
} from "../../features/leads/domain";

const decisionSchema = z.object({
  intent: z.enum(INTENTS),
  action: z.enum(AI_ACTIONS),
  reason: z.string().min(3).max(240),
  message: z.string().min(1).max(600),
  requiresHuman: z.boolean(),
});

export type ConversationContext = {
  message: string;
  recentMessages?: Array<{ direction: "inbound" | "outbound"; body: string }>;
  product?: CatalogTruth | null;
  leadId?: string;
  conversationId?: string;
};

function getCostRates() {
  return {
    input: Number(process.env.OPENAI_INPUT_COST_PER_1M_USD || 0),
    output: Number(process.env.OPENAI_OUTPUT_COST_PER_1M_USD || 0),
  };
}

function estimateCostMicros(inputTokens: number, outputTokens: number) {
  const rates = getCostRates();
  return Math.round(((inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output) * 1_000_000);
}

export async function getAiBudgetStatus() {
  const budgetUsd = Number(process.env.OPENAI_MONTHLY_BUDGET_USD || 0);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const db = await getCommercialDb();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsage.estimatedCostUsdMicros}), 0)` })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, monthStart.toISOString()));
  const spentUsd = Number(row.total) / 1_000_000;
  const rates = getCostRates();
  return {
    budgetUsd,
    spentUsd,
    available: budgetUsd > 0 && spentUsd < budgetUsd && rates.input > 0 && rates.output > 0,
    reason:
      budgetUsd <= 0
        ? "Orçamento mensal não configurado"
        : rates.input <= 0 || rates.output <= 0
          ? "Custos por token não configurados"
          : spentUsd >= budgetUsd
            ? "Orçamento mensal atingido"
            : null,
  };
}

function unsafeCommercialClaim(
  message: string,
  product: CatalogTruth | null | undefined,
  unverifiedClaims: string[],
) {
  const normalized = message.toLocaleLowerCase("pt-BR");
  if (unverifiedClaims.some((claim) => normalized.includes(claim.toLocaleLowerCase("pt-BR")))) return true;
  const hasPrice = /r\$\s*\d|\d+[,.]\d{2}/i.test(message);
  const hasDeadline = /\b\d+\s*(dias?|horas?|semanas?)\b/i.test(message);
  if (hasPrice && product?.basePriceCents == null && product?.priceFromCents == null) return true;
  if (hasDeadline && !product?.productionTime) return true;
  return false;
}

export async function generateCommercialDecision(
  context: ConversationContext,
): Promise<IntentDecision & { source: "rules" | "openai" }> {
  const fallback = decideNextAction(classifyIntent(context.message));
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  if (!apiKey || !model) return { ...fallback, source: "rules" };

  const budget = await getAiBudgetStatus();
  if (!budget.available) return { ...fallback, source: "rules" };

  try {
    const business = getBusinessConfig();
    const client = new OpenAI({ apiKey, timeout: 12_000, maxRetries: 1 });
    const completion = await client.chat.completions.create({
      model,
      store: false,
      reasoning_effort: "minimal",
      max_completion_tokens: 1_200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "commercial_decision",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["intent", "action", "reason", "message", "requiresHuman"],
            properties: {
              intent: { type: "string", enum: [...INTENTS] },
              action: { type: "string", enum: [...AI_ACTIONS] },
              reason: { type: "string" },
              message: { type: "string" },
              requiresHuman: { type: "boolean" },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `Você é o assistente comercial da ${business.company.name}. Tom: ${business.brand.voice}. Escreva uma única resposta curta e natural em português do Brasil, adequada para uma DM do Instagram. Descubra a intenção por trás do produto e faça no máximo uma pergunta por mensagem. Só use estes claims: ${business.verifiedClaims.join(" | ")}. Nunca invente preço, prazo, frete, material, viabilidade, desconto ou garantia. Na dúvida, escale para humano.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            inbound: context.message.slice(0, 2_000),
            recentMessages: (context.recentMessages?.slice(-6) || []).map((message) => ({
              direction: message.direction,
              body: message.body.slice(0, 1_000),
            })),
            product: context.product || null,
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) {
      console.warn("OpenAI não retornou conteúdo; usando regras locais.");
      return { ...fallback, source: "rules" };
    }
    const parsed = decisionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn("OpenAI retornou uma decisão inválida; usando regras locais.");
      return { ...fallback, source: "rules" };
    }
    if (
      unsafeCommercialClaim(
        parsed.data.message,
        context.product,
        business.unverifiedClaims,
      )
    ) {
      console.warn("OpenAI retornou um claim não verificado; escalando para revisão humana.");
      return { ...decideNextAction("needs_human"), source: "rules" };
    }

    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const db = await getCommercialDb();
    await db.insert(aiUsage).values({
      id: crypto.randomUUID(),
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsdMicros: estimateCostMicros(inputTokens, outputTokens),
      leadId: context.leadId,
      conversationId: context.conversationId,
      purpose: "commercial_decision",
      createdAt: new Date().toISOString(),
    });
    return { ...parsed.data, source: "openai" };
  } catch (error) {
    console.error(
      "Falha ao gerar decisão comercial pela OpenAI; usando regras locais.",
      error instanceof Error ? error.message : "Erro desconhecido",
    );
    return { ...fallback, source: "rules" };
  }
}
