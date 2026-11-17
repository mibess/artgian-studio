import { eq } from "drizzle-orm";
import { conversations, leads } from "../../../../../../db/schema";
import { hasAdminAccess } from "../../../../../../lib/admin-access";
import { getCommercialDb } from "../../../../../../src/db/commercial";
import { resolveInstagramConversationUrl } from "../../../../../../src/integrations/instagram/links";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAdminAccess(request.headers)) {
    return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  const { id } = await params;
  const db = await getCommercialDb();
  const [row] = await db.select({ conversation: conversations, lead: leads })
    .from(conversations).innerJoin(leads, eq(conversations.leadId, leads.id))
    .where(eq(conversations.id, id)).limit(1);
  if (!row || row.conversation.channel !== "instagram") {
    return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  const destination = await resolveInstagramConversationUrl(row.conversation, row.lead.instagramUsername);
  const fallback = new URL(`/admin/leads/${encodeURIComponent(row.lead.id)}`, request.url);
  fallback.searchParams.set("erro", row.conversation.externalId?.startsWith("comment:")
    ? "Não foi possível abrir o comentário original. A publicação pode ter sido removida ou o acesso ao Instagram precisa ser reconectado."
    : "Não foi possível localizar o perfil desta conversa no Instagram. Tente novamente após sincronizar as conversas.");
  return new Response(null, {
    status: 303,
    headers: { Location: destination || fallback.toString(), "Cache-Control": "private, no-store" },
  });
}
