import { instagramUsernameFromHref } from "./discovery-domain";

export function normalizeHashtag(value: string) {
  return value
    .normalize("NFC")
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function instagramUrl(value: string) {
  try {
    const url = new URL(value, "https://www.instagram.com");
    return url.protocol === "https:" &&
      ["instagram.com", "www.instagram.com"].includes(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

export function hashtagResultUrl(href: string, hashtag: string) {
  const url = instagramUrl(href);
  if (!url) return null;
  const tag = url.pathname.match(/^\/explore\/tags\/([^/]+)\/?$/)?.[1];
  try {
    if (
      tag &&
      normalizeHashtag(decodeURIComponent(tag)) === normalizeHashtag(hashtag)
    )
      return url.toString();
    if (
      url.pathname === "/explore/search/keyword/" &&
      url.searchParams.get("q")?.startsWith("#") &&
      normalizeHashtag(url.searchParams.get("q")!) === normalizeHashtag(hashtag)
    )
      return url.toString();
  } catch {
    /* Invalid escaped result is not a hashtag. */
  }
  return null;
}

export function instagramPostFromHref(href: string) {
  const url = instagramUrl(href);
  const match = url?.pathname.match(
    /^\/(p|reel|reels)\/([A-Za-z0-9_-]{3,64})\/?$/,
  );
  return match
    ? {
        postKey: match[2],
        postUrl: `https://www.instagram.com/${match[1] === "p" ? "p" : "reel"}/${match[2]}/`,
      }
    : null;
}

// Only authorship evidence, never links in comments, captions or recommendations.
export function postAuthorFromSignals(input: {
  headerHrefs: string[];
  title?: string | null;
  structuredAuthors?: string[];
}) {
  const headers = [
    ...new Set(
      input.headerHrefs.flatMap(
        (href) => instagramUsernameFromHref(href) || [],
      ),
    ),
  ];
  if (headers.length === 1) return headers[0];
  if (headers.length > 1) return null; // Ambiguous/coauthored layout: fail closed.
  const structured = [
    ...new Set(
      (input.structuredAuthors || []).flatMap(
        (href) => instagramUsernameFromHref(href) || [],
      ),
    ),
  ];
  if (structured.length === 1) return structured[0];
  const handle = input.title?.match(/\(@([A-Za-z0-9._]{1,30})\)/)?.[1];
  return handle ? instagramUsernameFromHref(`/${handle}/`) : null;
}

export type RememberedHashtagPost = {
  hashtag: string;
  postKey: string;
  postUrl: string;
  instagramUsername: string | null;
  status: string;
  revisitAfter: string | null;
};
export type HashtagDiscoveryOptions = {
  rememberedHashtagPosts?: RememberedHashtagPost[];
  onHashtagLinks?: (
    hashtag: string,
    posts: Array<{ postKey: string; postUrl: string }>,
  ) => Promise<void>;
  onHashtagPost?: (
    hashtag: string,
    postKey: string,
    username: string | null,
  ) => Promise<void>;
  onHashtagProfileUnavailable?: (
    hashtag: string,
    username: string,
  ) => Promise<void>;
};
