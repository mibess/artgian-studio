import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { mcpConnections, mcpCredentials } from "../../db/schema";
import { digest, requireScope, secret, type McpIdentity } from "./auth";
import { McpHttpError, mcpOrigin, resourceUrl } from "./http";
export async function createUploadLink(identity: McpIdentity) {
  requireScope(identity, "images:write");
  const token = secret(), expiresAt = Date.now() + 900_000;
  await (await getDb()).insert(mcpCredentials).values({ hash: digest(token), kind: "upload", connectionId: identity.connectionId, expiresAt, details: JSON.stringify({ resource: resourceUrl() }) });
  return { url: `${mcpOrigin()}/mcp/upload#${token}`, expiresAt, instructions: "O usuário envia a foto neste link. Depois chame list_uploaded_images para obter o imageId. O link não permite criar nem publicar produtos." };
}
export async function uploadIdentity(token: string): Promise<McpIdentity> {
  const [row] = await (await getDb()).select({ connectionId: mcpConnections.id, scopes: mcpConnections.scopes, details: mcpCredentials.details }).from(mcpCredentials).innerJoin(mcpConnections, eq(mcpConnections.id, mcpCredentials.connectionId))
    .where(and(eq(mcpCredentials.hash, digest(token)), eq(mcpCredentials.kind, "upload"), gt(mcpCredentials.expiresAt, Date.now()), isNull(mcpConnections.revokedAt)));
  if (!row || JSON.parse(row.details).resource !== resourceUrl()) throw new McpHttpError("Link expirado ou revogado. Peça um novo link à sua IA.", 401);
  const identity = { connectionId: row.connectionId, scopes: row.scopes.split(" ") };
  requireScope(identity, "images:write");
  return identity;
}
