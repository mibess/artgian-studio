import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const { createCompletion } = vi.hoisted(() => ({ createCompletion: vi.fn() }));

vi.mock("openai", () => ({
  default: class OpenAIMock {
    chat = { completions: { create: createCompletion } };
  },
}));

const testDir = path.join(process.cwd(), ".test-tmp");
const databasePath = path.join(testDir, `artgian-prospect-ai-test-${process.pid}.db`);

describe("validação econômica de prospectos pela IA rápida", () => {
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL_FAST = "fast-test-model";
    process.env.OPENAI_MONTHLY_BUDGET_USD = "10";
    process.env.OPENAI_INPUT_COST_PER_1M_USD = "1";
    process.env.OPENAI_OUTPUT_COST_PER_1M_USD = "1";
    process.env.OPENAI_FAST_INPUT_COST_PER_1M_USD = "0.1";
    process.env.OPENAI_FAST_OUTPUT_COST_PER_1M_USD = "0.5";
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("classifica vários candidatos em uma única chamada curta e registra o custo", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            decisions: [
              { index: 0, fits: true, confidence: "high", classification: "consumer", reason: "Perfil pessoal alinhado" },
              { index: 1, fits: false, confidence: "high", classification: "public_figure_or_large_brand", reason: "Marca de grande audiência" },
            ],
          }),
        },
      }],
      usage: { prompt_tokens: 200, completion_tokens: 40 },
    });
    const [{ validateProspectCampaignFits }, { getCommercialDb }, schema] = await Promise.all([
      import("../src/integrations/openai/prospect-qualification"),
      import("../src/db/commercial"),
      import("../db/schema"),
    ]);
    const result = await validateProspectCampaignFits({
      campaign: {
        name: "Presentes geek",
        funnelType: "consumer",
        segment: "Clientes finais",
        strategy: "instagram_search",
        keywords: ["presente personalizado"],
        hashtags: ["decoracaogeek"],
        locations: ["Brasil"],
      },
      candidates: [
        {
          instagramUsername: "pessoa.teste",
          sourceUrl: "https://www.instagram.com/pessoa.teste/",
          profileBio: "Colecionadora e apaixonada por decoração geek",
          discoveryQuery: "decoração geek",
        },
        {
          instagramUsername: "marca.grande",
          sourceUrl: "https://www.instagram.com/marca.grande/",
          profileBio: "Perfil oficial · 2 mi seguidores",
          discoveryQuery: "Brasil",
        },
      ],
    });

    expect(result).toMatchObject({ available: true });
    expect(result.decisions).toHaveLength(2);
    expect(createCompletion).toHaveBeenCalledOnce();
    expect(createCompletion).toHaveBeenCalledWith(expect.objectContaining({
      model: "fast-test-model",
      store: false,
      reasoning_effort: "none",
      max_completion_tokens: 200,
    }));
    const db = await getCommercialDb();
    const usage = await db.select().from(schema.aiUsage);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      model: "fast-test-model",
      purpose: "prospect_campaign_fit",
      inputTokens: 200,
      outputTokens: 40,
      estimatedCostUsdMicros: 40,
    });
  });
});
