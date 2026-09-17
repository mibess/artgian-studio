import "server-only";
import { headers } from "next/headers";
import { hasAdminAccess } from "../../lib/admin-access";

export async function requireAdminAccess() {
  if (!hasAdminAccess(await headers())) throw new Error("Não autorizado.");
}
