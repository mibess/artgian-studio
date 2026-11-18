import { createHmac, timingSafeEqual } from "node:crypto";
import { syncSuperFreteLabelCancellation } from "../../../../lib/super-frete-label-sync";

export async function POST(request: Request) {
  const secret = process.env.SUPER_FRETE_WEBHOOK_SECRET?.trim();
  if (!secret) return new Response(null, { status: 503 });

  const signature = request.headers.get("x-me-signature");
  if (!signature) return new Response(null, { status: 401 });
  const body = Buffer.from(await request.arrayBuffer());
  const digest = createHmac("sha256", secret).update(body).digest();
  const received = /^[a-f\d]{64}$/i.test(signature)
    ? Buffer.from(signature, "hex")
    : Buffer.from(signature, "base64");
  if (received.length !== digest.length || !timingSafeEqual(received, digest)) {
    return new Response(null, { status: 401 });
  }

  let payload: { event?: string; data?: { id?: unknown } } | null;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (payload?.event !== "order.cancelled") return new Response(null, { status: 204 });
  const labelId = payload.data?.id;
  if (typeof labelId !== "string" || !labelId.trim()) return new Response(null, { status: 400 });

  try {
    const result = await syncSuperFreteLabelCancellation(labelId);
    return new Response(null, { status: result === "active" ? 503 : 204 });
  } catch (error) {
    console.error("Falha ao confirmar cancelamento de etiqueta da SuperFrete.", error instanceof Error ? error.name : undefined);
    return new Response(null, { status: 503 });
  }
}
