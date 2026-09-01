import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(rawBody: string, signature: string | null) {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{ id?: string; messaging?: MetaMessagingEvent[] }>;
};

export function extractInstagramMessages(input: unknown) {
  const payload = input as MetaWebhookPayload;
  const result: Array<{
    externalMessageId: string;
    externalConversationId: string;
    instagramUsername: string;
    text: string;
    receivedAt: string;
  }> = [];
  for (const entry of payload.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.message?.mid || !event.message.text || event.message.is_echo || !event.sender?.id) continue;
      result.push({
        externalMessageId: event.message.mid,
        externalConversationId: `${entry.id || event.recipient?.id || "instagram"}:${event.sender.id}`,
        instagramUsername: event.sender.id,
        text: event.message.text,
        receivedAt: new Date(event.timestamp || Date.now()).toISOString(),
      });
    }
  }
  return result;
}
