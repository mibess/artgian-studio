import { describe, expect, it } from "vitest";
import type { BusinessConfig } from "../src/config/business";
import {
  buildDiscoverySeeds,
  extractPublicInstagramCandidate,
  instagramUsernameFromHref,
  parseDiscoveryTermsInput,
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
    expect(instagramUsernameFromHref("/p/ABC123/")).toBeNull();
    expect(instagramUsernameFromHref("https://www.instagram.com/perfil.valido/")).toBe("perfil.valido");
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
});
