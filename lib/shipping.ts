import { getProductCatalog } from "./products/repository";
import { cartSelections, type CartItem } from "./cart";
import { getProductSelection, type ProductCatalog } from "./catalog";
import {
  calculateCartShipping as calculateMelhorEnvioCartShipping,
  createAndPurchaseSandboxLabel,
  generateAndPrintSandboxLabel,
  getMelhorEnvioEnvironment,
} from "./melhor-envio";
import {
  createAndPurchaseSuperFreteLabel,
  calculateSuperFreteCartShipping,
  getSuperFreteEnvironment,
  printSuperFreteLabel,
} from "./super-frete";
import {
  SHIPPING_PROVIDERS,
  ShippingConfigurationError,
  ShippingProviderError,
  normalizePostalCode,
  type ShippingLabelInput,
  type ShippingLine,
  type ShippingOption,
  type ShippingProvider,
} from "./shipping-provider";

export {
  normalizePostalCode,
  ShippingConfigurationError,
  ShippingProviderError,
};
export type { ShippingOption, ShippingProvider };

const PROVIDER_NAMES: Record<ShippingProvider, string> = {
  melhor_envio: "Melhor Envio",
  super_frete: "SuperFrete",
};

// Brodowski/SP has street-specific CEPs within this range. Confirm the locality
// before granting free shipping so an unassigned CEP cannot receive the offer.
async function isBrodowskiPostalCode(postalCode: string) {
  const normalized = normalizePostalCode(postalCode);
  if (!/^1434\d{4}$/.test(normalized)) return false;

  let response: Response;
  try {
    response = await fetch(`https://viacep.com.br/ws/${normalized}/json/`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    });
  } catch {
    throw new ShippingProviderError("Não foi possível confirmar o CEP. Tente novamente.", 503);
  }
  if (!response.ok)
    throw new ShippingProviderError("Não foi possível confirmar o CEP. Tente novamente.", 503);
  const address = await response.json() as { cep?: unknown; localidade?: unknown; uf?: unknown; erro?: unknown };
  return address.erro !== true && address.erro !== "true" &&
    normalizePostalCode(address.cep) === normalized &&
    address.localidade === "Brodowski" && address.uf === "SP";
}

async function applyFreeShipping(postalCode: string, options: ShippingOption[]) {
  if (!await isBrodowskiPostalCode(postalCode)) return options;
  return options.map(option => ({ ...option, priceCents: 0 }));
}

export function getConfiguredShippingProvider(): ShippingProvider {
  const provider = process.env.SHIPPING_PROVIDER?.trim() || "melhor_envio";
  if (!SHIPPING_PROVIDERS.includes(provider as ShippingProvider)) {
    throw new ShippingConfigurationError(
      "SHIPPING_PROVIDER deve ser melhor_envio ou super_frete.",
    );
  }
  return provider as ShippingProvider;
}

export function resolveShippingProvider(value: unknown): ShippingProvider {
  if (typeof value === "string" && SHIPPING_PROVIDERS.includes(value as ShippingProvider)) {
    return value as ShippingProvider;
  }
  // Pedidos anteriores à seleção de provedor foram cotados no Melhor Envio.
  if (value === null || value === undefined || value === "") return "melhor_envio";
  throw new ShippingConfigurationError("O provedor de frete do pedido é inválido.");
}

export function shippingProviderName(provider: ShippingProvider) {
  return PROVIDER_NAMES[provider];
}

export function getShippingProviderEnvironment(provider: ShippingProvider) {
  return provider === "super_frete"
    ? getSuperFreteEnvironment()
    : getMelhorEnvioEnvironment();
}

export async function calculateProviderCartShipping(
  input: { items: ShippingLine[]; destinationPostalCode: string },
  provider = getConfiguredShippingProvider(),
) {
  return provider === "super_frete"
    ? calculateSuperFreteCartShipping(input)
    : calculateMelhorEnvioCartShipping(input);
}

export async function createAndPurchaseShippingLabel(
  provider: ShippingProvider,
  input: ShippingLabelInput,
) {
  return provider === "super_frete"
    ? createAndPurchaseSuperFreteLabel(input)
    : createAndPurchaseSandboxLabel(input);
}

export async function generateAndPrintShippingLabel(
  provider: ShippingProvider,
  labelId: string,
) {
  return provider === "super_frete"
    ? printSuperFreteLabel(labelId)
    : generateAndPrintSandboxLabel(labelId);
}

export async function quoteProductShipping(input: {
  productId?: string;
  color?: string;
  quantity?: number | string;
  personalization?: string;
  destinationPostalCode: string;
}) {
  const selection = getProductSelection(input, await getProductCatalog());
  if (!selection) return null;

  if (!selection.product.shippingPackage) {
    throw new ShippingConfigurationError(
      `Peso e medidas da embalagem de ${selection.product.name} ainda não foram configurados.`,
    );
  }

  const provider = getConfiguredShippingProvider();
  const options = await calculateProviderCartShipping(
    {
      destinationPostalCode: input.destinationPostalCode,
      items: [
        {
          package: selection.product.shippingPackage,
          productId: selection.productId,
          quantity: selection.quantity,
          unitPriceCents: selection.product.unitPriceCents,
        },
      ],
    },
    provider,
  );

  return { provider, selection, options: await applyFreeShipping(input.destinationPostalCode, options) };
}

export async function quoteCartShipping(
  items: CartItem[],
  destinationPostalCode: string,
  catalog?: ProductCatalog,
) {
  const selections = cartSelections(items, catalog ?? await getProductCatalog());
  if (selections.some(item => !item)) throw new ShippingConfigurationError("Há produtos indisponíveis no carrinho.");
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
  const provider = getConfiguredShippingProvider();
  const options = await calculateProviderCartShipping(
    { items: lines, destinationPostalCode },
    provider,
  );
  return {
    provider,
    selections,
    options: await applyFreeShipping(destinationPostalCode, options),
  };
}
