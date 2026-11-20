import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { orderItems, orders } from "../db/schema";
import { hasFullName } from "./brazil";
import type { ShippingPackage } from "./catalog";
import { getProductCatalog } from "./products/repository";
import {
  calculateProviderCartShipping,
  createAndPurchaseShippingLabel,
  generateAndPrintShippingLabel,
  resolveShippingProvider,
} from "./shipping";
import { syncSuperFreteLabelCancellation } from "./super-frete-label-sync";

export type ShippingLabelResult = { ok: boolean; message: string };

const done = (message: string): ShippingLabelResult => ({ ok: true, message });
const failed = (message: string): ShippingLabelResult => ({ ok: false, message: message.slice(0, 280) });

/**
 * Buys, generates or re-checks the shipping label of a paid order.
 * Callers must authenticate the seller before calling.
 */
export async function runShippingLabelAction(
  orderId: string,
  action: string,
  input: { recipientName?: string } = {},
): Promise<ShippingLabelResult> {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const items = order ? await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)) : [];

  if (!order || !items.length) return failed("Pedido não encontrado.");
  if (order.status !== "paid") return failed("A etiqueta só pode ser criada para um pedido pago.");

  try {
    const provider = resolveShippingProvider(order.shippingProvider);
    if (action === "sync") {
      if (provider !== "super_frete" || !order.shippingLabelId) {
        return failed("Este pedido não tem etiqueta da SuperFrete para consultar.");
      }
      try {
        const result = await syncSuperFreteLabelCancellation(order.shippingLabelId, order.id);
        if (result === "canceled") return done("Cancelamento confirmado. Você pode comprar outra etiqueta.");
        if (result === "unlinked") return done("O vínculo da etiqueta já foi atualizado.");
        return done("A SuperFrete ainda não confirmou o cancelamento. A etiqueta continua válida.");
      } catch {
        return failed("Não foi possível consultar a etiqueta na SuperFrete. Tente novamente.");
      }
    }

    if (action === "create") {
      const recipientName = (input.recipientName ?? "").trim().slice(0, 120) || order.customerName;
      if (!hasFullName(recipientName)) return failed("Informe nome e sobrenome do destinatário para comprar a etiqueta.");
      if (order.shippingLabelId) return failed("Este pedido já possui uma etiqueta vinculada.");
      if (!order.customerDocument) return failed("O pedido não possui CPF do destinatário.");

      const products = await getProductCatalog();
      const lines = items.map(item => {
        const product = products[item.productId];
        const shippingPackage: ShippingPackage | null = item.shippingPackageSnapshot
          ? JSON.parse(item.shippingPackageSnapshot)
          : product?.shippingPackage || null;
        if (!shippingPackage) throw new Error(`Peso e medidas de ${item.productName} não estão configurados.`);
        return { package: shippingPackage, productId: item.productId, quantity: item.quantity, unitPriceCents: item.unitPriceCents };
      });
      const options = await calculateProviderCartShipping({ destinationPostalCode: order.postalCode, items: lines }, provider);
      const selectedOption = options.find(option => option.serviceId === order.shippingServiceId);
      if (!selectedOption) return failed("A modalidade de entrega não está mais disponível.");
      if (order.shippingCents !== 0 && selectedOption.priceCents !== order.shippingCents) {
        return failed(`O custo atual da etiqueta é ${selectedOption.priceCents / 100} e difere do valor pago pelo cliente.`);
      }

      if (recipientName !== order.customerName) {
        await db.update(orders)
          .set({ customerName: recipientName, updatedAt: new Date().toISOString() })
          .where(eq(orders.id, order.id));
      }

      const labelId = await createAndPurchaseShippingLabel(provider, {
        orderId: order.id,
        serviceId: selectedOption.serviceId,
        recipient: {
          name: recipientName,
          email: order.customerEmail,
          phone: order.customerPhone,
          document: order.customerDocument,
          address: order.streetAddress,
          complement: order.addressComplement,
          number: order.addressNumber,
          district: order.neighborhood,
          city: order.city,
          state: order.state,
          postalCode: order.postalCode,
        },
        products: items.map(item => ({
          name: [item.productName, item.color, item.personalization].filter(Boolean).join(" · "),
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
        volumes: selectedOption.volumes,
      });
      await db.update(orders).set({
        shippingLabelId: labelId,
        shippingLabelStatus: "checkout_requested",
        shippingLabelError: null,
        shippingLabelUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(orders.id, order.id));
      return done("Etiqueta comprada. Aguarde a liberação do pagamento e depois gere o PDF.");
    }

    if (action === "generate") {
      if (!order.shippingLabelId) return failed("A etiqueta ainda não foi criada.");
      const labelUrl = await generateAndPrintShippingLabel(provider, order.shippingLabelId);
      const updated = await db.update(orders).set({
        shippingLabelStatus: "generated",
        shippingLabelUrl: labelUrl,
        shippingLabelError: null,
        shippingLabelUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
        .where(and(eq(orders.id, order.id), eq(orders.shippingLabelId, order.shippingLabelId)))
        .returning({ id: orders.id });
      if (!updated.length) return failed("O vínculo da etiqueta mudou. Consulte o pedido novamente.");
      return done("Etiqueta gerada. Já pode imprimir.");
    }

    return failed("Ação inválida.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar a etiqueta.";
    await db.update(orders).set({
      shippingLabelError: message.slice(0, 500),
      shippingLabelUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(and(eq(orders.id, order.id), order.shippingLabelId ? eq(orders.shippingLabelId, order.shippingLabelId) : undefined));
    return failed(message);
  }
}
