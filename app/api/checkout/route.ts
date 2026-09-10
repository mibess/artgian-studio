import { requestOrigin } from "../../../lib/request-origin";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders } from "../../../db/schema";
import { digitsOnly, isValidCpf } from "../../../lib/brazil";
import { cartSelections, checkoutItems } from "../../../lib/cart";
import { getCustomerSession } from "../../../lib/auth";
import {
  createCheckoutPreference,
  getEnvironmentVariable,
  MercadoPagoRequestError,
} from "../../../lib/mercado-pago";
import {
  ShippingConfigurationError,
  ShippingProviderError,
} from "../../../lib/melhor-envio";
import {
  CouponError,
  reserveCoupon,
  releaseCouponAfterSetupFailure,
} from "../../../lib/coupons";
import { quoteCartShipping } from "../../../lib/shipping";

type CheckoutPayload = {
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
    const items = checkoutItems(payload);
    if (!items?.length) {
      return Response.json(
        { error: "Carrinho inválido. Confira os produtos e as quantidades." },
        { status: 400 },
      );
    }
    const selections = cartSelections(items);
    const subtotalCents = selections.reduce(
      (sum, selection) => sum + selection.subtotalCents,
      0,
    );
    const customerName = clean(payload.customerName, 120);
    const customerEmail = session.user.email.trim().toLowerCase();
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

    const shippingQuote = await quoteCartShipping(items, postalCode);
    const shippingOption = shippingQuote?.options.find(
      (option) => option.serviceId === shippingServiceId,
    );

    if (!shippingOption) {
      return Response.json(
        {
          error:
            "A modalidade de entrega não está mais disponível. Calcule novamente.",
        },
        { status: 409 },
      );
    }
    if (shippingOption.priceCents !== claimedShippingPriceCents) {
      return Response.json(
        {
          error: "O valor da entrega mudou. Calcule novamente antes de pagar.",
        },
        { status: 409 },
      );
    }

    const appUrl = await resolveAppUrl(request);
    if (!(await getEnvironmentVariable("MERCADO_PAGO_ACCESS_TOKEN")))
      throw new Error("Pagamento não configurado.");
    orderId = crypto.randomUUID();
    const db = await getDb();
    let discountCents = 0;
    let couponSnapshot:
      | {
          couponId: string;
          couponCode: string;
          couponKind: string;
          couponValue: number;
        }
      | undefined;
    let couponExpiresAt: string | null = null;
    let totalCents = subtotalCents + shippingOption.priceCents;
    const shippingQuotedAt = new Date().toISOString();

    const orderValues = () => ({
      id: orderId!,
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
      discountCents,
      ...couponSnapshot,
      shippingCents: shippingOption.priceCents,
      shippingProvider: "melhor_envio",
      shippingServiceId: shippingOption.serviceId,
      shippingServiceName: shippingOption.serviceName,
      shippingCompanyId: shippingOption.companyId,
      shippingCompanyName: shippingOption.companyName,
      shippingDeliveryTimeDays: shippingOption.deliveryTimeDays,
      shippingQuotedAt,
      totalCents,
    });
    const itemValues = selections.map((selection) => ({
      orderId: orderId!,
      productId: selection.productId,
      productName: selection.product.name,
      color: selection.color,
      personalization: selection.personalization,
      quantity: selection.quantity,
      unitPriceCents: selection.product.unitPriceCents,
    }));
    if (payload.couponCode !== undefined && payload.couponCode !== "") {
      await db.transaction(
        async (tx) => {
          const result = await reserveCoupon(
            tx,
            payload.couponCode,
            subtotalCents,
          );
          discountCents = result.discountCents;
          couponExpiresAt = result.coupon.expiresAt;
          couponSnapshot = {
            couponId: result.coupon.id,
            couponCode: result.coupon.code,
            couponKind: result.coupon.kind,
            couponValue: result.coupon.value,
          };
          totalCents -= discountCents;
          await tx.insert(orders).values(orderValues());
          await tx.insert(orderItems).values(itemValues);
        },
        { behavior: "immediate" },
      );
    } else {
      await db.batch([
        db.insert(orders).values(orderValues()),
        db.insert(orderItems).values(itemValues),
      ]);
    }

    const { preference, checkoutUrl } = await createCheckoutPreference({
      orderId,
      discountCents,
      couponCode: couponSnapshot?.couponCode,
      expiresAt: couponExpiresAt,
      items: selections.map((selection) => ({
        productId: selection.productId,
        productName: selection.product.name,
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

    await db
      .update(orders)
      .set({
        mercadoPagoPreferenceId: preference.id,
        checkoutUrl,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    return Response.json({ checkoutUrl, orderId }, { status: 201 });
  } catch (error) {
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
        { error: "Não foi possível confirmar a entrega. Calcule novamente." },
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
