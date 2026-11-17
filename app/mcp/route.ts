import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticate, authChallenge, rateLimit } from "../../lib/mcp/auth";
import { errorResponse, McpHttpError, mcpOrigin, readBody, withCors } from "../../lib/mcp/http";
import { productMcpServer } from "../../lib/mcp/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  let server;
  try {
    // Reject browser-origin calls unless explicitly allowed. Native/server clients omit Origin.
    const origin = request.headers.get("origin");
    const allowed = [mcpOrigin(), ...(process.env.MCP_ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean)];
    if (origin && !allowed.includes(origin)) throw new McpHttpError("Origem não autorizada.", 403);
    const identity = await authenticate(request);
    await rateLimit(`mcp:${identity.connectionId}`, 300);
    const body = JSON.parse((await readBody(request, 3_000_000)).toString("utf8"));
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    server = productMcpServer(identity);
    await server.connect(transport);
    return withCors(await transport.handleRequest(request, { parsedBody: body }));
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof McpHttpError && error.status === 401) response.headers.set("WWW-Authenticate", authChallenge());
    return withCors(response);
  } finally { await server?.close(); }
}
export async function GET(request: Request) {
  // Only a browser opening this address should see the installer. MCP clients need the 401 challenge.
  if (request.headers.get("sec-fetch-mode") === "navigate" &&
      request.headers.get("accept")?.includes("text/html") && !request.headers.has("authorization")) {
    return new Response(null, {
      status: 303,
      headers: { Location: `${mcpOrigin()}/mcp/instalar`, "Cache-Control": "no-store", Vary: "Accept, Sec-Fetch-Mode, Authorization" },
    });
  }
  try { await authenticate(request); return withCors(new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } })); }
  catch (error) { const response = errorResponse(error); response.headers.set("WWW-Authenticate", authChallenge()); return withCors(response); }
}
export function OPTIONS() { return withCors(new Response(null, { status: 204 })); }
