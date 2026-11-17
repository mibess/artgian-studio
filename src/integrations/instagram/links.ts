import "server-only";
import { getInstagramMessagingProfile } from "./profile";
import { getInstagramAccessToken } from "./token-store";

export function instagramProfileUrl(username: string) {
  const normalized = username.trim().replace(/^@/, "");
  // Numeric values in the CRM are unresolved Instagram-scoped IDs.
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(normalized) || /^\d+$/.test(normalized)) return null;
  return `https://www.instagram.com/${normalized}/`;
}

export async function resolveInstagramConversationUrl(
  conversation: { externalId: string | null },
  username: string,
  options: { accessToken?: string; fetchImpl?: typeof fetch } = {},
) {
  const externalId = conversation.externalId || "";
  if (!externalId.startsWith("comment:")) {
    if (!instagramProfileUrl(username)) {
      const scopedId = externalId.split(":").at(-1) || username;
      const profile = await getInstagramMessagingProfile(scopedId, options);
      if (!profile) return null;
      username = profile.username;
    }
    return `https://ig.me/m/${username.trim().replace(/^@/, "")}`;
  }

  const commentId = externalId.slice("comment:".length);
  if (!/^\d+$/.test(commentId)) return null;
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() || "v26.0";
  if (!/^v\d+\.\d+$/.test(version)) return null;
  try {
    const token = options.accessToken || await getInstagramAccessToken();
    const fetchImpl = options.fetchImpl || fetch;
    const read = async (id: string, fields: string) => {
      const url = new URL(`https://graph.instagram.com/${version}/${id}`);
      url.searchParams.set("fields", fields);
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("Referência indisponível.");
      return response.json();
    };
    const comment = await read(commentId, "media");
    const mediaId = comment.media?.id;
    if (typeof mediaId !== "string" || !/^\d+$/.test(mediaId)) return null;
    const media = await read(mediaId, "permalink");
    if (typeof media.permalink !== "string") return null;
    const url = new URL(media.permalink);
    if (url.protocol !== "https:" || !["www.instagram.com", "instagram.com"].includes(url.hostname) || url.username || url.password || url.port) return null;
    if (!/^\/(p|reel|tv)\/[\w-]+\/?$/.test(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    url.searchParams.set("comment_id", commentId);
    return url.toString();
  } catch {
    return null;
  }
}
