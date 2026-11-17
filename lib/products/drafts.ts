import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { auditLogs, catalogProducts, mcpProductOperations } from "../../db/schema";

// Older MCP drafts share the inactive flag with archived products. The original
// create response and the audit trail distinguish a draft from a later archive.
export async function getDraftProductIds(ids?: string[]): Promise<Set<string>> {
  if (ids?.length === 0) return new Set();
  const db = await getDb();
  const rows = await db.selectDistinct({ id: catalogProducts.id })
    .from(mcpProductOperations)
    .innerJoin(catalogProducts, eq(catalogProducts.id, mcpProductOperations.productId))
    .where(and(
      eq(catalogProducts.active, false),
      ids ? inArray(catalogProducts.id, ids) : undefined,
      sql`json_extract(${mcpProductOperations.response}, '$.published') = 0`,
      sql`json_extract(${mcpProductOperations.response}, '$.version') = 1`,
      notExists(db.select({ id: auditLogs.id }).from(auditLogs).where(and(
        eq(auditLogs.entityType, "product"),
        eq(auditLogs.entityId, catalogProducts.id),
        inArray(auditLogs.action, ["product_created", "product_updated"]),
        sql`json_extract(${auditLogs.metadata}, '$.active') = 1`,
      ))),
    ));
  return new Set(rows.map(row => row.id));
}
