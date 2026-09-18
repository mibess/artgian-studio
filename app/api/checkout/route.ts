import { AddressError, getAddress, saveAddress } from "../../../lib/addresses/repository";
import { addressSchema } from "../../../lib/addresses/schema";
import { getProductCatalog } from "../../../lib/products/repository";
import { requestOrigin } from "../../../lib/request-origin";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orders } from "../../../db/schema";
import { createOrReuseCheckoutOrder, saveCheckoutPreference } from "../../../lib/checkout-orders";
import { digitsOnly, hasFullName, isValidCpf } from "../../../lib/brazil";
import { cartSelections, checkoutItems } from "../../../lib/cart";
import { getCustomerSession } from "../../../lib/auth";
import {
  createCheckoutPreference,
  getEnvironmentVariable,
  MercadoPagoRequestError,
} from "../../../lib/mercado-pago";
import {
  CouponError,
  releaseCouponAfterSetupFailure,
} from "../../../lib/coupons";
import {
  quoteCartShipping,
  ShippingConfigurationError,
  ShippingProviderError,
} from "../../../lib/shipping";

type CheckoutPayload = {
  addressId?: unknown;
  saveAddress?: unknown;
  label?: string;
  items?: unknown;
  couponCode?: unknown;
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
  expectedSubtotalCents?: number;
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
    throw new Error("Configure APP_URL com a URL pública HTTPS da loja.");
  }

  return url.origin;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin(request)) {
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  }
  const session = await getCustomerSession(request.headers);
  if (!session) {
    return Response.json(
      { error: "Entre na sua conta para finalizar a compra." },
      { status: 401 },
    );
  }
  let orderId: string | null = null;

  try {
    const payload = (await request.json()) as CheckoutPayload;
    if (!payload || typeof payload !== "object")
      return Response.json({ error: "Pedido inválido." }, { status: 400 });
    const catalog = await getProductCatalog();
    const items = checkoutItems(payload, catalog);
    if (!items?.length) {
      return Response.json(
        { error: "Carrinho inválido. Confira os produtos e as quantidades." },
        { status: 400 },
      );
    }
    const selections = cartSelections(items, catalog);
    const subtotalCents = selections.reduce(
      (sum, selection) => sum + selection.subtotalCents,
      0,
    );

    if (payload.expectedSubtotalCents !== undefined && payload.expectedSubtotalCents !== subtotalCents) {
      return Response.json({ error: "O preço dos produtos mudou. Revise o total atualizado antes de pagar." }, { status: 409 });
    }
    const customerName = clean(payload.customerName, 120);
    const customerEmail = session.user.email.trim().toLowerCase();
    const customerPhone = digitsOnly(payload.customerPhone, 11);
    const customerDocument = digitsOnly(payload.customerDocument, 11);
    if ((payload.addressId !== undefined && (typeof payload.addressId !== "string" || !payload.addressId)) ||
        (payload.saveAddress !== undefined && typeof payload.saveAddress !== "boolean")) {
      return Response.json({ error: "Dados de endereço inválidos." }, { status: 400 });
    }
    const savedAddress = typeof payload.addressId === "string"
      ? await getAddress(session.user.id, payload.addressId) : null;
    const parsedAddress = addressSchema.safeParse(savedAddress ?? payload);
    if (!parsedAddress.success) {
      return Response.json({ error: parsedAddress.error.issues[0].message }, { status: 400 });
    }
    const { postalCode, streetAddress, addressNumber, addressComplement, neighborhood, city, state } = parsedAddress.data;
    // Compare the displayed snapshot so another tab cannot silently change the delivery destination.
    const displayedAddress = addressSchema.safeParse(payload);
    if (savedAddress && (!displayedAddress.success ||
      Object.entries(parsedAddress.data).some(([key, value]) => key !== "label" && displayedAddress.data[key as keyof typeof displayedAddress.data] !== value))) {
      return Response.json({ error: "O endereço salvo mudou. Revise os dados atualizados e recalcule a entrega." }, { status: 409 });
    }
    const shippingServiceId = clean(payload.shippingServiceId, 40);
    const claimedShippingPriceCents = Number(payload.shippingPriceCents);

    if (
      !hasFullName(customerName) ||
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

    const shippingQuote = await quoteCartShipping(items, postalCode, catalog);
    const shippingOption = shippingQuote?.options.find(
      (option) => option.serviceId === shippingServiceId,
    );

    if (!shippingOption) {
      return Response.json(
        {
          error:
            "A modalidade de entrega não está mais disponível. Calcule novamente.",
          code: "SHIPPING_REQUOTE_REQUIRED",
        },
        { status: 409 },
      );
    }
    if (shippingOption.priceCents !== claimedShippingPriceCents) {
      return Response.json(
        {
          error: "O valor da entrega mudou. Calcule novamente antes de pagar.",
          code: "SHIPPING_REQUOTE_REQUIRED",
        },
        { status: 409 },
      );
    }

    const appUrl = await resolveAppUrl(request);
    if (!(await getEnvironmentVariable("MERCADO_PAGO_ACCESS_TOKEN")))
      throw new Error("Pagamento não configurado.");
    if (!savedAddress && payload.saveAddress !== false) {
      await saveAddress(session.user.id, parsedAddress.data);
    }
    const newOrderId = crypto.randomUUID();
    const db = await getDb();
    const shippingQuotedAt = new Date().toISOString();

    const orderValues = {
      id: newOrderId,
      userId: session.user.id,
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
      subtotalCents,
      shippingCents: shippingOption.priceCents,
      shippingProvider: shippingQuote.provider,
      shippingServiceId: shippingOption.serviceId,
      shippingServiceName: shippingOption.serviceName,
      shippingCompanyId: shippingOption.companyId,
      shippingCompanyName: shippingOption.companyName,
      shippingDeliveryTimeDays: shippingOption.deliveryTimeDays,
      shippingQuotedAt,
      totalCents: subtotalCents + shippingOption.priceCents,
    };
    const itemValues = selections.map((selection) => ({
      orderId: newOrderId,
      productId: selection.productId,
      productName: selection.product.name,
      shippingPackageSnapshot: JSON.stringify(selection.product.shippingPackage),
      color: selection.color,
      personalization: selection.personalization,
      quantity: selection.quantity,
      unitPriceCents: selection.product.unitPriceCents,
    }));
    const prepared = await createOrReuseCheckoutOrder(db, orderValues, itemValues, payload.couponCode);
    if (prepared.kind === "reused") {
      return Response.json({ checkoutUrl: prepared.checkoutUrl, orderId: prepared.orderId }, { status: 200 });
    }
    if (prepared.kind === "processing") {
      return Response.json({ error: "O pagamento deste pedido está sendo preparado. Aguarde alguns instantes e tente novamente.", code: "CHECKOUT_IN_PROGRESS" }, { status: 409, headers: { "Retry-After": "3" } });
    }
    // Only this request owns creation and may mark setup as failed.
    orderId = prepared.orderId;

    const { preference, checkoutUrl } = await createCheckoutPreference({
      orderId,
      discountCents: prepared.discountCents,
      couponCode: prepared.couponCode,
      expiresAt: prepared.expiresAt,
      items: selections.map((selection) => ({
        productId: selection.productId,
        productName: selection.product.name,
      shippingPackageSnapshot: JSON.stringify(selection.product.shippingPackage),
        color: selection.color,
        personalization: selection.personalization,
        quantity: selection.quantity,
        unitPriceCents: selection.product.unitPriceCents,
      })),
      shippingCents: shippingOption.priceCents,
      customerName,
      customerEmail,
      customerPhone,
      postalCode,
      streetAddress,
      addressNumber,
      appUrl,
    });

    await saveCheckoutPreference(db, orderId, preference.id, checkoutUrl);

    return Response.json({ checkoutUrl, orderId }, { status: 201 });
  } catch (error) {
    if (error instanceof AddressError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof CouponError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError)
      return Response.json({ error: "Pedido inválido." }, { status: 400 });
    if (orderId) {
      try {
        if (
          error instanceof MercadoPagoRequestError &&
          error.definitelyNotCreated
        )
          await releaseCouponAfterSetupFailure(orderId);
        await (
          await getDb()
        )
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
        { error: "Não foi possível confirmar a entrega. Calcule novamente.", code: "SHIPPING_REQUOTE_REQUIRED" },
        { status: 502 },
      );
    }

    return Response.json(
      {
        error:
          "Não foi possível iniciar o pagamento. Tente novamente em instantes.",
      },
      { status: 500 },
    );
  }
}
