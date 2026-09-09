import { describe, expect, it } from "vitest";
import type { BusinessConfig } from "../src/config/business";
import {
  buildDiscoverySeeds,
  extractPublicInstagramCandidate,
  instagramUsernameFromHref,
  isLikelyCommercialInstagramProfile,
  parseDiscoveryTermsInput,
  selectDiscoverySeedsForRun,
} from "../src/features/outbound/discovery-domain";

const business = {
  icpKeywords: ["presente personalizado", "decoração geek"],
  icpSegments: ["pessoas buscando presentes"],
  partnershipSegments: ["decoradores de festas"],
  targetGeography: "Brasil",
} as BusinessConfig;

describe("domínio da descoberta segura", () => {
  it("normaliza critérios e completa campos vazios com o ICP do negócio", () => {
    expect(parseDiscoveryTermsInput("#decoracao, decoração; presentes\ndecoracao")).toEqual([
      "decoracao",
      "presentes",
    ]);
    const seeds = buildDiscoverySeeds({
      funnelType: "consumer",
      segment: "Presentes",
      keywords: [],
      hashtags: ["feitoem3d"],
      locations: [],
      business,
    });
    expect(seeds[0]).toEqual({ kind: "hashtag", value: "feitoem3d" });
    expect(seeds).toContainEqual({ kind: "keyword", value: "presente personalizado" });
    expect(seeds).toContainEqual({ kind: "location", value: "Brasil" });
  });

  it("aceita somente links que representam perfis", () => {
    expect(instagramUsernameFromHref("/@Invalido")).toBeNull();
    expect(instagramUsernameFromHref("/explore/")).toBeNull();
    expect(instagramUsernameFromHref("/blog/")).toBeNull();
    expect(instagramUsernameFromHref("/p/ABC123/")).toBeNull();
    expect(instagramUsernameFromHref("https://www.instagram.com/perfil.valido/")).toBe("perfil.valido");
  });

  it("alterna critérios, equilibra tipos e preserva exploração", () => {
    const seeds = [
      { kind: "hashtag" as const, value: "feitoem3d" },
      { kind: "hashtag" as const, value: "decoracaogeek" },
      { kind: "keyword" as const, value: "presente personalizado" },
      { kind: "keyword" as const, value: "setup gamer" },
      { kind: "keyword" as const, value: "mãe de pet" },
      { kind: "location" as const, value: "Brasil" },
    ];
    const first = selectDiscoverySeedsForRun({ seeds, cursor: 0, maximum: 4 });
    const second = selectDiscoverySeedsForRun({ seeds, cursor: 1, maximum: 4 });
    expect(first).not.toEqual(second);
    expect(new Set(first.map((seed) => seed.kind))).toEqual(
      new Set(["hashtag", "keyword", "location"]),
    );

    const adaptive = selectDiscoverySeedsForRun({
      seeds,
      cursor: 2,
      maximum: 4,
      explorationPercent: 30,
      performance: [{
        kind: "keyword",
        value: "mãe de pet",
        profilesInspected: 3,
        profilesQualified: 2,
        profilesCreated: 1,
      }],
    });
    expect(adaptive[0]).toEqual({ kind: "keyword", value: "mãe de pet" });
    expect(new Set(adaptive.map((seed) => seed.value)).size).toBe(4);
  });

  it("extrai apenas evidências públicas úteis do perfil", () => {
    const candidate = extractPublicInstagramCandidate({
      username: "atelier.teste",
      sourceUrl: "https://www.instagram.com/atelier.teste/",
      discoveryQuery: "presente personalizado",
      title: "Ateliê Teste (@atelier.teste) • Instagram photos and videos",
      description: "Perfil público do Ateliê Teste",
      mainText: "atelier.teste\nAteliê Teste\n1.200 seguidores\nPresentes personalizados e decoração geek\nBrasil",
      knownLocations: ["Brasil"],
    });
    expect(candidate).toMatchObject({
      instagramUsername: "atelier.teste",
      name: "Ateliê Teste",
      profileLocation: "Brasil",
      discoveryQuery: "presente personalizado",
    });
    expect(candidate?.profileBio).toContain("Presentes personalizados");
    expect(candidate?.publicSignal).toContain("Presentes personalizados");
  });

  it("distingue sinais comerciais de um perfil pessoal", () => {
    expect(isLikelyCommercialInstagramProfile({
      instagramUsername: "atelie.presentes",
      name: "Ateliê dos Presentes",
      sourceUrl: "https://www.instagram.com/atelie.presentes/",
      profileBio: "Encomendas pelo WhatsApp · enviamos para todo o Brasil",
      discoveryQuery: "presente criativo",
    })).toBe(true);
    expect(isLikelyCommercialInstagramProfile({
      instagramUsername: "marina.silva",
      name: "Marina Silva",
      sourceUrl: "https://www.instagram.com/marina.silva/",
      profileBio: "Mãe, apaixonada por decoração geek, livros e meus cachorros",
      discoveryQuery: "decoração geek",
    })).toBe(false);
  });
});
