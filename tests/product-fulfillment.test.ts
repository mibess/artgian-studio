import { describe, expect, it } from "vitest";
import { businessDays, deliveryEstimate, fulfillmentSummary, preparationDaysForProducts, preparationSummary } from "../lib/product-fulfillment";

describe("prazos de preparação e transporte", () => {
  it("nunca transforma prazo desconhecido ou texto legado em pronta entrega ou zero dias", () => {
    expect(fulfillmentSummary({ productionTime: null }).label).toBe("Prazo a confirmar");
    expect(fulfillmentSummary({ productionTime: "5 dias, sujeito à confirmação" }).detail).toContain("sujeito à confirmação");
    expect(preparationDaysForProducts([])).toBeNull();
    expect(preparationDaysForProducts([{ fulfillment: { readyToShip: true, preparationDays: 1 } }, {}])).toBeNull();
    expect(deliveryEstimate(null, 3).label).toBe("Transporte: até 3 dias úteis após a postagem");
    expect(deliveryEstimate(null, 3).detail).toContain("não está incluído");
  });

  it("mantém prazo de despacho também para pronta entrega e trata singular", () => {
    const summary = fulfillmentSummary({ productionTime: null, fulfillment: { readyToShip: true, preparationDays: 1 } });
    expect(summary.label).toBe("Pronta entrega");
    expect(summary.detail).toBe("Envio em até 1 dia útil após a confirmação do pagamento.");
    expect(businessDays(1)).toBe("1 dia útil");
    expect(fulfillmentSummary({ productionTime: null, fulfillment: { readyToShip: false, preparationDays: 5 } }).label).toBe("Sob encomenda");
  });

  it("usa o maior preparo no envio conjunto e soma transporte uma única vez", () => {
    const products = [
      { fulfillment: { readyToShip: true, preparationDays: 1 } },
      { fulfillment: { readyToShip: false, preparationDays: 5 } },
      { fulfillment: { readyToShip: false, preparationDays: 3 } },
    ];
    const preparation = preparationDaysForProducts(products);
    expect(preparation).toBe(5);
    expect(deliveryEstimate(preparation, 2)).toEqual({
      label: "Entrega estimada em até 7 dias úteis",
      detail: "5 dias úteis de preparação + 2 dias úteis de transporte, após a confirmação do pagamento.",
    });
    expect(preparationSummary(products)).toContain("enviadas juntas");
  });

  it("zero só significa ausência explícita de preparo, e não prazo desconhecido", () => {
    const products = [{ fulfillment: { readyToShip: true, preparationDays: 0 } }];
    expect(preparationDaysForProducts(products)).toBe(0);
    expect(deliveryEstimate(0, 1).label).toBe("Entrega estimada em até 1 dia útil");
    expect(deliveryEstimate(0, 1).detail).toContain("Sem prazo adicional de preparação");
  });
});
