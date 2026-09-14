import type { ShippingPackage } from "./catalog";

export const SHIPPING_PROVIDERS = ["melhor_envio", "super_frete"] as const;

export type ShippingProvider = (typeof SHIPPING_PROVIDERS)[number];

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

export type ShippingRecipient = {
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

export type ShippingLine = {
  package: ShippingPackage;
  productId: string;
  quantity: number;
  unitPriceCents: number;
};

export type ShippingLabelInput = {
  orderId: string;
  serviceId: string;
  recipient: ShippingRecipient;
  products: {
    name: string;
    quantity: number;
    unitPriceCents: number;
  }[];
  volumes: ShippingVolume[];
};

export type ProviderQuote = {
  id?: number | string;
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  has_error?: boolean;
  company?: {
    id?: number | string;
    name?: string;
  };
  packages?: Array<{
    weight?: string | number;
    dimensions?: {
      height?: string | number;
      width?: string | number;
      length?: string | number;
    };
  }>;
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

export function requiredEnvironmentVariable(name: string, fallback?: string) {
  const value = process.env[name]?.trim() ||
    (fallback ? process.env[fallback]?.trim() : "");
  if (!value) {
    const description = fallback ? `${name} (ou ${fallback})` : name;
    throw new ShippingConfigurationError(
      `A variável ${description} não está configurada.`,
    );
  }
  return value;
}

export function configuredShippingServices(name: string) {
  const value = process.env[name]?.trim() || "1,2,17";
  if (!/^\d+(,\d+)*$/.test(value)) {
    throw new ShippingConfigurationError(
      `${name} deve conter códigos de serviço separados por vírgula.`,
    );
  }
  return {
    value,
    ids: new Set(value.split(",")),
  };
}

export function normalizePostalCode(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 8) : "";
}

function parsePriceInCents(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function parseVolume(
  value: NonNullable<ProviderQuote["packages"]>[number],
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

export function normalizeQuote(quote: ProviderQuote): ShippingOption | null {
  if (quote.error || quote.has_error || quote.id === undefined) return null;

  const priceCents = parsePriceInCents(quote.custom_price ?? quote.price);
  const deliveryTimeDays =
    quote.custom_delivery_time ?? quote.delivery_time ?? 0;
  const volumes = (quote.packages ?? [])
    .map(parseVolume)
    .filter((volume): volume is ShippingVolume => volume !== null);

  if (
    !priceCents ||
    !Number.isFinite(deliveryTimeDays) ||
    volumes.length === 0
  ) {
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

export function providerErrorMessage(payload: unknown) {
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

export function validateShippingLines(items: ShippingLine[]) {
  if (!items.length)
    throw new ShippingProviderError("O carrinho está vazio.", 400);
  for (const item of items) {
    const values = [
      item.package.widthCm,
      item.package.heightCm,
      item.package.lengthCm,
      item.package.weightKg,
    ];
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new ShippingConfigurationError(
        "As medidas e o peso da embalagem devem ser maiores que zero.",
      );
    }
  }
}
