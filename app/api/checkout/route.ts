import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders } from "../../../db/schema";
import { digitsOnly, isValidCpf } from "../../../lib/brazil";
import { getProductSelection } from "../../../lib/catalog";
import {
  createCheckoutPreference,
  getEnvironmentVariable,
} from "../../../lib/mercado-pago";
import {
  ShippingConfigurationError,
  ShippingProviderError,
} from "../../../lib/melhor-envio";
import { quoteProductShipping } from "../../../lib/shipping";

type CheckoutPayload = {
  productId?: string;
  color?: string;
  quantity?: number;
  personalization?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerDocument?: string;
  postalCode?: string;
  streetAddress?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  shippingServiceId?: string;
  shippingPriceCents?: number;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function resolveAppUrl(request: Request) {
  const configuredUrl = await getEnvironmentVariable("APP_URL");
  const url = new URL(configuredUrl || request.url);
  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname.endsWith(".local");

  if (isLocal) {
    throw new Error(
      "Configure APP_URL com a URL pública HTTPS da loja.",
    );
  }

  return url.origin;
}

export async function POST(request: Request) {
  let orderId: string | null = null;

  try {
    const payload = (await request.json()) as CheckoutPayload;
    const selection = getProductSelection({
      productId: clean(payload.productId, 80),
      color: clean(payload.color, 40),
      quantity: payload.quantity,
      personalization: clean(payload.personalization, 18),
    });

    if (!selection) {
      return Response.json({ error: "Produto inválido." }, { status: 400 });
    }

    const customerName = clean(payload.customerName, 120);
    const customerEmail = clean(payload.customerEmail, 180).toLowerCase();
    const customerPhone = digitsOnly(payload.customerPhone, 11);
    const customerDocument = digitsOnly(payload.customerDocument, 11);
    const postalCode = digitsOnly(payload.postalCode, 8);
    const streetAddress = clean(payload.streetAddress, 180);
    const addressNumber = clean(payload.addressNumber, 20);
    const addressComplement = clean(payload.addressComplement, 80);
    const neighborhood = clean(payload.neighborhood, 80);
    const city = clean(payload.city, 80);
    const state = clean(payload.state, 2).toUpperCase();
    const shippingServiceId = clean(payload.shippingServiceId, 40);
    const claimedShippingPriceCents = Number(payload.shippingPriceCents);

    if (
      !customerName ||
      !customerEmail.includes("@") ||
      ![10, 11].includes(customerPhone.length) ||
      !isValidCpf(customerDocument) ||
      postalCode.length !== 8 ||
      !streetAddress ||
      !addressNumber ||
      !neighborhood ||
      !city ||
      state.length !== 2
    ) {
      return Response.json(
        { error: "Preencha corretamente os dados pessoais e de entrega." },
        { status: 400 },
      );
    }

    if (
      !shippingServiceId ||
      !Number.isInteger(claimedShippingPriceCents) ||
      claimedShippingPriceCents <= 0
    ) {
      return Response.json(
        { error: "Calcule e escolha uma modalidade de entrega." },
        { status: 400 },
      );
    }

    const shippingQuote = await quoteProductShipping({
      productId: selection.productId,
      color: payload.color,
      quantity: selection.quantity,
      personalization: selection.personalization ?? undefined,
      destinationPostalCode: postalCode,
    });
    const shippingOption = shippingQuote?.options.find(
      (option) => option.serviceId === shippingServiceId,
    );

    if (!shippingOption) {
      return Response.json(
        { error: "A modalidade de entrega não está mais disponível. Calcule novamente." },
        { status: 409 },
      );
    }
    if (shippingOption.priceCents !== claimedShippingPriceCents) {
      return Response.json(
        { error: "O valor da entrega mudou. Calcule novamente antes de pagar." },
        { status: 409 },
      );
    }

    const appUrl = await resolveAppUrl(request);
    orderId = crypto.randomUUID();
    const db = await getDb();
    const totalCents = selection.subtotalCents + shippingOption.priceCents;
    const shippingQuotedAt = new Date().toISOString();

    await db.batch([
      db.insert(orders).values({
        id: orderId,
        status: "pending",
        customerName,
        customerEmail,
        customerPhone,
        customerDocument,
        postalCode,
        streetAddress,
        addressNumber,
        addressComplement: addressComplement || null,
        neighborhood,
        city,
        state,
        subtotalCents: selection.subtotalCents,
        shippingCents: shippingOption.priceCents,
        shippingProvider: "melhor_envio",
        shippingServiceId: shippingOption.serviceId,
        shippingServiceName: shippingOption.serviceName,
        shippingCompanyId: shippingOption.companyId,
        shippingCompanyName: shippingOption.companyName,
        shippingDeliveryTimeDays: shippingOption.deliveryTimeDays,
        shippingQuotedAt,
        totalCents,
      }),
      db.insert(orderItems).values({
        orderId,
        productId: selection.productId,
        productName: selection.product.name,
        color: selection.color,
        personalization: selection.personalization,
        quantity: selection.quantity,
        unitPriceCents: selection.product.unitPriceCents,
      }),
    ]);

    const { preference, checkoutUrl } = await createCheckoutPreference({
      orderId,
      productId: selection.productId,
      productName: selection.product.name,
      color: selection.color,
      personalization: selection.personalization,
      quantity: selection.quantity,
      unitPriceCents: selection.product.unitPriceCents,
      shippingCents: shippingOption.priceCents,
      customerName,
      customerEmail,
      customerPhone,
      postalCode,
      streetAddress,
      addressNumber,
      appUrl,
    });

    await db
      .update(orders)
      .set({
        mercadoPagoPreferenceId: preference.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    return Response.json({ checkoutUrl, orderId }, { status: 201 });
  } catch (error) {
    if (orderId) {
      try {
        await (await getDb())
          .update(orders)
          .set({
            status: "payment_setup_failed",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(orders.id, orderId));
      } catch {
        // Preserve the original integration error.
      }
    }

    if (error instanceof ShippingConfigurationError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof ShippingProviderError) {
      return Response.json(
        { error: "Não foi possível confirmar a entrega. Calcule novamente." },
        { status: 502 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível iniciar o pagamento.";
    return Response.json({ error: message }, { status: 500 });
  }
}
