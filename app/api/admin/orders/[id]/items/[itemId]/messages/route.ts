import { hasAdminAccess } from "../../../../../../../../lib/admin-access";
import { handleOrderMessages, orderMessageJson, type OrderMessageRouteContext } from "../../../../../../../../lib/order-message-http";
import { requestOrigin } from "../../../../../../../../lib/request-origin";

export async function GET(request: Request, context: OrderMessageRouteContext) {
  if (!hasAdminAccess(request.headers)) return orderMessageJson({ error: "Autenticação necessária." }, 401);
  return handleOrderMessages(request, context, { role: "seller" });
}

export async function POST(request: Request, context: OrderMessageRouteContext) {
  if (request.headers.get("origin") !== requestOrigin(request) || request.headers.get("sec-fetch-site") === "cross-site")
    return orderMessageJson({ error: "Origem inválida." }, 403);
  return GET(request, context);
}
