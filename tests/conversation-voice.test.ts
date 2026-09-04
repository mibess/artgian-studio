import { describe, expect, it } from "vitest";
import {
  NATURAL_CONVERSATION_GUIDELINES,
  naturalizeBrandVoice,
} from "../src/features/conversations/voice";

describe("voz comercial natural", () => {
  it("troca narração institucional por primeira pessoa", () => {
    expect(
      naturalizeBrandVoice(
        "A Artgian Studio faz peças personalizadas e a Artgian Studio trabalha com impressão 3D.",
        "Artgian Studio",
      ),
    ).toBe("A gente faz peças personalizadas e a gente trabalha com impressão 3D.");
  });

  it("orienta o modelo a não repetir linguagem robótica", () => {
    expect(NATURAL_CONVERSATION_GUIDELINES).toContain("primeira pessoa");
    expect(NATURAL_CONVERSATION_GUIDELINES).toContain("A Artgian Studio faz");
    expect(NATURAL_CONVERSATION_GUIDELINES).toContain("no máximo uma pergunta");
  });
});
