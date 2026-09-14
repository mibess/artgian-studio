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

const API_URLS = {
  sandbox: "https://sandbox.superfrete.com",
  production: "https://api.superfrete.com",
} as const;

const MINIMUM_INSURANCE_VALUE = 25.63;

export type SuperFreteEnvironment = keyof typeof API_URLS;

export function getSuperFreteEnvironment(): SuperFreteEnvironment {
  const environment = process.env.SUPER_FRETE_ENVIRONMENT?.trim() ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new ShippingConfigurationError(
      "SUPER_FRETE_ENVIRONMENT deve ser sandbox ou production.",
    );
  }
  return environment;
}

function superFreteVariable(name: string, melhorEnvioFallback?: string) {
  return requiredEnvironmentVariable(name, melhorEnvioFallback);
}

async function superFreteRequest<T>(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URLS[getSuperFreteEnvironment()]}${pathname}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${requiredEnvironmentVariable("SUPER_FRETE_API_KEY")}`,
      "Content-Type": "application/json",
      "User-Agent": superFreteVariable(
        "SUPER_FRETE_USER_AGENT",
        "MELHOR_ENVIO_USER_AGENT",
      ),
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(12_000),
  });

  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      response.status === 401
        ? "A credencial do SuperFrete é inválida ou não possui a permissão necessária."
        : providerErrorMessage(payload) ||
          "O SuperFrete não conseguiu processar a solicitação.";
    throw new ShippingProviderError(message, response.status);
  }
  if (payload === null) {
    throw new ShippingProviderError(
      "O SuperFrete retornou uma resposta vazia.",
      502,
    );
  }
  return payload;
}

export async function calculateSuperFreteCartShipping(input: {
  items: ShippingLine[];
  destinationPostalCode: string;
}) {
  validateShippingLines(input.items);
  const originPostalCode = normalizePostalCode(
    superFreteVariable(
      "SUPER_FRETE_ORIGIN_POSTAL_CODE",
      "MELHOR_ENVIO_ORIGIN_POSTAL_CODE",
    ),
  );
  const destinationPostalCode = normalizePostalCode(
    input.destinationPostalCode,
  );
  const services = configuredShippingServices("SUPER_FRETE_SERVICES");
  if (originPostalCode.length !== 8) {
    throw new ShippingConfigurationError(
      "SUPER_FRETE_ORIGIN_POSTAL_CODE deve conter um CEP válido.",
    );
  }
  if (destinationPostalCode.length !== 8) {
    throw new ShippingProviderError("Informe um CEP válido.", 400);
  }

  const insuranceValue =
    input.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    ) / 100;
  const quotes = await superFreteRequest<ProviderQuote[]>(
    "/api/v0/calculator",
    {
      method: "POST",
      body: JSON.stringify({
        from: { postal_code: originPostalCode },
        to: { postal_code: destinationPostalCode },
        services: services.value,
        options: {
          own_hand: false,
          receipt: false,
          insurance_value: insuranceValue,
          use_insurance_value: insuranceValue >= MINIMUM_INSURANCE_VALUE,
        },
        products: input.items.map((item) => ({
          quantity: item.quantity,
          width: item.package.widthCm,
          height: item.package.heightCm,
          length: item.package.lengthCm,
          weight: item.package.weightKg,
        })),
      }),
    },
  );

  if (!Array.isArray(quotes)) {
    throw new ShippingProviderError(
      "O SuperFrete retornou uma cotação inválida.",
      502,
    );
  }
  const options = quotes
    .map(normalizeQuote)
    .filter((option): option is ShippingOption => option !== null)
    .filter((option) => services.ids.has(option.serviceId))
    .sort((left, right) => left.priceCents - right.priceCents);
  if (!options.length) {
    const providerMessage = quotes
      .map((quote) => quote.error?.trim())
      .find((message): message is string => Boolean(message));
    throw new ShippingProviderError(
      providerMessage ||
        "Não encontramos uma modalidade de entrega para esse CEP.",
      422,
    );
  }
  return options;
}

function senderVariable(name: string) {
  return superFreteVariable(
    `SUPER_FRETE_SENDER_${name}`,
    `MELHOR_ENVIO_SENDER_${name}`,
  );
}

function getSender() {
  const document = digitsOnly(senderVariable("DOCUMENT"), 11);
  const phone = digitsOnly(senderVariable("PHONE"), 11);
  const postalCode = normalizePostalCode(
    superFreteVariable(
      "SUPER_FRETE_ORIGIN_POSTAL_CODE",
      "MELHOR_ENVIO_ORIGIN_POSTAL_CODE",
    ),
  );
  const state = senderVariable("STATE").toUpperCase().slice(0, 2);
  if (!isValidCpf(document)) {
    throw new ShippingConfigurationError(
      "SUPER_FRETE_SENDER_DOCUMENT deve conter um CPF válido.",
    );
  }
  if (
    ![10, 11].includes(phone.length) ||
    postalCode.length !== 8 ||
    state.length !== 2
  ) {
    throw new ShippingConfigurationError(
      "Telefone, CEP ou UF do remetente do SuperFrete estão inválidos.",
    );
  }

  return {
    name: senderVariable("NAME"),
    email: senderVariable("EMAIL"),
    phone,
    document,
    address: senderVariable("ADDRESS"),
    complement:
      process.env.SUPER_FRETE_SENDER_COMPLEMENT?.trim() ||
      process.env.MELHOR_ENVIO_SENDER_COMPLEMENT?.trim() ||
      "",
    number: senderVariable("NUMBER"),
    district: senderVariable("DISTRICT"),
    city: senderVariable("CITY"),
    state_abbr: state,
    country_id: "BR",
    postal_code: postalCode,
  };
}

export async function createAndPurchaseSuperFreteLabel(
  input: ShippingLabelInput,
) {
  const service = Number(input.serviceId);
  if (
    !Number.isInteger(service) ||
    service <= 0 ||
    !isValidCpf(input.recipient.document) ||
    !input.volumes.length
  ) {
    throw new ShippingConfigurationError(
      "Serviço, pacote ou CPF do destinatário inválido.",
    );
  }

  const created = await superFreteRequest<{
    id?: string;
    status?: string;
  }>("/api/v0/cart", {
    method: "POST",
    body: JSON.stringify({
      service,
      from: getSender(),
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
      volumes: input.volumes[0],
      options: {
        insurance_value:
          input.products.reduce(
            (sum, item) => sum + item.unitPriceCents * item.quantity,
            0,
          ) / 100,
        receipt: false,
        own_hand: false,
        non_commercial: true,
        tags: [{ tag: input.orderId, url: null }],
      },
      platform: "Artgian Studio",
    }),
  });
  if (!created.id) {
    throw new ShippingProviderError(
      "O SuperFrete não retornou o identificador da etiqueta.",
      502,
    );
  }

  const checkout = await superFreteRequest<{ success?: boolean }>(
    "/api/v0/checkout",
    {
      method: "POST",
      body: JSON.stringify({ orders: [created.id] }),
    },
  );
  if (checkout.success !== true) {
    throw new ShippingProviderError(
      "O SuperFrete não confirmou a compra da etiqueta.",
      502,
    );
  }
  return created.id;
}

export async function printSuperFreteLabel(labelId: string) {
  const printed = await superFreteRequest<{ url?: string }>(
    "/api/v0/tag/print",
    {
      method: "POST",
      body: JSON.stringify({ orders: [labelId] }),
    },
  );
  if (!printed.url) {
    throw new ShippingProviderError(
      "O SuperFrete não retornou o link da etiqueta.",
      502,
    );
  }
  return printed.url;
}
