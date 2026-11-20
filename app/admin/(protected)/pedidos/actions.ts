"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { hasAdminAccess } from "../../../../lib/admin-access";
import type { AdminOrder } from "../../../../lib/admin-order-view";
import { getAdminOrder } from "../../../../lib/admin-orders";
import { fulfillmentStep } from "../../../../lib/fulfillment-status";
import { FulfillmentError, fulfillmentUpdateSchema, updateOrderFulfillment } from "../../../../lib/order-fulfillment";
import { runShippingLabelAction } from "../../../../lib/order-shipping-label";

export type OrderActionState = {
  ok: boolean;
  message: string;
  /** Fresh copy of the order, so the panel stays correct even if it left the current queue. */
  order?: AdminOrder | null;
  at: number;
} | null;

const fail = (message: string): OrderActionState => ({ ok: false, message, at: Date.now() });

async function orderIdFrom(formData: FormData): Promise<{ orderId: string } | { error: string }> {
  if (!hasAdminAccess(await headers())) return { error: "Sua sessão do admin expirou. Entre novamente para continuar." };
  const orderId = String(formData.get("orderId") ?? "");
  if (!z.uuid().safeParse(orderId).success) return { error: "Pedido inválido. Recarregue a página." };
  return { orderId };
}

export async function saveFulfillment(_previous: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const target = await orderIdFrom(formData);
  if ("error" in target) return fail(target.error);
  const { orderId } = target;
  const parsed = fulfillmentUpdateSchema.safeParse({
    status: formData.get("status"),
    revision: formData.get("revision"),
    note: formData.get("note") ?? "",
    trackingCode: formData.get("trackingCode") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Confira a etapa, o código de rastreio e a mensagem.");
  try {
    const changed = await updateOrderFulfillment(orderId, parsed.data);
    revalidatePath("/admin/pedidos");
    return {
      ok: true,
      message: changed
        ? `Pedido marcado como “${fulfillmentStep(parsed.data.status).label}”. O cliente já vê a atualização.`
        : "Nada mudou: o pedido já estava com essas informações.",
      order: await getAdminOrder(orderId),
      at: Date.now(),
    };
  } catch (cause) {
    return fail(cause instanceof FulfillmentError ? cause.message : "Não foi possível salvar. Tente novamente.");
  }
}

export async function updateShippingLabel(_previous: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const target = await orderIdFrom(formData);
  if ("error" in target) return fail(target.error);
  const { orderId } = target;
  const intent = String(formData.get("intent") ?? "");
  if (!["create", "generate", "sync"].includes(intent)) return fail("Ação inválida.");
  const result = await runShippingLabelAction(orderId, intent, { recipientName: String(formData.get("recipientName") ?? "") });
  revalidatePath("/admin/pedidos");
  return { ...result, order: await getAdminOrder(orderId), at: Date.now() };
}
