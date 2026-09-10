import { expect, it } from "vitest";
import { discoveryDiagnosticLabel } from "../src/features/outbound/discovery-diagnostics";
import { commercialInstagramProfileSignal } from "../src/features/outbound/discovery-domain";

it("mostra o estágio e o motivo sem confundir falha de autoria com rejeição", () => {
  expect(
    discoveryDiagnosticLabel(
      JSON.stringify({
        instagramUsername: "pessoa",
        stage: "pre_ai",
        reason: "Pontuação 10 abaixo do mínimo 30.",
      }),
    ),
  ).toBe("@pessoa · Filtro anterior à IA · Pontuação 10 abaixo do mínimo 30.");
  expect(
    discoveryDiagnosticLabel(
      JSON.stringify({
        hashtag: "geek",
        postKey: "ABC123",
        reason: "Autor não identificado.",
      }),
    ),
  ).toBe("#geek · post ABC123 · Autor não identificado.");
});

it("tolera diagnósticos ausentes ou inválidos", () => {
  expect(discoveryDiagnosticLabel("inválido")).toBe(
    "Diagnóstico indisponível.",
  );
  expect(discoveryDiagnosticLabel(null)).toBe(
    "Diagnóstico sem motivo registrado.",
  );
});

it("registra o sinal comercial concreto sem alterar a regra", () => {
  expect(
    commercialInstagramProfileSignal({
      instagramUsername: "loja.geek",
      profileBio: "Colecionáveis",
      sourceUrl: "https://www.instagram.com/loja.geek/",
      discoveryQuery: "geek",
    }),
  ).toBe("loja");
  expect(
    commercialInstagramProfileSignal({
      instagramUsername: "pessoa",
      profileBio: "Minha coleção geek",
      sourceUrl: "https://www.instagram.com/pessoa/",
      discoveryQuery: "geek",
    }),
  ).toBeNull();
});
