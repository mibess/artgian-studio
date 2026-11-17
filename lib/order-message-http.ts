import "server-only";
import { z } from "zod";
import { getOrderMessageThread, markOrderMessagesRead, OrderMessageError, readOrderMessagesSchema, sendOrderMessage, type OrderMessageViewer } from "./order-messages";

export type OrderMessageRouteContext = { params: Promise<{ id: string; itemId: string }> };
const privateHeaders = { "Cache-Control": "private, no-store" };

export function orderMessageJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

export async function handleOrderMessages(request: Request, context: OrderMessageRouteContext, viewer: OrderMessageViewer) {
  try {
    const { id, itemId: rawItemId } = await context.params;
    const itemId = Number(rawItemId);
    if (!id || id.length > 100 || !/^[1-9]\d*$/.test(rawItemId) || !Number.isSafeInteger(itemId))
      throw new OrderMessageError("Conversa inválida.", 400);
    if (request.method === "GET") {
      const cursor = new URL(request.url).searchParams.get("before");
      if (cursor !== null && !/^[1-9]\d*$/.test(cursor)) throw new OrderMessageError("Página de mensagens inválida.", 400);
      return orderMessageJson(await getOrderMessageThread(id, itemId, viewer, cursor === null ? undefined : Number(cursor)));
    }
    const raw = await request.text();
    if (raw.length > 16_000) throw new OrderMessageError("A mensagem excede o tamanho permitido.", 400);
    const input: unknown = JSON.parse(raw);
    if (typeof input === "object" && input !== null && "action" in input) {
      const { throughId } = readOrderMessagesSchema.parse(input);
      await markOrderMessagesRead(id, itemId, viewer, throughId);
      return orderMessageJson({ ok: true });
    }
    return orderMessageJson({ message: await sendOrderMessage(id, itemId, viewer, input) }, 201);
  } catch (error) {
    if (error instanceof OrderMessageError) return orderMessageJson({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return orderMessageJson({ error: "Confira a mensagem: use de 1 a 2.000 caracteres." }, 400);
    return orderMessageJson({ error: "Não foi possível acessar a conversa. Tente novamente." }, 500);
  }
}
