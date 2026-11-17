import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { mcpConnections, mcpCredentials } from "../../../db/schema";
import { digest, rateLimit } from "../../../lib/mcp/auth";
import { errorResponse, readBody, withCors } from "../../../lib/mcp/http";
export async function POST(request: Request) {
  try {
    await rateLimit("oauth-revoke", 1000);
    const form = new URLSearchParams((await readBody(request, 16_000)).toString("utf8"));
    const db = await getDb();
    const [credential] = await db.select().from(mcpCredentials).where(eq(mcpCredentials.hash, digest(form.get("token") || "")));
    if (credential) await db.update(mcpConnections).set({ revokedAt: Date.now() }).where(eq(mcpConnections.id, credential.connectionId));
    return withCors(new Response(null, { status: 200 }));
  } catch (error) { return withCors(errorResponse(error)); }
}
export function OPTIONS() { return withCors(new Response(null, { status: 204 })); }
