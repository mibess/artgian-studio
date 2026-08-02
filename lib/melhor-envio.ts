import type { ShippingPackage } from "./catalog";

const API_URLS = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://melhorenvio.com.br",
} as const;

type MelhorEnvioEnvironment = keyof typeof API_URLS;

type MelhorEnvioQuote = {
  id?: number | string;
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: {
    id?: number | string;
    name?: string;
  };
};

export type ShippingOption = {
  serviceId: string;
  serviceName: string;
  companyId: string | null;
  companyName: string;
  priceCents: number;
  deliveryTimeDays: number;
};

export class ShippingConfigurationError extends Error {}

export class ShippingProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ShippingConfigurationError(
      `A variável ${name} não está configurada.`,
    );
  }
  return value;
}

function getEnvironment(): MelhorEnvioEnvironment {
  const environment = process.env.MELHOR_ENVIO_ENVIRONMENT?.trim() ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new ShippingConfigurationError(
      "MELHOR_ENVIO_ENVIRONMENT deve ser sandbox ou production.",
    );
  }
  return environment;
}

export function normalizePostalCode(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 8) : "";
}

function parsePriceInCents(value: string | undefined) {
  if (!value) return null;
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function normalizeQuote(quote: MelhorEnvioQuote): ShippingOption | null {
  if (quote.error || quote.id === undefined) return null;

  const priceCents = parsePriceInCents(quote.custom_price ?? quote.price);
  const deliveryTimeDays =
    quote.custom_delivery_time ?? quote.delivery_time ?? 0;

  if (!priceCents || !Number.isFinite(deliveryTimeDays)) return null;

  return {
    serviceId: String(quote.id),
    serviceName: quote.name?.trim() || "Entrega",
    companyId:
      quote.company?.id === undefined ? null : String(quote.company.id),
    companyName: quote.company?.name?.trim() || "Transportadora",
    priceCents,
    deliveryTimeDays: Math.max(0, Math.trunc(deliveryTimeDays)),
  };
}

export async function calculateShipping(input: {
  destinationPostalCode: string;
  package: ShippingPackage;
  productId: string;
  quantity: number;
  unitPriceCents: number;
}) {
  const packageValues = [
    input.package.widthCm,
    input.package.heightCm,
    input.package.lengthCm,
    input.package.weightKg,
  ];
  if (packageValues.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new ShippingConfigurationError(
      "As medidas e o peso da embalagem devem ser maiores que zero.",
    );
  }

  const originPostalCode = normalizePostalCode(
    requiredEnvironmentVariable("MELHOR_ENVIO_ORIGIN_POSTAL_CODE"),
  );
  const destinationPostalCode = normalizePostalCode(input.destinationPostalCode);

  if (originPostalCode.length !== 8) {
    throw new ShippingConfigurationError(
      "MELHOR_ENVIO_ORIGIN_POSTAL_CODE deve conter um CEP válido.",
    );
  }
  if (destinationPostalCode.length !== 8) {
    throw new ShippingProviderError("Informe um CEP válido.", 400);
  }

  const response = await fetch(
    `${API_URLS[getEnvironment()]}/api/v2/me/shipment/calculate`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requiredEnvironmentVariable("MELHOR_ENVIO_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
        "User-Agent": requiredEnvironmentVariable("MELHOR_ENVIO_USER_AGENT"),
      },
      body: JSON.stringify({
        from: { postal_code: originPostalCode },
        to: { postal_code: destinationPostalCode },
        products: [
          {
            id: input.productId,
            width: input.package.widthCm,
            height: input.package.heightCm,
            length: input.package.lengthCm,
            weight: input.package.weightKg,
            insurance_value: input.unitPriceCents / 100,
            quantity: input.quantity,
          },
        ],
        options: {
          receipt: false,
          own_hand: false,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    const providerMessage = payload?.message?.trim();
    const message =
      response.status === 401
        ? "A credencial do Melhor Envio é inválida ou expirou."
        : providerMessage || "O Melhor Envio não conseguiu calcular o frete.";
    throw new ShippingProviderError(message, response.status);
  }

  const quotes = (await response.json()) as MelhorEnvioQuote[];
  const options = quotes
    .map(normalizeQuote)
    .filter((option): option is ShippingOption => option !== null)
    .sort((left, right) => left.priceCents - right.priceCents);

  if (options.length === 0) {
    throw new ShippingProviderError(
      "Não encontramos uma modalidade de entrega para esse CEP.",
      422,
    );
  }

  return options;
}
