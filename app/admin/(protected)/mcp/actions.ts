"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { mcpConnections } from "../../../../db/schema";
import { hasAdminAccess } from "../../../../lib/admin-access";
import { approveAuthorization, authorizationRequest } from "../../../../lib/mcp/auth";
export async function authorizeConnection(form: FormData) {
  if (!hasAdminAccess(await headers())) throw new Error("Autenticação necessária.");
  const query = new URLSearchParams(String(form.get("query") || ""));
  if (form.get("decision") !== "approve") {
    const a = await authorizationRequest(query), target = new URL(a.redirectUri);
    target.searchParams.set("error", "access_denied");
    if (a.state) target.searchParams.set("state", a.state);
    redirect(target.href);
  }
  const callback = await approveAuthorization(query);
  redirect(callback ?? "/admin/mcp?resultado=ja-aprovado#conexoes");
}
export async function revokeConnection(form: FormData) {
  if (!hasAdminAccess(await headers())) throw new Error("Autenticação necessária.");
  await (await getDb()).update(mcpConnections).set({ revokedAt: Date.now() }).where(eq(mcpConnections.id, String(form.get("id"))));
  revalidatePath("/admin/mcp");
}
