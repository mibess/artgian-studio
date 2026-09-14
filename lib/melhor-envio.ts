import { digitsOnly, isValidCpf } from "./brazil";
import {
  configuredShippingServices,
  normalizePostalCode,
  normalizeQuote,
  providerErrorMessage,
  requiredEnvironmentVariable,
  ShippingConfigurationError,
  ShippingProviderError,
  validateShippingLines,
  type ProviderQuote,
  type ShippingLabelInput,
  type ShippingLine,
  type ShippingOption,
} from "./shipping-provider";

export {
  normalizePostalCode,
  ShippingConfigurationError,
  ShippingProviderError,
};
export type {
  ShippingOption,
  ShippingRecipient as SandboxLabelRecipient,
  ShippingVolume,
} from "./shipping-provider";

const API_URLS = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://melhorenvio.com.br",
} as const;

type MelhorEnvioEnvironment = keyof typeof API_URLS;

export function getMelhorEnvioEnvironment(): MelhorEnvioEnvironment {
  const environment = process.env.MELHOR_ENVIO_ENVIRONMENT?.trim() ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new ShippingConfigurationError(
      "MELHOR_ENVIO_ENVIRONMENT deve ser sandbox ou production.",
    );
  }
  return environment;
}

function requireSandboxForLabels() {
  if (getMelhorEnvioEnvironment() !== "sandbox") {
    throw new ShippingConfigurationError(
      "A compra de etiquetas está bloqueada fora do ambiente sandbox.",
    );
  }
}

async function melhorEnvioRequest<T>(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URLS[getMelhorEnvioEnvironment()]}${pathname}`, {
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

export async function calculateShipping(
  input: ShippingLine & { destinationPostalCode: string },
) {
  return calculateCartShipping({
    items: [input],
    destinationPostalCode: input.destinationPostalCode,
  });
}

export async function calculateCartShipping(input: {
  items: ShippingLine[];
  destinationPostalCode: string;
}) {
  validateShippingLines(input.items);

  const originPostalCode = normalizePostalCode(
    requiredEnvironmentVariable("MELHOR_ENVIO_ORIGIN_POSTAL_CODE"),
  );
  const destinationPostalCode = normalizePostalCode(
    input.destinationPostalCode,
  );
  const services = configuredShippingServices("MELHOR_ENVIO_SERVICES");
  if (originPostalCode.length !== 8) {
    throw new ShippingConfigurationError(
      "MELHOR_ENVIO_ORIGIN_POSTAL_CODE deve conter um CEP válido.",
    );
  }
  if (destinationPostalCode.length !== 8) {
    throw new ShippingProviderError("Informe um CEP válido.", 400);
  }

  const quotes = await melhorEnvioRequest<ProviderQuote[]>(
    "/api/v2/me/shipment/calculate",
    {
      method: "POST",
      body: JSON.stringify({
        from: { postal_code: originPostalCode },
        to: { postal_code: destinationPostalCode },
        services: services.value,
        products: input.items.map((item, index) => ({
          id: `${item.productId}-${index}`,
          width: item.package.widthCm,
          height: item.package.heightCm,
          length: item.package.lengthCm,
          weight: item.package.weightKg,
          insurance_value: item.unitPriceCents / 100,
          quantity: item.quantity,
        })),
        options: { receipt: false, own_hand: false },
      }),
    },
  );

  const options = quotes
    .map(normalizeQuote)
    .filter((option): option is ShippingOption => option !== null)
    .filter((option) => services.ids.has(option.serviceId))
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
  if (
    ![10, 11].includes(phone.length) ||
    postalCode.length !== 8 ||
    state.length !== 2
  ) {
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

export async function createAndPurchaseSandboxLabel(input: ShippingLabelInput) {
  requireSandboxForLabels();
  const service = Number(input.serviceId);
  if (
    !Number.isInteger(service) ||
    service <= 0 ||
    !isValidCpf(input.recipient.document)
  ) {
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
      products: input.products.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitary_value: item.unitPriceCents / 100,
      })),
      volumes: input.volumes,
      options: {
        platform: "Artgian Studio Sandbox",
        reminder: `Pedido ${input.orderId}`,
        insurance_value:
          input.products.reduce(
            (sum, item) => sum + item.unitPriceCents * item.quantity,
            0,
          ) / 100,
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
