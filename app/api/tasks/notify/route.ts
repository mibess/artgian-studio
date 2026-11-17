import { Receiver } from "@upstash/qstash";
import { runNotifyBatch } from "../../../../lib/mibess-notify/publisher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  const signature = request.headers.get("upstash-signature");
  if (!signature || !currentSigningKey || !nextSigningKey) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.text();
  const valid = await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature, body, url: request.url }).catch(() => false);
  if (!valid) return Response.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const result = await runNotifyBatch();
    return Response.json(result, { status: result.status === "configuration_error" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[mibess-notify] worker_database_error");
    return Response.json({ error: "Falha ao processar outbox." }, { status: 503 });
  }
}
