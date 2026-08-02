import { digitsOnly, isValidCpf } from "./brazil";
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
  packages?: Array<{
    weight?: string | number;
    dimensions?: {
      height?: number;
      width?: number;
      length?: number;
    };
  }>;
};

export type ShippingVolume = {
  height: number;
  width: number;
  length: number;
  weight: number;
};

export type ShippingOption = {
  serviceId: string;
  serviceName: string;
  companyId: string | null;
  companyName: string;
  priceCents: number;
  deliveryTimeDays: number;
  volumes: ShippingVolume[];
};

export type SandboxLabelRecipient = {
  name: string;
  email: string;
  phone: string;
  document: string;
  address: string;
  complement: string | null;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
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

function requireSandboxForLabels() {
  if (getEnvironment() !== "sandbox") {
    throw new ShippingConfigurationError(
      "A compra de etiquetas está bloqueada fora do ambiente sandbox.",
    );
  }
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

function parseVolume(
  value: NonNullable<MelhorEnvioQuote["packages"]>[number],
): ShippingVolume | null {
  const volume = {
    height: Number(value.dimensions?.height),
    width: Number(value.dimensions?.width),
    length: Number(value.dimensions?.length),
    weight: Number(value.weight),
  };
  return Object.values(volume).every(
    (item) => Number.isFinite(item) && item > 0,
  )
    ? volume
    : null;
}

function normalizeQuote(quote: MelhorEnvioQuote): ShippingOption | null {
  if (quote.error || quote.id === undefined) return null;

  const priceCents = parsePriceInCents(quote.custom_price ?? quote.price);
  const deliveryTimeDays =
    quote.custom_delivery_time ?? quote.delivery_time ?? 0;
  const volumes = (quote.packages ?? [])
    .map(parseVolume)
    .filter((volume): volume is ShippingVolume => volume !== null);

  if (!priceCents || !Number.isFinite(deliveryTimeDays) || volumes.length === 0) {
    return null;
  }

  return {
    serviceId: String(quote.id),
    serviceName: quote.name?.trim() || "Entrega",
    companyId:
      quote.company?.id === undefined ? null : String(quote.company.id),
    companyName: quote.company?.name?.trim() || "Transportadora",
    priceCents,
    deliveryTimeDays: Math.max(0, Math.trunc(deliveryTimeDays)),
    volumes,
  };
}

function providerErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as {
    message?: unknown;
    error?: unknown;
    errors?: Record<string, unknown>;
  };
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message.trim();
  }
  if (typeof candidate.error === "string" && candidate.error.trim()) {
    return candidate.error.trim();
  }
  if (candidate.errors) {
    const firstError = Object.values(candidate.errors).flat().find(Boolean);
    if (typeof firstError === "string") return firstError;
  }
  return null;
}

async function melhorEnvioRequest<T>(
  pathname: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${API_URLS[getEnvironment()]}${pathname}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${requiredEnvironmentVariable("MELHOR_ENVIO_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      "User-Agent": requiredEnvironmentVariable("MELHOR_ENVIO_USER_AGENT"),
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(12_000),
  });

  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      response.status === 401
        ? "A credencial do Melhor Envio é inválida ou não possui a permissão necessária."
        : providerErrorMessage(payload) ||
          "O Melhor Envio não conseguiu processar a solicitação.";
    throw new ShippingProviderError(message, response.status);
  }
  if (payload === null) {
    throw new ShippingProviderError(
      "O Melhor Envio retornou uma resposta vazia.",
      502,
    );
  }
  return payload;
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

  const quotes = await melhorEnvioRequest<MelhorEnvioQuote[]>(
    "/api/v2/me/shipment/calculate",
    {
      method: "POST",
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
        options: { receipt: false, own_hand: false },
      }),
    },
  );

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

