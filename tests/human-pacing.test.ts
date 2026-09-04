import { describe, expect, it } from "vitest";
import {
  getAutomaticReplyDelayMs,
  randomDelayFromEnvironment,
  randomInteger,
} from "../src/features/automation/human-pacing";

describe("cadência humana", () => {
  it("sorteia valores inclusivos sem sair do intervalo", () => {
    expect(randomInteger(10, 20, () => 0)).toBe(10);
    expect(randomInteger(10, 20, () => 0.999999)).toBe(20);
  });

  it("respeita os limites configurados para pausas", () => {
    const environment = { MIN_TEST: "4", MAX_TEST: "8" };
    expect(randomDelayFromEnvironment({
      minimumVariable: "MIN_TEST",
      maximumVariable: "MAX_TEST",
      defaultMinimum: 1,
      defaultMaximum: 2,
      absoluteMinimum: 0.25,
      absoluteMaximum: 30,
      unit: "seconds",
    }, environment, () => 0.5)).toBeGreaterThanOrEqual(4_000);
  });

  it("calcula leitura e composição dentro da janela de resposta", () => {
    const environment = {
      AUTO_REPLY_MIN_DELAY_SECONDS: "12",
      AUTO_REPLY_MAX_DELAY_SECONDS: "35",
    };
    const short = getAutomaticReplyDelayMs({
      inboundText: "Oi, tudo bem?",
      outboundText: "Oi! Tudo sim 😊 Como posso te ajudar?",
    }, environment, () => 0);
    const long = getAutomaticReplyDelayMs({
      inboundText: "Quero entender todos os detalhes desta peça personalizada para um presente especial.",
      outboundText: "x".repeat(800),
    }, environment, () => 0.999999);
    expect(short).toBe(12_000);
    expect(long).toBe(35_000);
  });
});
