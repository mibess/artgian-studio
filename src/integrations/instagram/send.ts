const DEFAULT_GRAPH_API_VERSION = "v26.0";
const MAX_TEXT_LENGTH = 1_000;
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1_000;

export class InstagramSendError extends Error {
  constructor(
    message: string,
    public readonly kind: "configuration" | "rejected" | "uncertain",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "InstagramSendError";
  }
}

export function getInstagramRecipientId(externalConversationId: string | null) {
  if (!externalConversationId) return null;
  const match = externalConversationId.match(/^\d+:(\d+)$/);
  return match?.[1] || null;
}

export function isInstagramReplyWindowOpen(
  lastInboundAt: string,
  now = new Date(),
) {
  const inboundTime = Date.parse(lastInboundAt);
  if (!Number.isFinite(inboundTime)) return false;
  const age = now.getTime() - inboundTime;
  return age >= -5 * 60 * 1_000 && age <= REPLY_WINDOW_MS;
}

type SendInstagramTextOptions = {
  recipientId: string;
  text: string;
  accessToken?: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
};

type InstagramSendResponse = {
  recipient_id?: string;
  message_id?: string;
  error?: { message?: string; code?: number; error_subcode?: number };
};

export async function sendInstagramText({
  recipientId,
  text,
  accessToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN?.trim(),
  apiVersion = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() ||
    DEFAULT_GRAPH_API_VERSION,
  fetchImpl = fetch,
}: SendInstagramTextOptions) {
  if (!accessToken) {
    throw new InstagramSendError(
      "Token de acesso do Instagram não configurado.",
      "configuration",
    );
  }
  if (!/^\d+$/.test(recipientId)) {
    throw new InstagramSendError(
      "Destinatário do Instagram inválido.",
      "configuration",
    );
  }
  const normalizedText = text.trim();
  if (!normalizedText || normalizedText.length > MAX_TEXT_LENGTH) {
    throw new InstagramSendError(
      `A mensagem deve ter entre 1 e ${MAX_TEXT_LENGTH} caracteres.`,
      "configuration",
    );
  }
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new InstagramSendError(
      "Versão da API do Instagram inválida.",
      "configuration",
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(
      `https://graph.instagram.com/${apiVersion}/me/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: normalizedText },
        }),
        cache: "no-store",
      },
    );
  } catch {
    throw new InstagramSendError(
      "A conexão caiu durante o envio. Confira a conversa no Instagram antes de tentar novamente.",
      "uncertain",
    );
  }

  const payload = (await response.json().catch(() => ({}))) as InstagramSendResponse;
  if (!response.ok || !payload.message_id) {
    const code = payload.error?.code;
    throw new InstagramSendError(
      code
        ? `O Instagram recusou o envio (código ${code}).`
        : "O Instagram recusou o envio.",
      "rejected",
      response.status,
    );
  }

  return {
    recipientId: payload.recipient_id || recipientId,
    messageId: payload.message_id,
  };
}
