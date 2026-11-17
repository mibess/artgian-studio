import { exchangeToken, rateLimit } from "../../../lib/mcp/auth";
import { errorResponse, readBody, withCors } from "../../../lib/mcp/http";
export async function POST(request: Request) {
  try {
    await rateLimit("oauth-token", 1000);
    const form = new URLSearchParams((await readBody(request, 16_000)).toString("utf8"));
    return withCors(Response.json(await exchangeToken(form)));
  } catch (error) { return withCors(errorResponse(error)); }
}
export function OPTIONS() { return withCors(new Response(null, { status: 204 })); }
