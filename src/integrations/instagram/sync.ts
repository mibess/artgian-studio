import { processInboundMessage, type InboundMessage } from "../../features/conversations/process-inbound";
import { tryAutoSendInstagramReply } from "../../features/conversations/automation";
import { enhanceReplyDraftWithAi } from "../../features/conversations/replies";
import { getInstagramAccessToken } from "./token-store";

const DEFAULT_GRAPH_API_VERSION = "v26.0";

type GraphProfile = {
  id: string;
  user_id?: string;
  username?: string;
};

type GraphConversation = {
  id: string;
  updated_time?: string;
};

type GraphParty = { id?: string; username?: string };

type GraphMessage = {
  id?: string;
  created_time?: string;
  from?: GraphParty;
  to?: { data?: GraphParty[] } | GraphParty[];
  message?: string;
};

type GraphList<T> = {
  data?: T[];
  error?: { code?: number; message?: string };
};

function getGraphApiVersion() {
  const version =
    process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() ||
    DEFAULT_GRAPH_API_VERSION;
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error("Versão da API do Instagram inválida.");
  }
  return version;
}

async function fetchGraphJson<T>(
  path: string,
  searchParams: Record<string, string>,
  accessToken: string,
  fetchImpl: typeof fetch,
) {
  const url = new URL(
    `https://graph.instagram.com/${getGraphApiVersion()}/${path}`,
  );
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    throw new Error("Falha de rede ao consultar conversas do Instagram.");
  }
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: number };
  };
  if (!response.ok || payload.error) {
    const code = payload.error?.code;
    throw new Error(
      code
        ? `O Instagram recusou a sincronização (código ${code}).`
        : "O Instagram recusou a sincronização.",
    );
  }
  return payload;
}

export function extractInboundMessagesFromConversation(input: {
  profile: GraphProfile;
  conversation: GraphConversation;
  messages: GraphMessage[];
  since: Date;
}) {
  const configuredBusinessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
  const ownIds = new Set(
    [input.profile.id, input.profile.user_id, configuredBusinessId].filter(
      Boolean,
    ),
  );
  const businessId =
    input.profile.user_id || configuredBusinessId || input.profile.id;

  return input.messages
    .filter((message) => {
      if (!message.id || !message.message?.trim() || !message.from?.id) return false;
      if (ownIds.has(message.from.id)) return false;
      if (
        input.profile.username &&
        message.from.username === input.profile.username
      ) {
        return false;
      }
      const createdAt = Date.parse(message.created_time || "");
      return Number.isFinite(createdAt) && createdAt >= input.since.getTime();
    })
    .sort(
      (left, right) =>
        Date.parse(left.created_time || "") - Date.parse(right.created_time || ""),
    )
    .map(
      (message): InboundMessage => ({
        externalMessageId: message.id!,
        externalConversationId: `${businessId}:${message.from!.id}`,
        instagramUsername: message.from?.username || message.from!.id!,
        name: message.from?.username,
        text: message.message!.trim(),
        source: "Instagram · Reconciliação",
        receivedAt: new Date(message.created_time!).toISOString(),
      }),
    );
}

export async function syncInstagramConversations(input: {
  since?: Date;
  accessToken?: string;
  fetchImpl?: typeof fetch;
} = {}) {
  const accessToken = input.accessToken || (await getInstagramAccessToken());
  const fetchImpl = input.fetchImpl || fetch;
  const since =
    input.since || new Date(Date.now() - 48 * 60 * 60 * 1_000);
  const profile = await fetchGraphJson<GraphProfile>(
    "me",
    { fields: "id,user_id,username" },
    accessToken,
    fetchImpl,
  );
  const conversationList = await fetchGraphJson<GraphList<GraphConversation>>(
    "me/conversations",
    {
      platform: "instagram",
      fields: "id,updated_time",
      limit: "25",
    },
    accessToken,
    fetchImpl,
  );

  let inspectedMessages = 0;
  let recoveredMessages = 0;
  let duplicateMessages = 0;
  let inspectedConversations = 0;
  for (const conversation of conversationList.data || []) {
    const updatedAt = Date.parse(conversation.updated_time || "");
    if (Number.isFinite(updatedAt) && updatedAt < since.getTime()) continue;
    inspectedConversations += 1;
    const messageList = await fetchGraphJson<GraphList<GraphMessage>>(
      `${encodeURIComponent(conversation.id)}/messages`,
      {
        fields: "id,created_time,from,to,message",
        limit: "50",
      },
      accessToken,
      fetchImpl,
    );
    inspectedMessages += messageList.data?.length || 0;
    const inboundMessages = extractInboundMessagesFromConversation({
      profile,
      conversation,
      messages: messageList.data || [],
      since,
    });
    for (const message of inboundMessages) {
      const result = await processInboundMessage(message);
      if (result.duplicate) duplicateMessages += 1;
      else {
        recoveredMessages += 1;
        if (result.draftMessageId) {
          const enhanced = await enhanceReplyDraftWithAi({
            leadId: result.leadId,
            messageId: result.draftMessageId,
          });
          if (enhanced.status === "enhanced") {
            await tryAutoSendInstagramReply({
              leadId: result.leadId,
              messageId: enhanced.messageId,
              decision: enhanced.decision,
            });
          }
        }
      }
    }
  }

  return {
    profileId: profile.user_id || profile.id,
    inspectedConversations,
    inspectedMessages,
    recoveredMessages,
    duplicateMessages,
  };
}
