import { describe, expect, it } from "vitest";
import { customOrderMessage, isCustomPieceType, whatsappHref } from "../lib/custom-order";

const base = { type: "" as const, idea: "", customizations: [], quantity: 1, neededBy: "", name: "" };

describe("pedido personalizado", () => {
  it("monta só as linhas preenchidas", () => {
    expect(customOrderMessage({ ...base, idea: "  Chaveiro com nome  " })).toBe(
      "Olá, Artgian! Quero um orçamento para uma peça personalizada.\n\n• Ideia: Chaveiro com nome",
    );
  });

  it("inclui tipo, personalização, quantidade, data e nome", () => {
    const message = customOrderMessage({
      type: "festa",
      idea: "Lembrancinhas de dinossauro",
      customizations: ["Texto ou nome", "Cores"],
      quantity: 30,
      neededBy: "2026-12-20",
      name: "Ana",
    });
    expect(message).toContain("• Tipo: Lembrancinhas e datas especiais");
    expect(message).toContain("• Personalizar: Texto ou nome, Cores");
    expect(message).toContain("• Quantidade: 30");
    expect(message).toContain("• Preciso para: 20/12/2026");
    expect(message).toContain("• Meu nome: Ana");
  });

  it("gera o link do WhatsApp com o texto codificado", () => {
    expect(whatsappHref("Olá & até já")).toBe("https://wa.me/5516997432741?text=Ol%C3%A1%20%26%20at%C3%A9%20j%C3%A1");
  });

  it("aceita só tipos conhecidos vindos da URL", () => {
    expect(isCustomPieceType("miniatura")).toBe(true);
    expect(isCustomPieceType("<script>")).toBe(false);
  });
});
