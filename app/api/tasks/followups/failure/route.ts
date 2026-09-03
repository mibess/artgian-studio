import { NextRequest, NextResponse } from "next/server";
import { verifyFollowupWake } from "../../../../../src/worker/followup-scheduler";
import {
  parseFollowupFailure,
  recordFollowupDeliveryFailure,
} from "../../../../../src/worker/followup-alerts";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const verified = await verifyFollowupWake({
    signature: request.headers.get("upstash-signature"),
    body,
    url: request.url,
  });
  if (!verified) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const failure = parseFollowupFailure(body);
  if (!failure) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const result = await recordFollowupDeliveryFailure(failure);
  return NextResponse.json(result, {
    status: result.status === "not_found" ? 404 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
