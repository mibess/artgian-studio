import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders } from "../../../db/schema";
import { getProductSelection } from "../../../lib/catalog";
import {
  createCheckoutPreference,
  getEnvironmentVariable,
} from "../../../lib/mercado-pago";

type CheckoutPayload = {
  productId?: string;
  color?: string;
  quantity?: number;
  personalization?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  postalCode?: string;
  streetAddress?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
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
      "Configure APP_URL com uma URL pública HTTPS para testar o Mercado Pago.",
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
    const customerPhone = clean(payload.customerPhone, 30);
    const postalCode = clean(payload.postalCode, 12);
    const streetAddress = clean(payload.streetAddress, 180);
    const addressNumber = clean(payload.addressNumber, 20);
    const addressComplement = clean(payload.addressComplement, 80);
    const neighborhood = clean(payload.neighborhood, 80);
    const city = clean(payload.city, 80);
    const state = clean(payload.state, 2).toUpperCase();

    if (
      !customerName ||
      !customerEmail.includes("@") ||
      !customerPhone ||
      !postalCode ||
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

    const appUrl = await resolveAppUrl(request);
    orderId = crypto.randomUUID();
    const db = await getDb();

    await db.batch([
      db.insert(orders).values({
        id: orderId,
        status: "pending",
        customerName,
        customerEmail,
        customerPhone,
        postalCode,
        streetAddress,
        addressNumber,
        addressComplement: addressComplement || null,
        neighborhood,
        city,
        state,
        subtotalCents: selection.subtotalCents,
        shippingCents: selection.shippingCents,
        totalCents: selection.totalCents,
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
      shippingCents: selection.shippingCents,
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

    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível iniciar o pagamento.";
    return Response.json({ error: message }, { status: 500 });
  }
}
