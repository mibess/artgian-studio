import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { jobs } from "../../../../db/schema";
import { getCommercialDb } from "../../../../src/db/commercial";
import { verifyFollowupWake } from "../../../../src/worker/followup-scheduler";
import { runWorkerOnce } from "../../../../src/worker/processor";

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

  let jobId = "";
  try {
    const parsed = JSON.parse(body) as { jobId?: unknown };
    jobId = typeof parsed.jobId === "string" ? parsed.jobId : "";
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  if (!jobId) {
    return NextResponse.json({ error: "Job ausente." }, { status: 400 });
  }

  const db = await getCommercialDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job || job.type !== "execute_followup") {
    return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  }
  if (job.status !== "pending") {
    return NextResponse.json({ status: job.status, processed: false }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const result = await runWorkerOnce(job.id);
  return NextResponse.json(result, {
    status: "failed" in result && result.failed ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
