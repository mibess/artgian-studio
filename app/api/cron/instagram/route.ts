import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runInstagramMaintenance } from "../../../../src/integrations/instagram/maintenance";
import { runWorkerBatch } from "../../../../src/worker/processor";

export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const received = request.headers.get("authorization") || "";
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const [instagram, commercial] = await Promise.all([
    runInstagramMaintenance(),
    runWorkerBatch(3),
  ]);
  return NextResponse.json({ instagram, commercial }, {
    status: instagram.status === "error" ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
