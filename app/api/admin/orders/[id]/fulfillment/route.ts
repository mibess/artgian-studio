import { z } from "zod";
import { hasAdminAccess } from "../../../../../../lib/admin-access";
import { requestOrigin } from "../../../../../../lib/request-origin";
import { FulfillmentError, fulfillmentUpdateSchema, updateOrderFulfillment } from "../../../../../../lib/order-fulfillment";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasAdminAccess(request.headers)) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (request.headers.get("origin") !== requestOrigin(request)) return Response.json({ error: "Origem inválida." }, { status: 403 });
  const { id } = await context.params;
  const destination = new URL("/admin/pedidos", requestOrigin(request));
  const page = new URL(request.url).searchParams.get("page");
  if (page && /^[1-9]\d{0,5}$/.test(page)) destination.searchParams.set("page", page);
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Pedido inválido." }, { status: 400 });
  destination.hash = `pedido-${id}`;
  destination.searchParams.set("updatedOrder", id);
  try {
    const form = await request.formData();
    const input = fulfillmentUpdateSchema.parse(Object.fromEntries(form));
    const changed = await updateOrderFulfillment(id, input);
    destination.searchParams.set("message", changed ? "Acompanhamento atualizado. A nova etapa já está disponível para o cliente." : "O acompanhamento já está atualizado.");
  } catch (error) {
    const message = error instanceof FulfillmentError ? error.message : error instanceof z.ZodError ? "Confira a etapa, o código de rastreio e a observação antes de salvar." : "Não foi possível atualizar o acompanhamento. Tente novamente.";
    destination.searchParams.set("error", message);
  }
  return Response.redirect(destination, 303);
}
