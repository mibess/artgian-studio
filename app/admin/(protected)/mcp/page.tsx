import { and, desc, eq, gt, inArray, max } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../../../db";
import { mcpClients, mcpConnections, mcpCredentials } from "../../../../db/schema";
import { mcpOrigin } from "../../../../lib/mcp/http";
import { CopyText } from "../../../mcp/instalar/CopyText";
import { RefreshState } from "../automacao/RefreshState";
import { formatDateTime } from "../_components";
import { revokeConnection } from "./actions";
import { scopeLabels } from "./scope-labels";

async function listConnections() {
  return (await getDb()).select({
    id: mcpConnections.id,
    name: mcpClients.name,
    scopes: mcpConnections.scopes,
    createdAt: mcpConnections.createdAt,
    revokedAt: mcpConnections.revokedAt,
    // Only live OAuth credentials count. An upload link cannot authorize an MCP client.
    credentialKind: max(mcpCredentials.kind),
  }).from(mcpConnections)
    .innerJoin(mcpClients, eq(mcpClients.id, mcpConnections.clientId))
    .leftJoin(mcpCredentials, and(
      eq(mcpCredentials.connectionId, mcpConnections.id),
      gt(mcpCredentials.expiresAt, Date.now()),
      inArray(mcpCredentials.kind, ["code", "access", "refresh"]),
    ))
    .groupBy(mcpConnections.id)
    .orderBy(desc(mcpConnections.createdAt)).limit(100);
}

export default async function McpSettings({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const installUrl = `${mcpOrigin()}/mcp/instalar`;
  const rows = await listConnections();
  const { resultado } = await searchParams;
  return (
    <section className="max-w-3xl space-y-6">
      <Link href="/admin/produtos" className="text-sm font-semibold">← Produtos</Link>
      <h1 className="text-3xl font-semibold tracking-tight">Conectar IA</h1>
      <section className="rounded-2xl border border-[#e0ddd4] bg-white p-6">
        <h2 className="text-xl font-semibold">Instalar no seu computador</h2>
        <p className="my-3 text-sm leading-6">Abra a instalação no computador em que você usa o Codex. Para conectar em outro computador, copie o link e abra por lá.</p>
        <div className="flex flex-wrap items-start gap-2">
          <Link href="/mcp/instalar" className="inline-flex min-h-11 items-center rounded-xl bg-[#193244] px-5 text-sm font-semibold text-white">Abrir instalação</Link>
          <CopyText label="Copiar link de instalação" value={installUrl} />
        </div>
      </section>
      <section id="conexoes" aria-labelledby="connections-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="connections-heading" className="text-xl font-semibold">Conexões da loja</h2>
          <RefreshState />
        </div>
        {resultado === "ja-aprovado" && <p role="status" className="mb-4 rounded-xl bg-white p-4 text-sm">Você já aprovou este pedido. Volte ao aplicativo que iniciou o login e consulte os modelos de produto. Se ele ainda pedir autorização, <Link href="/mcp/instalar#retorno" className="font-semibold underline">veja como concluir pelo terminal</Link>.</p>}
        {!rows.length && <p className="text-sm">As conexões aparecerão aqui quando você autorizar o acesso na loja.</p>}
        {rows.map(connection => {
          let status = "Expirada";
          if (connection.revokedAt) status = "Revogada";
          else if (connection.credentialKind === "code") status = "Aguardando o aplicativo";
          else if (connection.credentialKind) status = "Autorizada";

          return (
            <article key={connection.id} className="mb-3 rounded-xl border border-[#e0ddd4] bg-white p-5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="break-all text-base font-semibold">{connection.name}</h3>
                <span className="font-semibold">{status}</span>
              </div>
              <p className="mt-1 text-xs">{formatDateTime(new Date(connection.createdAt).toISOString())}</p>
              <p className="my-3 break-words text-sm">{connection.scopes.split(" ").map(scope => scopeLabels[scope] || scope).join(" · ")}</p>
              {status === "Aguardando o aplicativo" && <p className="mb-3">Volte ao aplicativo para concluir o login.</p>}
              {!connection.revokedAt && connection.credentialKind && (
                <form action={revokeConnection}>
                  <input type="hidden" name="id" value={connection.id} />
                  <button className="font-semibold text-red-700">Revogar acesso</button>
                </form>
              )}
            </article>
          );
        })}
      </section>
    </section>
  );
}
