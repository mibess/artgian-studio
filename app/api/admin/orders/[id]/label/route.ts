import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { hasFullName } from "@/lib/brazil";
import { isProductId, products } from "@/lib/catalog";
import {
  calculateProviderCartShipping,
  createAndPurchaseShippingLabel,
  generateAndPrintShippingLabel,
  resolveShippingProvider,
} from "@/lib/shipping";

type LabelRouteContext = {
  params: Promise<{ id: string }>;
};

function adminRedirect(
  request: Request,
  type: "message" | "error",
  value: string,
) {
  const url = new URL("/admin/pedidos", request.url);
  url.searchParams.set(type, value.slice(0, 280));
  return Response.redirect(url, 303);
}

export async function POST(request: Request, context: LabelRouteContext) {
  const requestOrigin = request.headers.get("origin");
  if (
    requestOrigin &&
    new URL(requestOrigin).host !== new URL(request.url).host
  ) {
    return new Response("Origem inválida.", { status: 403 });
  }

  const { id } = await context.params;
  const form = await request.formData();
  const action = String(form.get("action") || "");
  const db = await getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  if (!order || !items.length)
    return adminRedirect(request, "error", "Pedido não encontrado.");
  if (order.status !== "paid") {
    return adminRedirect(
      request,
      "error",
      "A etiqueta só pode ser criada para um pedido pago.",
    );
  }

  try {
    const provider = resolveShippingProvider(order.shippingProvider);
    if (action === "create") {
      const submittedRecipientName = String(form.get("recipientName") || "")
        .trim()
        .slice(0, 120);
      const recipientName = submittedRecipientName || order.customerName;
      if (!hasFullName(recipientName)) {
        return adminRedirect(
          request,
          "error",
          "Informe nome e sobrenome do destinatário para comprar a etiqueta.",
        );
      }
      if (order.shippingLabelId) {
        return adminRedirect(
          request,
          "error",
          "Este pedido já possui uma etiqueta vinculada.",
        );
      }
      if (!order.customerDocument) {
        return adminRedirect(
          request,
          "error",
          "O pedido não possui CPF do destinatário.",
        );
      }
      const lines = items.map((item) => {
        if (!isProductId(item.productId))
          throw new Error("Produto do pedido não está mais no catálogo.");
        const product = products[item.productId];
        if (!product.shippingPackage)
          throw new Error(
            `Peso e medidas de ${item.productName} não estão configurados.`,
          );
        return {
          package: product.shippingPackage,
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        };
      });
      const options = await calculateProviderCartShipping(
        { destinationPostalCode: order.postalCode, items: lines },
        provider,
      );
      const selectedOption = options.find(
        (option) => option.serviceId === order.shippingServiceId,
      );
      if (!selectedOption) {
        return adminRedirect(
          request,
          "error",
          "A modalidade de entrega não está mais disponível.",
        );
      }
      if (selectedOption.priceCents !== order.shippingCents) {
        return adminRedirect(
          request,
          "error",
          `O custo atual da etiqueta é ${selectedOption.priceCents / 100} e difere do valor pago pelo cliente.`,
        );
      }

      if (recipientName !== order.customerName) {
        await db
          .update(orders)
          .set({
            customerName: recipientName,
            updatedAt: new Date().toISOString(),
          })
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
        products: items.map((item) => ({
          name: [item.productName, item.color, item.personalization]
            .filter(Boolean)
            .join(" · "),
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
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
        "Etiqueta inserida e pagamento solicitado. Aguarde a liberação antes de gerar.",
      );
    }

    if (action === "generate") {
      if (!order.shippingLabelId) {
        return adminRedirect(
          request,
          "error",
          "A etiqueta ainda não foi criada.",
        );
      }
      const labelUrl = await generateAndPrintShippingLabel(
        provider,
        order.shippingLabelId,
      );
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
      return adminRedirect(
        request,
        "message",
        "Etiqueta gerada com sucesso.",
      );
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
