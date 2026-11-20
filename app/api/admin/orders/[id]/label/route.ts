import { hasAdminAccess } from "@/lib/admin-access";
import { runShippingLabelAction } from "@/lib/order-shipping-label";
import { requestOrigin as getRequestOrigin } from "@/lib/request-origin";

type LabelRouteContext = {
  params: Promise<{ id: string }>;
};

// Form fallback for the admin orders page; the page itself uses a Server Action.
export async function POST(request: Request, context: LabelRouteContext) {
  if (!hasAdminAccess(request.headers)) {
    return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  if (request.headers.get("origin") !== getRequestOrigin(request)) {
    return new Response("Origem inválida.", { status: 403 });
  }

  const { id } = await context.params;
  const form = await request.formData();
  const result = await runShippingLabelAction(id, String(form.get("action") || ""), {
    recipientName: String(form.get("recipientName") || ""),
  });
  const url = new URL("/admin/pedidos", request.url);
  if (/^[\da-f-]{36}$/i.test(id)) url.searchParams.set("pedido", id);
  url.searchParams.set(result.ok ? "message" : "error", result.message.slice(0, 280));
  return Response.redirect(url, 303);
}
