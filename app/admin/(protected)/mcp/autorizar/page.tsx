import { authorizationRequest } from "../../../../../lib/mcp/auth";
import { authorizeConnection } from "../actions";
import { scopeLabels } from "../scope-labels";
import { SubmitButton } from "../../../../components/PendingButton";
export default async function Authorize({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") query.set(key, value);
  let request;
  try { request = await authorizationRequest(query); }
  catch { return <section><h1 className="text-2xl font-bold">Conexão inválida ou expirada</h1><p>Inicie novamente a conexão pelo seu aplicativo de IA.</p></section>; }
  return <section className="mx-auto max-w-xl rounded-3xl bg-white p-8"><h1 className="text-3xl font-bold">Conectar sua IA à loja</h1>
    <p className="mt-4">O aplicativo <strong>{request.client.name}</strong> solicita as permissões abaixo.</p>
    <p className="mt-2 break-all text-xs">Endereço de retorno do aplicativo: {request.redirectUri}</p>
    {["127.0.0.1", "localhost", "[::1]"].includes(new URL(request.redirectUri).hostname) && (
      <p className="mt-2 text-sm">Mantenha o aplicativo ou terminal que iniciou o login aberto. Depois de autorizar, o navegador voltará para ele neste computador.</p>
    )}
    <ul className="my-6 list-disc space-y-3 pl-5">{request.scopes.map(s => <li key={s}>{scopeLabels[s]}</li>)}</ul>
    <p className="text-sm">Autorize apenas o aplicativo que você está conectando. Você pode revogar a conexão em Produtos → Conectar IA.</p>
    <form action={authorizeConnection} className="mt-6 flex gap-4"><input type="hidden" name="query" value={query.toString()} />
      <SubmitButton name="decision" value="approve" pendingLabel="Aguarde…" className="inline-flex items-center gap-2 rounded-xl bg-[#193244] px-5 py-3 text-white">Autorizar conexão</SubmitButton><SubmitButton name="decision" value="deny" pendingLabel="Aguarde…">Cancelar</SubmitButton>
    </form></section>;
}
