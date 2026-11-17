import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders, paymentEvents } from "../../../../db/schema";
import { applyEmbeddedPayment } from "../../../../lib/embedded-payments";
import {
  getEnvironmentVariable,
  getPayment,
  validateWebhookSignature,
} from "../../../../lib/mercado-pago";

import { applyRedirectPayment } from "../../../../lib/redirect-payments";
import { retryTransaction } from "../../../../lib/checkout-orders";

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
    if (!orderId || String(payment.id) !== dataId) {
      return new Response(null, { status: 200 });
    }

    const db = await getDb();
    const [order] = await retryTransaction(() => db.transaction(async tx => tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId)), { behavior: "immediate" }));

    if (!order) {
      return new Response(null, { status: 200 });
    }

    if (order.checkoutMode === "embedded") {
      const applied = await applyEmbeddedPayment(payment);
      if (applied) await retryTransaction(() => db.transaction(async tx => { await tx.insert(paymentEvents).values({
        eventKey: request.headers.get("x-request-id") ?? `${payload.id ?? "payment"}:${dataId}:${payment.status}:${payment.date_last_updated ?? ""}`,
        orderId, paymentId: String(payment.id), action: payload.action ?? null,
        payload: JSON.stringify({ id: payment.id, status: payment.status, status_detail: payment.status_detail, date_last_updated: payment.date_last_updated }),
      }).onConflictDoNothing(); }, { behavior: "immediate" }));
      return new Response(null, { status: 200 });
    }

    const requestId = request.headers.get("x-request-id");
    const eventKey =
      requestId ?? `${payload.id ?? "payment"}:${dataId}:${payment.status}`;

    await retryTransaction(() => db.transaction(async tx => { await tx
      .insert(paymentEvents)
      .values({
        eventKey,
        orderId,
        paymentId: String(payment.id),
        action: payload.action ?? null,
        payload: JSON.stringify({ notification: payload, payment }),
      })
      .onConflictDoNothing(); }, { behavior: "immediate" }));

    await applyRedirectPayment(payment);

    return new Response(null, { status: 200 });
  } catch {
    // Database errors may contain SQL parameters, including payment/order data.
    console.error("[payment] webhook_processing_failed");
    return Response.json({ error: "Falha ao processar webhook." }, { status: 500 });
  }
}
