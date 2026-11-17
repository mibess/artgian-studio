import { MCP_SCOPES } from "../../../../lib/mcp/auth";
import { mcpOrigin, resourceUrl, withCors } from "../../../../lib/mcp/http";
export function GET() {
  return withCors(Response.json({ resource: resourceUrl(), authorization_servers: [mcpOrigin()], scopes_supported: MCP_SCOPES, bearer_methods_supported: ["header"], resource_name: "Produtos Artgian Studio" }));
}
export function OPTIONS() { return withCors(new Response(null, { status: 204 })); }
