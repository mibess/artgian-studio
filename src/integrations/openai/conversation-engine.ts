import OpenAI from "openai";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { aiUsage, auditLogs, exceptions, systemSettings } from "../../../db/schema";
import { getBusinessConfig } from "../../config/business";
import { getCommercialDb } from "../../db/commercial";
import {
  AI_ACTIONS,
  CircuitBreaker,
  INTENTS,
  classifyIntent,
  decideNextAction,
  type CatalogTruth,
  type IntentDecision,
} from "../../features/leads/domain";
import { buildSafeOutboundOpening, type OutboundFunnel } from "../../features/outbound/domain";
import {
  NATURAL_CONVERSATION_GUIDELINES,
  naturalizeBrandVoice,
} from "../../features/conversations/voice";

const openAiCircuitBreaker = new CircuitBreaker(3, 60_000);

const decisionSchema = z.object({
  intent: z.enum(INTENTS),
  action: z.enum(AI_ACTIONS),
  reason: z.string().min(3).max(240),
  message: z.string().min(1).max(600),
  requiresHuman: z.boolean(),
});

const outboundOpeningSchema = z.object({
  message: z.string().min(10).max(600),
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
  if (budgetUsd > 0 && spentUsd >= budgetUsd) {
    const now = new Date().toISOString();
    const [existing] = await db
      .select({ id: exceptions.id })
      .from(exceptions)
      .where(
        and(
          eq(exceptions.type, "openai_budget_reached"),
          eq(exceptions.status, "open"),
        ),
      )
      .limit(1);
    await db.transaction(async (tx) => {
      await tx
        .insert(systemSettings)
        .values({ key: "automation_paused", value: "true", updatedAt: now })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: "true", updatedAt: now },
        });
      if (!existing) {
        await tx.insert(exceptions).values({
          id: crypto.randomUUID(),
          type: "openai_budget_reached",
          severity: "high",
          title: "Automação pausada pelo orçamento da OpenAI",
          description: "O limite mensal configurado foi atingido. Revise o orçamento antes de retomar.",
          status: "open",
          createdAt: now,
        });
        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actor: "system",
          action: "automation_paused_by_openai_budget",
          entityType: "system_setting",
          entityId: "automation_paused",
          metadata: JSON.stringify({ budgetUsd, spentUsd }),
          createdAt: now,
        });
      }
    });
  }
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
  const hasUnverifiedPromise = /\b(garant(?:e|ia|imos)|sempre|nunca falha|melhor do mercado|resultado garantido|frete gr[aá]tis|desconto|aprova[cç][aã]o garantida)\b/i.test(message);
  if (hasPrice && product?.basePriceCents == null && product?.priceFromCents == null) return true;
  if (hasDeadline && !product?.productionTime) return true;
  if (hasUnverifiedPromise) return true;
  return false;
}

export async function generateCommercialDecision(
  context: ConversationContext,
): Promise<IntentDecision & { source: "rules" | "openai" }> {
  const fallback = decideNextAction(classifyIntent(context.message));
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const primaryModel = process.env.OPENAI_MODEL?.trim();
  const fastModel = process.env.OPENAI_MODEL_FAST?.trim();
  const model =
    context.message.length <= 180 && fastModel ? fastModel : primaryModel;
  if (!apiKey || !model) return { ...fallback, source: "rules" };
  if (!openAiCircuitBreaker.canExecute()) {
    return { ...fallback, source: "rules" };
  }

  const budget = await getAiBudgetStatus();
  if (!budget.available) return { ...fallback, source: "rules" };

  try {
    const business = await getBusinessConfig();
    const client = new OpenAI({ apiKey, timeout: 12_000, maxRetries: 1 });
    const completion = await client.chat.completions.create({
      model,
      store: false,
      reasoning_effort: "none",
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
          content: `${NATURAL_CONVERSATION_GUIDELINES} Tom da marca: ${business.brand.voice}. Use estes itens somente como fatos, sem copiar a linguagem institucional: ${business.verifiedClaims.join(" | ")}. Descubra a intenção por trás do produto. Nunca invente preço, prazo, frete, material, viabilidade, desconto ou garantia. Na dúvida, escale para uma pessoa.`,
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
    const naturalMessage = naturalizeBrandVoice(
      parsed.data.message,
      business.company.name,
    );
    if (
      unsafeCommercialClaim(
        naturalMessage,
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
    openAiCircuitBreaker.recordSuccess();
    return { ...parsed.data, message: naturalMessage, source: "openai" };
  } catch (error) {
    openAiCircuitBreaker.recordFailure();
    console.error(
      "Falha ao gerar decisão comercial pela OpenAI; usando regras locais.",
      error instanceof Error ? error.message : "Erro desconhecido",
    );
    return { ...fallback, source: "rules" };
  }
}

export async function generateOutboundOpening(input: {
  leadId: string;
  firstName?: string | null;
  profileCategory?: string | null;
  profileBio?: string | null;
  profileLocation?: string | null;
  publicSignal?: string | null;
  funnelType: OutboundFunnel;
}) {
  const business = await getBusinessConfig();
  const fallback = buildSafeOutboundOpening({
    firstName: input.firstName,
    companyName: business.company.name,
    publicSignal: input.publicSignal,
    funnelType: input.funnelType,
  });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  if (!apiKey || !model || !openAiCircuitBreaker.canExecute()) {
    return { message: fallback, source: "rules" as const };
  }
  const budget = await getAiBudgetStatus();
  if (!budget.available) return { message: fallback, source: "rules" as const };

  try {
    const client = new OpenAI({ apiKey, timeout: 12_000, maxRetries: 1 });
    const completion = await client.chat.completions.create({
      model,
      store: false,
      reasoning_effort: "none",
      max_completion_tokens: 800,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "outbound_opening",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["message"],
            properties: { message: { type: "string" } },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `${NATURAL_CONVERSATION_GUIDELINES} Escreva uma única primeira mensagem curta e verdadeira. Fale como alguém que trabalha com peças personalizadas em impressão 3D, sem apresentar a empresa em terceira pessoa. Use somente o sinal público fornecido e estes itens como fatos, sem copiar a linguagem institucional: ${business.verifiedClaims.join(" | ")}. Não invente elogio, preço, prazo, desconto, garantia, resultado ou relação comercial. Não finja ser cliente e termine pedindo permissão para explicar a ideia.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            firstName: input.firstName,
            category: input.profileCategory,
            bio: input.profileBio,
            location: input.profileLocation,
            publicSignal: input.publicSignal,
            funnel: input.funnelType,
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    const parsed = raw ? outboundOpeningSchema.safeParse(JSON.parse(raw)) : null;
    const naturalMessage = parsed?.success
      ? naturalizeBrandVoice(parsed.data.message, business.company.name)
      : null;
    if (
      !parsed?.success ||
      !naturalMessage ||
      unsafeCommercialClaim(naturalMessage, null, business.unverifiedClaims)
    ) {
      return { message: fallback, source: "rules" as const };
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
      leadId: input.leadId,
      purpose: "outbound_opening",
      createdAt: new Date().toISOString(),
    });
    openAiCircuitBreaker.recordSuccess();
    return { message: naturalMessage, source: "openai" as const };
  } catch {
    openAiCircuitBreaker.recordFailure();
    return { message: fallback, source: "rules" as const };
  }
}
