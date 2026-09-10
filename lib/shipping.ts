import { cartSelections, type CartItem } from "./cart";
import { getProductSelection } from "./catalog";
import {
  calculateShipping,
  calculateCartShipping,
  ShippingConfigurationError,
  type ShippingOption,
} from "./melhor-envio";

export { ShippingConfigurationError };
export type { ShippingOption };

export async function quoteProductShipping(input: {
  productId?: string;
  color?: string;
  quantity?: number | string;
  personalization?: string;
  destinationPostalCode: string;
}) {
  const selection = getProductSelection(input);
  if (!selection) return null;

  if (!selection.product.shippingPackage) {
    throw new ShippingConfigurationError(
      `Peso e medidas da embalagem de ${selection.product.name} ainda não foram configurados.`,
    );
  }

  const options = await calculateShipping({
    destinationPostalCode: input.destinationPostalCode,
    package: selection.product.shippingPackage,
    productId: selection.productId,
    quantity: selection.quantity,
    unitPriceCents: selection.product.unitPriceCents,
  });

  return { selection, options };
}

export async function quoteCartShipping(
  items: CartItem[],
  destinationPostalCode: string,
) {
  const selections = cartSelections(items);
  const lines = selections.map((selection) => {
    if (!selection.product.shippingPackage)
      throw new ShippingConfigurationError(
        `Peso e medidas da embalagem de ${selection.product.name} ainda não foram configurados.`,
      );
    return {
      package: selection.product.shippingPackage,
      productId: selection.productId,
      quantity: selection.quantity,
      unitPriceCents: selection.product.unitPriceCents,
    };
  });
  return {
    selections,
    options: await calculateCartShipping({
      items: lines,
      destinationPostalCode,
    }),
  };
}
