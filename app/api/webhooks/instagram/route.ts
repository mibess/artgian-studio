import { after, NextRequest, NextResponse } from "next/server";
import { processInboundMessage } from "../../../../src/features/conversations/process-inbound";
import { enhanceReplyDraftWithAi } from "../../../../src/features/conversations/replies";
import { extractInstagramMessages, verifyMetaSignature } from "../../../../src/integrations/instagram/webhook";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return NextResponse.json({ error: "Verificação inválida." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const inboundMessages = extractInstagramMessages(payload);
  const results = [];
  for (const message of inboundMessages) {
    const result = await processInboundMessage({
      ...message,
      source: "Instagram · Webhook",
    });
    results.push(result);
    if (!result.duplicate && result.draftMessageId) {
      after(async () => {
        try {
          await enhanceReplyDraftWithAi({
            leadId: result.leadId,
            messageId: result.draftMessageId!,
          });
        } catch (error) {
          console.error(
            "Falha ao aprimorar rascunho do Instagram; mantendo sugestão local.",
            error instanceof Error ? error.message : "Erro desconhecido",
          );
        }
      });
    }
  }
  return NextResponse.json({ received: inboundMessages.length, results });
}
