import { z } from "zod";
import { getCustomerSession } from "../../../../lib/auth";
import { saveCustomerContact } from "../../../../lib/customer-contact";
import { requestOrigin } from "../../../../lib/request-origin";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== requestOrigin(request)) || request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  const session = await getCustomerSession(request.headers);
  if (!session) return Response.json({ error: "Entre na sua conta para salvar seus dados." }, { status: 401 });
  try {
    const contact = await saveCustomerContact(session.user.id, await request.json());
    return Response.json({ contact }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json({ error: "Informe nome completo e telefone válido com DDD." }, { status: 400 });
    return Response.json({ error: "Não foi possível salvar seus dados. Tente novamente." }, { status: 500 });
  }
}
