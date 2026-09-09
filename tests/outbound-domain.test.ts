import { describe, expect, it } from "vitest";
import {
  assignExperimentVariant,
  buildSafeOutboundOpening,
  getWarmupDailyLimit,
  isValidOutboundTransition,
  scorePublicProfile,
} from "../src/features/outbound/domain";
import type { BusinessConfig } from "../src/config/business";

const business: BusinessConfig = {
  owner: { name: "Responsável", role: "Fundadora" },
  company: { name: "Artgian Studio", website: "https://example.com", instagramHandle: "@artgian", whatsappLink: "A_DEFINIR" },
  brand: { tagline: "", voice: "acolhedor", oneLinePitch: "" },
  howItWorks: [],
  revenueModel: "venda de produtos",
  primaryProducts: [],
  customizationOptions: [],
  marketJargon: {},
  verifiedClaims: [],
  unverifiedClaims: [],
  icpSegments: ["decoração", "organização"],
  icpKeywords: ["casa", "presente"],
  partnershipSegments: ["arquitetura", "design de interiores"],
  partnershipsEnabled: true,
  partnershipLink: "N/A",
  targetGeography: "Brasil",
  fulfillmentGeography: "Brasil",
  defaultCurrency: "BRL",
  defaultTimezone: "America/Sao_Paulo",
};

describe("qualificação outbound", () => {
  it("pontua apenas sinais públicos informados", () => {
    const result = scorePublicProfile({
      funnelType: "partner",
      category: "Arquitetura",
      bio: "Projetos de design de interiores",
      location: "Brasil",
      publicSignal: "seu projeto recente de organização de cozinha",
    }, business);
    expect(result.score).toBe(70);
    expect(result.priority).toBe("high");
    expect(result.matches).toContain("arquitetura");
  });

  it("produz abertura curta baseada no sinal informado", () => {
    const message = buildSafeOutboundOpening({
      firstName: "Marina Silva",
      companyName: "Artgian Studio",
      publicSignal: "seu projeto recente de organização de cozinha",
      funnelType: "partner",
    });
    expect(message).toContain("Oi, Marina!");
    expect(message).toContain("organização de cozinha");
    expect(message).toContain("Eu trabalho com peças personalizadas");
    expect(message).not.toContain("Artgian Studio");
    expect(message).not.toMatch(/garantia|desconto|resultado/i);
  });

  it("reconhece contexto pessoal explícito no funil de consumidor", () => {
    const result = scorePublicProfile({
      funnelType: "consumer",
      bio: "Sou colecionador de bonecos e esse é o meu hobby",
      publicSignal: "que você mostra sua coleção geek",
    }, business);
    expect(result.score).toBe(40);
    expect(result.priority).toBe("normal");
  });

  it("não qualifica apenas por localização e sinal genérico", () => {
    const result = scorePublicProfile({
      funnelType: "consumer",
      bio: "Perfil oficial com novidades do Brasil",
      location: "Brasil",
      publicSignal: "que você publica novidades",
    }, business);
    expect(result.score).toBe(10);
    expect(result.matches).toEqual([]);
  });

  it("considera nicho, cidade e origem confirmada em campanhas locais", () => {
    const result = scorePublicProfile({
      funnelType: "partner",
      bio: "Manicure e pedicure em Brodowski, São Paulo",
      publicSignal: "Atendimento com hora marcada",
      campaignTerms: ["Manicure e pedicure"],
      targetLocations: ["Brodowski SP"],
      discoverySource: "local_business",
    }, business);
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.matches).toContain("manicure");
    expect(result.matches).toContain("pedicure");
  });

  it("atribui a mesma variante para a mesma chave", () => {
    expect(assignExperimentVariant("perfil", "experimento")).toBe(assignExperimentVariant("perfil", "experimento"));
  });

  it("aceita somente a próxima etapa ou encerramento", () => {
    expect(isValidOutboundTransition("partner", "qualified", "contacted")).toBe(true);
    expect(isValidOutboundTransition("partner", "qualified", "active_partner")).toBe(false);
    expect(isValidOutboundTransition("consumer", "qualified", "closed")).toBe(true);
  });

  it("aumenta o limite de aquecimento semanalmente até o teto", () => {
    expect(getWarmupDailyLimit(new Date("2026-09-03T12:00:00Z"), undefined)).toBe(5);
    expect(getWarmupDailyLimit(new Date("2026-09-17T12:00:00Z"), "2026-09-03T12:00:00Z")).toBe(15);
    expect(getWarmupDailyLimit(new Date("2027-01-01T12:00:00Z"), "2026-09-03T12:00:00Z")).toBe(30);
    expect(getWarmupDailyLimit(new Date("2026-09-03T12:00:00Z"), undefined, Number.NaN, Number.NaN, Number.NaN)).toBe(5);
  });
});
