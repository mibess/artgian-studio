import { getProductSelection } from "./catalog";
import {
  calculateShipping,
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
