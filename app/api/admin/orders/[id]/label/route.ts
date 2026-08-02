import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { isProductId, products } from "@/lib/catalog";
import {
  calculateShipping,
  createAndPurchaseSandboxLabel,
  generateAndPrintSandboxLabel,
} from "@/lib/melhor-envio";

type LabelRouteContext = {
  params: Promise<{ id: string }>;
};

function adminRedirect(request: Request, type: "message" | "error", value: string) {
  const url = new URL("/admin/pedidos", request.url);
  url.searchParams.set(type, value.slice(0, 280));
  return Response.redirect(url, 303);
}

export async function POST(request: Request, context: LabelRouteContext) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && new URL(requestOrigin).host !== new URL(request.url).host) {
    return new Response("Origem inválida.", { status: 403 });
  }

  const { id } = await context.params;
  const form = await request.formData();
  const action = String(form.get("action") || "");
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const [item] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .limit(1);

  if (!order || !item) return adminRedirect(request, "error", "Pedido não encontrado.");
  if (order.status !== "paid") {
    return adminRedirect(request, "error", "A etiqueta só pode ser criada para um pedido pago.");
  }

  try {
    if (action === "create") {
      if (order.shippingLabelId) {
        return adminRedirect(request, "error", "Este pedido já possui uma etiqueta vinculada.");
      }
      if (!order.customerDocument) {
        return adminRedirect(request, "error", "O pedido não possui CPF do destinatário.");
      }
      if (!isProductId(item.productId)) {
        return adminRedirect(request, "error", "Produto do pedido não está mais no catálogo.");
      }
      const product = products[item.productId];
      if (!product.shippingPackage) {
        return adminRedirect(request, "error", "Peso e medidas do produto não estão configurados.");
      }

      const options = await calculateShipping({
        destinationPostalCode: order.postalCode,
        package: product.shippingPackage,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      });
      const selectedOption = options.find(
        (option) => option.serviceId === order.shippingServiceId,
      );
      if (!selectedOption) {
        return adminRedirect(request, "error", "A modalidade de entrega não está mais disponível.");
      }
      if (selectedOption.priceCents !== order.shippingCents) {
        return adminRedirect(
          request,
          "error",
          `O custo atual da etiqueta é ${selectedOption.priceCents / 100} e difere do valor pago pelo cliente.`,
        );
      }

      const labelId = await createAndPurchaseSandboxLabel({
        orderId: order.id,
        serviceId: selectedOption.serviceId,
        recipient: {
          name: order.customerName,
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
        product: {
          name: item.productName,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        },
        volumes: selectedOption.volumes,
      });
      await db
        .update(orders)
        .set({
          shippingLabelId: labelId,
          shippingLabelStatus: "checkout_requested",
          shippingLabelError: null,
          shippingLabelUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, order.id));
      return adminRedirect(
        request,
        "message",
        "Etiqueta inserida e pagamento sandbox solicitado. Aguarde a liberação antes de gerar.",
      );
    }

    if (action === "generate") {
      if (!order.shippingLabelId) {
        return adminRedirect(request, "error", "A etiqueta ainda não foi criada.");
      }
      const labelUrl = await generateAndPrintSandboxLabel(order.shippingLabelId);
      await db
        .update(orders)
        .set({
          shippingLabelStatus: "generated",
          shippingLabelUrl: labelUrl,
          shippingLabelError: null,
          shippingLabelUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, order.id));
      return adminRedirect(request, "message", "Etiqueta sandbox gerada com sucesso.");
    }

    return adminRedirect(request, "error", "Ação inválida.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao processar a etiqueta.";
    await db
      .update(orders)
      .set({
        shippingLabelError: message.slice(0, 500),
        shippingLabelUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, order.id));
    return adminRedirect(request, "error", message);
  }
}
