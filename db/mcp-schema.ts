import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const mcpClients = sqliteTable("mcp_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  redirectUris: text("redirect_uris").notNull(),
  secretHash: text("secret_hash"),
  createdAt: integer("created_at").notNull(),
});
export const mcpConnections = sqliteTable("mcp_connections", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => mcpClients.id),
  scopes: text("scopes").notNull(),
  createdAt: integer("created_at").notNull(),
  revokedAt: integer("revoked_at"),
});
export const mcpCredentials = sqliteTable("mcp_credentials", {
  hash: text("hash").primaryKey(),
  kind: text("kind").notNull(),
  connectionId: text("connection_id").notNull().references(() => mcpConnections.id),
  details: text("details").notNull().default("{}"),
  expiresAt: integer("expires_at").notNull(),
}, t => [index("mcp_credentials_expiry_idx").on(t.expiresAt)]);
export const productImages = sqliteTable("product_images", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  contentHash: text("content_hash").notNull(),
  data: text("data").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: integer("created_at").notNull(),
}, t => [uniqueIndex("product_images_owner_hash_unique").on(t.owner, t.contentHash)]);
export const mcpProductOperations = sqliteTable("mcp_product_operations", {
  id: text("id").primaryKey(),
  connectionId: text("connection_id").notNull().references(() => mcpConnections.id),
  key: text("key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  productId: text("product_id").notNull(),
  response: text("response").notNull(),
}, t => [uniqueIndex("mcp_product_operations_key_unique").on(t.connectionId, t.key)]);
export const mcpRateLimits = sqliteTable("mcp_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
