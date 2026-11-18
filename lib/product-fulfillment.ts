import type { Product } from "./catalog";

type FulfillmentProduct = Pick<Product, "fulfillment" | "productionTime">;

export function businessDays(days: number) {
  return `${days} ${days === 1 ? "dia útil" : "dias úteis"}`;
}

export function fulfillmentSummary(product: FulfillmentProduct) {
  if (!product.fulfillment) {
    return {
      label: "Prazo a confirmar",
      detail: product.productionTime?.trim() || "Consulte a Artgian sobre o prazo para envio antes de comprar.",
      readyToShip: null,
    };
  }
  const { readyToShip, preparationDays } = product.fulfillment;
  return {
    label: readyToShip ? "Pronta entrega" : "Sob encomenda",
    detail: preparationDays === 0
      ? "Pronto para envio após a confirmação do pagamento."
      : `Envio em até ${businessDays(preparationDays)} após a confirmação do pagamento.`,
    readyToShip,
  };
}

/** Keep decorative template copy, replacing only old availability labels. */
export function productAvailabilityCaption(product: Product) {
  const caption = product.presentation.copy.text005?.value;
  if (product.fulfillment && caption && /^(?:sob encomenda|produ[çc][ãa]o sob encomenda|pronta entrega|pronto entrega)$/i.test(caption.trim())) {
    return fulfillmentSummary(product).label;
  }
  return caption;
}

/** A single shipment waits for the slowest piece. Unknown is never zero. */
export function preparationDaysForProducts(products: Pick<Product, "fulfillment">[]): number | null {
  if (!products.length || products.some((product) => !product.fulfillment)) return null;
  return Math.max(...products.map((product) => product.fulfillment!.preparationDays));
}

export function deliveryEstimate(preparationDays: number | null, transitDays: number) {
  if (preparationDays === null) {
    return {
      label: `Transporte: até ${businessDays(transitDays)} após a postagem`,
      detail: "O prazo para preparar o pedido ainda precisa ser confirmado com a Artgian e não está incluído nesta estimativa.",
    };
  }
  return {
    label: `Entrega estimada em até ${businessDays(preparationDays + transitDays)}`,
    detail: `${preparationDays === 0 ? "Sem prazo adicional de preparação" : `${businessDays(preparationDays)} de preparação`} + ${businessDays(transitDays)} de transporte, após a confirmação do pagamento.`,
  };
}

export function preparationSummary(products: Pick<Product, "fulfillment">[]) {
  const days = preparationDaysForProducts(products);
  if (days === null) return "Confirme com a Artgian o prazo de preparação dos itens sem prazo informado.";
  const timing = days === 0 ? "Pedido pronto para envio" : `Envio em até ${businessDays(days)}`;
  return `${timing} após a confirmação do pagamento.${products.length > 1 ? " As peças serão enviadas juntas, considerando o maior prazo de preparação." : ""}`;
}
