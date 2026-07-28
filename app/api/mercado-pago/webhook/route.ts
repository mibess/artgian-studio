import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders, paymentEvents } from "../../../../db/schema";
import {
  getEnvironmentVariable,
  getPayment,
  mapPaymentStatus,
  validateWebhookSignature,
} from "../../../../lib/mercado-pago";

type WebhookPayload = {
  id?: string | number;
  action?: string;
  type?: string;
  data?: {
    id?: string | number;
  };
};

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = (await request.json().catch(() => ({}))) as WebhookPayload;
    const dataId = String(
      url.searchParams.get("data.id") ??
        url.searchParams.get("data_id") ??
        payload.data?.id ??
        "",
    );

    if (!dataId || (payload.type && payload.type !== "payment")) {
      return new Response(null, { status: 200 });
    }

    const signatureIsValid = await validateWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
    });
    const environment =
      (await getEnvironmentVariable("MERCADO_PAGO_ENVIRONMENT")) ?? "test";

    // MCP test credentials belong to an isolated seller test application, so
    // its webhook secret is not the secret exposed by the main application.
    // In test mode the payment is still authenticated and verified below via
    // Mercado Pago's API before any order is updated.
    if (!signatureIsValid && environment !== "test") {
      return Response.json({ error: "Assinatura inválida." }, { status: 401 });
    }

    const payment = await getPayment(dataId);
    const orderId = payment.external_reference;
    if (!orderId) {
      return new Response(null, { status: 200 });
    }

    const db = await getDb();
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return new Response(null, { status: 200 });
    }

    const paidAmountCents = Math.round(payment.transaction_amount * 100);
    const matchesOrder =
      payment.currency_id === "BRL" && paidAmountCents === order.totalCents;
    const requestId = request.headers.get("x-request-id");
    const eventKey =
      requestId ?? `${payload.id ?? "payment"}:${dataId}:${payment.status}`;

    await db
      .insert(paymentEvents)
      .values({
        eventKey,
        orderId,
        paymentId: String(payment.id),
        action: payload.action ?? null,
        payload: JSON.stringify({ notification: payload, payment }),
      })
      .onConflictDoNothing();

    if (matchesOrder) {
      await db
        .update(orders)
        .set({
          status: mapPaymentStatus(payment.status),
          mercadoPagoPaymentId: String(payment.id),
          mercadoPagoStatus: payment.status,
          mercadoPagoStatusDetail: payment.status_detail ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, orderId));
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao processar webhook.";
    return Response.json({ error: message }, { status: 500 });
  }
}
