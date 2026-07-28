const API_BASE_URL = "https://api.mercadopago.com";

export type MercadoPagoPreference = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount: number;
  currency_id: string;
  date_last_updated?: string;
};

export async function getEnvironmentVariable(name: string) {
  try {
    const { env } = await import("cloudflare:workers");
    const binding = env[name];
    if (typeof binding === "string" && binding.trim()) {
      return binding.trim();
    }
  } catch {
    // Fall back to process.env when running in a native Node.js environment.
  }

  return process.env[name]?.trim() || undefined;
}

async function getRequiredEnv(name: string) {
  const value = await getEnvironmentVariable(name);
  if (!value) {
    throw new Error(`A variável ${name} não está configurada.`);
  }
  return value;
}

async function getAccessToken() {
  return getRequiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
}

async function mercadoPagoRequest<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Mercado Pago respondeu ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  return (await response.json()) as T;
}

export async function createCheckoutPreference(input: {
  orderId: string;
  productId: string;
  productName: string;
  color: string;
  personalization: string | null;
  quantity: number;
  unitPriceCents: number;
  shippingCents: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  postalCode: string;
  streetAddress: string;
  addressNumber: string;
  appUrl: string;
}) {
  const description = [
    input.color,
    input.personalization ? `Personalização: ${input.personalization}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const preference = await mercadoPagoRequest<MercadoPagoPreference>(
    "/checkout/preferences",
    {
      method: "POST",
      headers: {
        "X-Idempotency-Key": input.orderId,
      },
      body: JSON.stringify({
        items: [
          {
            id: input.productId,
            title: input.productName,
            description,
            currency_id: "BRL",
            quantity: input.quantity,
            unit_price: input.unitPriceCents / 100,
          },
        ],
        shipments: {
          cost: input.shippingCents / 100,
          mode: "not_specified",
        },
        payer: {
          name: input.customerName,
          email: input.customerEmail,
          phone: {
            number: input.customerPhone,
          },
          address: {
            zip_code: input.postalCode,
            street_name: input.streetAddress,
            street_number: input.addressNumber,
          },
        },
        external_reference: input.orderId,
        metadata: {
          order_id: input.orderId,
        },
        back_urls: {
          success: `${input.appUrl}/comprar/sucesso?pedido=${input.orderId}`,
          pending: `${input.appUrl}/comprar/pendente?pedido=${input.orderId}`,
          failure: `${input.appUrl}/comprar/falha?pedido=${input.orderId}`,
        },
        auto_return: "approved",
        notification_url: `${input.appUrl}/api/mercado-pago/webhook`,
        statement_descriptor: "ARTGIAN STUDIO",
      }),
    },
  );

  const environment =
    (await getEnvironmentVariable("MERCADO_PAGO_ENVIRONMENT")) ?? "test";
  const checkoutUrl =
    environment === "production"
      ? preference.init_point
      : preference.sandbox_init_point ?? preference.init_point;

  return { preference, checkoutUrl };
}

export function getPayment(paymentId: string) {
  return mercadoPagoRequest<MercadoPagoPayment>(
    `/v1/payments/${encodeURIComponent(paymentId)}`,
  );
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function validateWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}) {
  const secret = await getRequiredEnv("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!input.xSignature || !input.xRequestId) return false;

  const signatureParts = Object.fromEntries(
    input.xSignature.split(",").map((part) => {
      const [key, value] = part.trim().split("=", 2);
      return [key, value];
    }),
  );
  const timestamp = signatureParts.ts;
  const receivedHash = signatureParts.v1;
  if (!timestamp || !receivedHash) return false;

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.xRequestId};ts:${timestamp};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest),
  );
  const expectedHash = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expectedHash, receivedHash);
}

export function mapPaymentStatus(status: string) {
  switch (status) {
    case "approved":
      return "paid";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    case "charged_back":
      return "charged_back";
    default:
      return "pending";
  }
}
