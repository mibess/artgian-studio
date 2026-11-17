import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "../../../db";
import { mcpClients } from "../../../db/schema";
import { digest, rateLimit, secret, validRedirect } from "../../../lib/mcp/auth";
import { errorResponse, readBody, withCors } from "../../../lib/mcp/http";
const registration = z.object({
  client_name: z.string().min(1).max(100).default("Assistente de produtos"),
  redirect_uris: z.array(z.string().max(2000).refine(validRedirect)).min(1).max(5),
  token_endpoint_auth_method: z.enum(["none", "client_secret_post"]).default("none"),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).default(["code"]),
});
export async function POST(request: Request) {
  try {
    await rateLimit("oauth-register", 100);
    const data = registration.parse(JSON.parse((await readBody(request, 16_000)).toString("utf8")));
    const id = randomUUID(), password = data.token_endpoint_auth_method === "client_secret_post" ? secret() : undefined;
    await (await getDb()).insert(mcpClients).values({ id, name: data.client_name, redirectUris: JSON.stringify(data.redirect_uris), secretHash: password ? digest(password) : null, createdAt: Date.now() });
    return withCors(Response.json({ ...data, client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000), ...(password ? { client_secret: password, client_secret_expires_at: 0 } : {}) }, { status: 201 }));
  } catch (error) { return withCors(errorResponse(error)); }
}
export function OPTIONS() { return withCors(new Response(null, { status: 204 })); }
