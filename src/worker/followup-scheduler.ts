import { Client, Receiver } from "@upstash/qstash";

type FollowupWake = { jobId: string; scheduledAt: string };

function callbackUrl() {
  const base = process.env.APP_URL?.trim();
  if (!base) return null;
  try {
    return new URL("/api/tasks/followups", base).toString();
  } catch {
    return null;
  }
}

export function getFollowupSchedulerStatus() {
  const publishReady = Boolean(process.env.QSTASH_TOKEN?.trim() && callbackUrl());
  const verifyReady = Boolean(
    process.env.QSTASH_CURRENT_SIGNING_KEY?.trim() &&
      process.env.QSTASH_NEXT_SIGNING_KEY?.trim(),
  );
  return { publishReady, verifyReady, ready: publishReady && verifyReady };
}

export async function scheduleFollowupWake(
  input: FollowupWake,
  dependencies: { publish?: (input: FollowupWake & { url: string; delay: number }) => Promise<void> } = {},
) {
  const url = callbackUrl();
  if (!url || !process.env.QSTASH_TOKEN?.trim()) {
    return { status: "database_only" as const };
  }
  const delay = Math.max(0, Math.ceil((Date.parse(input.scheduledAt) - Date.now()) / 1_000));
  const publish = dependencies.publish || (async (message: FollowupWake & { url: string; delay: number }) => {
    const client = new Client({ token: process.env.QSTASH_TOKEN!.trim() });
    await client.publishJSON({
      url: message.url,
      body: { jobId: message.jobId },
      delay: message.delay,
      retries: 3,
    });
  });
  await publish({ ...input, url, delay });
  return { status: "qstash" as const };
}

export async function verifyFollowupWake(input: {
  signature: string | null;
  body: string;
  url: string;
}) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!input.signature || !currentSigningKey || !nextSigningKey) return false;
  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  return receiver.verify({
    signature: input.signature,
    body: input.body,
    url: input.url,
  }).catch(() => false);
}
