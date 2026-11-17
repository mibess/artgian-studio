import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { mcpClients, mcpConnections, mcpCredentials, mcpRateLimits } from "../../db/schema";
import { McpHttpError, mcpOrigin, resourceUrl } from "./http";

export const MCP_SCOPES = ["products:read", "products:write", "products:publish", "images:write"] as const;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export async function rateLimit(key: string, maximum: number, duration = 3_600_000) {
  const db = await getDb(), now = Date.now();
  const [row] = await db.insert(mcpRateLimits).values({ key: `${key}:${Math.floor(now / duration)}`, count: 1, expiresAt: now + duration }).onConflictDoUpdate({ target: mcpRateLimits.key, set: { count: sql`${mcpRateLimits.count}+1` } }).returning();
  if (row.count > maximum) throw new McpHttpError("Limite de operações atingido. Tente novamente mais tarde.", 429);
  await db.delete(mcpRateLimits).where(lt(mcpRateLimits.expiresAt, now - duration));
  await db.delete(mcpCredentials).where(lt(mcpCredentials.expiresAt, now));
}
export async function registeredClient(id: string) {
  const [client] = await (await getDb()).select().from(mcpClients).where(eq(mcpClients.id, id));
  if (!client) throw new McpHttpError("Cliente OAuth desconhecido.", 400, "invalid_client");
  return client;
}
export function validRedirect(value: string) {
  try {
    const u = new URL(value);
    return !u.username && !u.password && !u.hash && (u.protocol === "https:" || (u.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)));
  } catch { return false; }
}
export async function authorizationRequest(query: URLSearchParams) {
  const clientId = query.get("client_id") || "", client = await registeredClient(clientId);
  const redirectUri = query.get("redirect_uri") || "", challenge = query.get("code_challenge") || "";
  if (!(JSON.parse(client.redirectUris) as string[]).includes(redirectUri)) throw new McpHttpError("Endereço de retorno não autorizado.");
  if (query.get("response_type") !== "code" || query.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new McpHttpError("Use authorization_code com PKCE S256.");
  const scopes = (query.get("scope") || MCP_SCOPES.join(" ")).split(" ").filter(Boolean);
  if (!scopes.length || scopes.some(s => !(MCP_SCOPES as readonly string[]).includes(s))) throw new McpHttpError("Permissão inválida.", 400, "invalid_scope");
  if (query.get("resource") !== resourceUrl()) throw new McpHttpError("Informe o recurso MCP correto.", 400, "invalid_target");
  const state = query.get("state") || "";
  if (state.length > 2048) throw new McpHttpError("State inválido.");
  return { client, clientId, redirectUri, challenge, scopes: [...new Set(scopes)], state };
}
export type McpIdentity = { connectionId: string; scopes: string[] };
export function requireScope(identity: McpIdentity, scope: string) {
  if (!identity.scopes.includes(scope)) throw new McpHttpError("Esta conexão não possui a permissão necessária.", 403, "insufficient_scope");
}
export async function authenticate(request: Request): Promise<McpIdentity> {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) throw new McpHttpError("Conecte sua IA à loja para continuar.", 401, "invalid_token");
  const [row] = await (await getDb()).select({ connectionId: mcpConnections.id, scopes: mcpConnections.scopes, details: mcpCredentials.details }).from(mcpCredentials)
    .innerJoin(mcpConnections, eq(mcpConnections.id, mcpCredentials.connectionId))
    .where(and(eq(mcpCredentials.hash, digest(token)), eq(mcpCredentials.kind, "access"), gt(mcpCredentials.expiresAt, Date.now()), isNull(mcpConnections.revokedAt)));
  if (!row || JSON.parse(row.details).resource !== resourceUrl()) throw new McpHttpError("Conexão expirada ou revogada.", 401, "invalid_token");
  return { connectionId: row.connectionId, scopes: row.scopes.split(" ") };
}
export async function approveAuthorization(query: URLSearchParams) {
  const { clientId, redirectUri, challenge, state, scopes } = await authorizationRequest(query);
  const resource = resourceUrl();
  // Keep the request identity after its single-use code has been exchanged or expired.
  const connectionId = digest(JSON.stringify([clientId, resource, redirectUri, challenge, state, [...scopes].sort()]));
  const code = secret();
  const now = Date.now();
  const db = await getDb();
  // Both statements run in one SQLite transaction. Only the winner of the first
  // INSERT may issue a code, even if the submissions arrive at different servers.
  const [inserted] = await db.batch([
    db.insert(mcpConnections)
      .values({ id: connectionId, clientId, scopes: scopes.join(" "), createdAt: now })
      .onConflictDoNothing({ target: mcpConnections.id })
      .returning({ id: mcpConnections.id }),
    db.run(sql`
      INSERT INTO ${mcpCredentials} (hash, kind, connection_id, details, expires_at)
      SELECT ${digest(code)}, 'code', ${connectionId}, ${JSON.stringify({ redirectUri, challenge, resource })}, ${now + 300_000}
      WHERE changes() = 1
    `),
  ]);
  if (!inserted.length) return null;
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return target.href;
}
export async function exchangeToken(form: URLSearchParams) {
  const client = await registeredClient(form.get("client_id") || "");
  if (client.secretHash && !timingSafeEqual(Buffer.from(digest(form.get("client_secret") || "")), Buffer.from(client.secretHash))) throw new McpHttpError("Credencial do cliente inválida.", 401, "invalid_client");
  const grant = form.get("grant_type");
  if (grant !== "authorization_code" && grant !== "refresh_token") throw new McpHttpError("Grant não suportado.", 400, "unsupported_grant_type");
  if (form.get("resource") !== resourceUrl()) throw new McpHttpError("Recurso inválido.", 400, "invalid_target");
  const supplied = form.get(grant === "authorization_code" ? "code" : "refresh_token") || "";
  return (await getDb()).transaction(async tx => {
    const [credential] = await tx.select({ hash: mcpCredentials.hash, details: mcpCredentials.details, connectionId: mcpConnections.id, scopes: mcpConnections.scopes }).from(mcpCredentials)
      .innerJoin(mcpConnections, eq(mcpConnections.id, mcpCredentials.connectionId))
      .where(and(eq(mcpCredentials.hash, digest(supplied)), eq(mcpCredentials.kind, grant === "authorization_code" ? "code" : "refresh"), gt(mcpCredentials.expiresAt, Date.now()), eq(mcpConnections.clientId, client.id), isNull(mcpConnections.revokedAt)));
    if (!credential) throw new McpHttpError("Código ou token expirado, utilizado ou inválido.", 400, "invalid_grant");
    if (grant === "refresh_token" && JSON.parse(credential.details).resource !== resourceUrl()) throw new McpHttpError("Recurso inválido.", 400, "invalid_grant");
    if (grant === "authorization_code") {
      const details = JSON.parse(credential.details), verifier = form.get("code_verifier") || "";
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || createHash("sha256").update(verifier).digest("base64url") !== details.challenge || form.get("redirect_uri") !== details.redirectUri || details.resource !== resourceUrl()) throw new McpHttpError("PKCE ou retorno inválido.", 400, "invalid_grant");
    }
    await tx.delete(mcpCredentials).where(eq(mcpCredentials.hash, credential.hash));
    const access = secret(), refresh = secret();
    await tx.insert(mcpCredentials).values([
      { hash: digest(access), kind: "access", connectionId: credential.connectionId, expiresAt: Date.now() + 3_600_000, details: JSON.stringify({ resource: resourceUrl() }) },
      { hash: digest(refresh), kind: "refresh", connectionId: credential.connectionId, expiresAt: Date.now() + 30 * 86400_000, details: JSON.stringify({ resource: resourceUrl() }) },
    ]);
    return { access_token: access, token_type: "Bearer", expires_in: 3600, refresh_token: refresh, scope: credential.scopes };
  });
}
export const authChallenge = () => `Bearer resource_metadata="${mcpOrigin()}/.well-known/oauth-protected-resource/mcp", scope="${MCP_SCOPES.join(" ")}"`;
