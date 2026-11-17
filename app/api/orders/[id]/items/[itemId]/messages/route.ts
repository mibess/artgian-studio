import { getCustomerSession } from "../../../../../../../lib/auth";
import { handleOrderMessages, orderMessageJson, type OrderMessageRouteContext } from "../../../../../../../lib/order-message-http";
import { requestOrigin } from "../../../../../../../lib/request-origin";

export async function GET(request: Request, context: OrderMessageRouteContext) {
  const session = await getCustomerSession(request.headers);
  if (!session) return orderMessageJson({ error: "Entre na sua conta para acessar a conversa." }, 401);
  return handleOrderMessages(request, context, { role: "customer", userId: session.user.id });
}

export async function POST(request: Request, context: OrderMessageRouteContext) {
  if (request.headers.get("origin") !== requestOrigin(request) || request.headers.get("sec-fetch-site") === "cross-site")
    return orderMessageJson({ error: "Origem inválida." }, 403);
  return GET(request, context);
}
