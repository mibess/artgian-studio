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
  entry?: Array<{
    id?: string;
    time?: number;
    field?: string;
    value?: {
      id?: string;
      text?: string;
      from?: { id?: string; username?: string };
      media?: { id?: string };
    };
    messaging?: MetaMessagingEvent[];
    changes?: Array<{
      field?: string;
      value?: {
        id?: string;
        text?: string;
        from?: { id?: string; username?: string };
        media?: { id?: string };
      };
    }>;
  }>;
};

export function extractInstagramMessages(input: unknown) {
  const payload = input as MetaWebhookPayload;
  const result: Array<{
    externalMessageId: string;
    externalConversationId: string;
    instagramUsername: string;
    text: string;
    receivedAt: string;
    kind: "dm" | "comment";
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
        kind: "dm",
      });
    }
    const changes = [
      ...(entry.changes || []),
      ...(entry.field ? [{ field: entry.field, value: entry.value }] : []),
    ];
    for (const change of changes) {
      const value = change.value;
      if (
        change.field !== "comments" ||
        !value?.id ||
        !value.text ||
        !value.from?.id
      ) continue;
      result.push({
        externalMessageId: `comment:${value.id}`,
        externalConversationId: `comment:${value.id}`,
        instagramUsername: value.from.username || value.from.id,
        text: value.text,
        receivedAt: new Date(
          entry.time ? entry.time * 1_000 : Date.now(),
        ).toISOString(),
        kind: "comment",
      });
    }
  }
  return result;
}
