import { z } from "zod";
import { getCustomerSession } from "../../../lib/auth";
import { requestOrigin } from "../../../lib/request-origin";
import { AddressError, changeAddress, listAddresses, saveAddress } from "../../../lib/addresses/repository";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: z.string().uuid().optional(), address: z.unknown(), makeDefault: z.boolean().optional() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("default"), id: z.string().uuid() }),
]);
export async function GET(request: Request) {
  const session = await getCustomerSession(request.headers);
  if (!session) return Response.json({ error: "Entre na sua conta para acessar os endereços." }, { status: 401 });
  return Response.json({ addresses: await listAddresses(session.user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== requestOrigin(request)) || request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  const session = await getCustomerSession(request.headers);
  if (!session) return Response.json({ error: "Entre na sua conta para alterar os endereços." }, { status: 401 });
  try {
    const payload = mutationSchema.parse(await request.json());
    if (payload.action === "save") {
      await saveAddress(session.user.id, payload.address, { id: payload.id, makeDefault: payload.makeDefault });
    } else {
      await changeAddress(session.user.id, payload.id, payload.action);
    }
    return Response.json({ addresses: await listAddresses(session.user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AddressError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json({ error: "Dados de endereço inválidos." }, { status: 400 });
    return Response.json({ error: "Não foi possível salvar a alteração. Tente novamente." }, { status: 500 });
  }
}