function getSandboxSender() {
  requireSandboxForLabels();
  const document = digitsOnly(
    requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_DOCUMENT"),
    11,
  );
  const phone = digitsOnly(
    requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_PHONE"),
    11,
  );
  const postalCode = normalizePostalCode(
    requiredEnvironmentVariable("MELHOR_ENVIO_ORIGIN_POSTAL_CODE"),
  );
  const state = requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_STATE")
    .toUpperCase()
    .slice(0, 2);
  if (!isValidCpf(document)) {
    throw new ShippingConfigurationError(
      "MELHOR_ENVIO_SENDER_DOCUMENT deve conter um CPF válido.",
    );
  }
  if (![10, 11].includes(phone.length) || postalCode.length !== 8 || state.length !== 2) {
    throw new ShippingConfigurationError(
      "Telefone, CEP ou UF do remetente estão inválidos.",
    );
  }

  return {
    name: requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_NAME"),
    email: requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_EMAIL"),
    phone,
    document,
    address: requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_ADDRESS"),
    complement: process.env.MELHOR_ENVIO_SENDER_COMPLEMENT?.trim() || "",
    number: requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_NUMBER"),
    district: requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_DISTRICT"),
    city: requiredEnvironmentVariable("MELHOR_ENVIO_SENDER_CITY"),
    state_abbr: state,
    country_id: "BR",
    postal_code: postalCode,
  };
}

export async function createAndPurchaseSandboxLabel(input: {
  orderId: string;
  serviceId: string;
  recipient: SandboxLabelRecipient;
  product: {
    name: string;
    quantity: number;
    unitPriceCents: number;
  };
  volumes: ShippingVolume[];
}) {
  requireSandboxForLabels();
  const service = Number(input.serviceId);
  if (!Number.isInteger(service) || service <= 0 || !isValidCpf(input.recipient.document)) {
    throw new ShippingConfigurationError(
      "Serviço de entrega ou CPF do destinatário inválido.",
    );
  }

  const created = await melhorEnvioRequest<{ id?: string }>("/api/v2/me/cart", {
    method: "POST",
    body: JSON.stringify({
      service,
      from: getSandboxSender(),
      to: {
        name: input.recipient.name,
        email: input.recipient.email,
        phone: digitsOnly(input.recipient.phone, 11),
        document: digitsOnly(input.recipient.document, 11),
        address: input.recipient.address,
        complement: input.recipient.complement || "",
        number: input.recipient.number,
        district: input.recipient.district,
        city: input.recipient.city,
        state_abbr: input.recipient.state,
        country_id: "BR",
        postal_code: normalizePostalCode(input.recipient.postalCode),
      },
      products: [
        {
          name: input.product.name,
          quantity: input.product.quantity,
          unitary_value: input.product.unitPriceCents / 100,
        },
      ],
      volumes: input.volumes,
      options: {
        platform: "Artgian Studio Sandbox",
        reminder: `Pedido ${input.orderId}`,
        insurance_value:
          (input.product.unitPriceCents * input.product.quantity) / 100,
        receipt: false,
        own_hand: false,
        reverse: false,
        tags: [{ tag: input.orderId, url: null }],
      },
    }),
  });
  if (!created.id) {
    throw new ShippingProviderError(
      "O Melhor Envio não retornou o identificador da etiqueta.",
      502,
    );
  }

  await melhorEnvioRequest<unknown>("/api/v2/me/shipment/checkout", {
    method: "POST",
    body: JSON.stringify({ orders: [created.id] }),
  });
  return created.id;
}

export async function generateAndPrintSandboxLabel(labelId: string) {
  requireSandboxForLabels();
  await melhorEnvioRequest<unknown>("/api/v2/me/shipment/generate", {
    method: "POST",
    body: JSON.stringify({ orders: [labelId] }),
  });
  const printed = await melhorEnvioRequest<{ url?: string }>(
    "/api/v2/me/shipment/print",
    {
      method: "POST",
      body: JSON.stringify({ mode: "private", orders: [labelId] }),
    },
  );
  if (!printed.url) {
    throw new ShippingProviderError(
      "O Melhor Envio não retornou o link da etiqueta.",
      502,
    );
  }
  return printed.url;
}
