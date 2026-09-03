import "server-only";

import { getInstagramAccessToken } from "./token-store";

const DEFAULT_GRAPH_API_VERSION = "v26.0";

type InstagramMessagingProfileResponse = {
  id?: string;
  name?: string;
  username?: string;
};

export async function getInstagramMessagingProfile(
  instagramScopedId: string,
  options: {
    accessToken?: string;
    apiVersion?: string;
    fetchImpl?: typeof fetch;
  } = {},
) {
  if (!/^\d+$/.test(instagramScopedId)) return null;
  let accessToken: string;
  try {
    accessToken = options.accessToken || (await getInstagramAccessToken());
  } catch {
    return null;
  }
  const apiVersion =
    options.apiVersion ||
    process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() ||
    DEFAULT_GRAPH_API_VERSION;
  if (!/^v\d+\.\d+$/.test(apiVersion)) return null;

  const url = new URL(
    `https://graph.instagram.com/${apiVersion}/${instagramScopedId}`,
  );
  url.searchParams.set("fields", "id,name,username");
  try {
    const response = await (options.fetchImpl || fetch)(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const profile = (await response.json()) as InstagramMessagingProfileResponse;
    const username = profile.username?.trim();
    if (!username || !/^[a-zA-Z0-9._]{1,30}$/.test(username)) return null;
    return {
      id: profile.id || instagramScopedId,
      username,
      name: profile.name?.trim() || null,
    };
  } catch {
    return null;
  }
}
