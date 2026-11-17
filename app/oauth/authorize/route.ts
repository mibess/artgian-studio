import { authorizationRequest } from "../../../lib/mcp/auth";
import { errorResponse, mcpOrigin } from "../../../lib/mcp/http";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    await authorizationRequest(params);
    const target = new URL("/admin/mcp/autorizar", mcpOrigin());
    target.search = params.toString();
    return Response.redirect(target, 303);
  } catch (error) { return errorResponse(error); }
}
