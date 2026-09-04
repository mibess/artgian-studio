import type { BusinessConfig } from "../../config/business";
import type { OutboundFunnel } from "./domain";

const INSTAGRAM_RESERVED_PATHS = new Set([
  "about",
  "accounts",
  "api",
  "challenge",
  "developer",
  "direct",
  "directory",
  "emails",
  "explore",
  "legal",
  "p",
  "popular",
  "privacy",
  "reel",
  "reels",
  "stories",
  "terms",
  "tv",
  "web",
]);

export type DiscoverySeed = {
  kind: "keyword" | "hashtag" | "location";
  value: string;
};

export type PublicInstagramCandidate = {
  instagramUsername: string;
  name?: string;
  sourceUrl: string;
  profileCategory?: string;
  profileBio?: string;
  profileLocation?: string;
  publicSignal?: string;
  discoveryQuery: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseStoredDiscoveryTerms(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return uniqueDiscoveryTerms(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return uniqueDiscoveryTerms(value.split(/[,;\n]/));
  }
}

export function parseDiscoveryTermsInput(value: string, maximum = 12) {
  return uniqueDiscoveryTerms(value.split(/[,;\n]/)).slice(0, maximum);
}

function uniqueDiscoveryTerms(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, 80);
    const key = normalize(value);
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function buildDiscoverySeeds(input: {
  funnelType: OutboundFunnel;
  segment?: string | null;
  keywords: string[];
  hashtags: string[];
  locations: string[];
  business: BusinessConfig;
  maximum?: number;
}) {
  const fallbackSegments = input.funnelType === "partner"
    ? input.business.partnershipSegments
    : input.business.icpSegments;
  const keywords = uniqueDiscoveryTerms([
    ...input.keywords,
    ...(input.keywords.length ? [] : input.business.icpKeywords),
    ...(input.segment ? [input.segment] : []),
    ...fallbackSegments,
  ]);
  const locations = uniqueDiscoveryTerms([
    ...input.locations,
    ...(input.locations.length ? [] : [input.business.targetGeography]),
  ]);
  const seeds: DiscoverySeed[] = [
    ...input.hashtags.map((value) => ({ kind: "hashtag" as const, value })),
    ...keywords.map((value) => ({ kind: "keyword" as const, value })),
    ...locations.map((value) => ({ kind: "location" as const, value })),
  ];
  const seen = new Set<string>();
  return seeds.filter((seed) => {
    const key = `${seed.kind}:${normalize(seed.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, input.maximum ?? 10);
}

export function instagramUsernameFromHref(href: string) {
  let pathname: string;
  try {
    pathname = new URL(href, "https://www.instagram.com").pathname;
  } catch {
    return null;
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const username = parts[0].toLocaleLowerCase("en-US");
  if (
    INSTAGRAM_RESERVED_PATHS.has(username) ||
    !/^[a-z0-9._]{1,30}$/.test(username)
  ) {
    return null;
  }
  return username;
}

function usefulProfileLines(mainText: string, username: string, name?: string) {
  const ignored = /^(follow|following|followers?|posts?|message|contact|seguir|seguindo|seguidores?|publica[cç][oõ]es|mensagem|contato|ver tradu[cç][aã]o)$/i;
  const identity = new Set([normalize(username), normalize(name || "")]);
  return mainText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      if (line.length < 3 || line.length > 180) return false;
      const normalized = normalize(line.replace(/^@/, ""));
      if (!normalized || identity.has(normalized) || ignored.test(normalized)) return false;
      if (/^[\d.,]+\s*(followers?|seguidores?|following|seguindo|posts?|publica[cç][oõ]es)$/i.test(line)) return false;
      return true;
    });
}

export function extractPublicInstagramCandidate(input: {
  username: string;
  sourceUrl: string;
  discoveryQuery: string;
  title?: string | null;
  description?: string | null;
  mainText?: string | null;
  knownLocations?: string[];
}) : PublicInstagramCandidate | null {
  const unavailableText = `${input.title || ""} ${input.description || ""} ${input.mainText || ""}`;
  if (/page isn't available|p[aá]gina n[aã]o est[aá] dispon[ií]vel|perfil n[aã]o encontrado/i.test(unavailableText)) {
    return null;
  }
  const title = input.title?.trim() || "";
  const nameMatch = title.match(/^(.+?)\s*\(@[^)]+\)/);
  const name = nameMatch?.[1]?.replace(/\s*[•|].*$/, "").trim().slice(0, 120);
  const lines = usefulProfileLines(input.mainText || "", input.username, name);
  const profileBio = lines.slice(0, 4).join(" · ").slice(0, 500) || undefined;
  const searchable = normalize(`${profileBio || ""} ${input.description || ""}`);
  const profileLocation = uniqueDiscoveryTerms(input.knownLocations || [])
    .find((location) => searchable.includes(normalize(location)));
  const signalLine = lines.find((line) => normalize(line).includes(normalize(input.discoveryQuery))) || lines[0];
  const publicSignal = signalLine
    ? `que você destaca “${signalLine.replace(/[“”"]/g, "'").slice(0, 220)}”`
    : undefined;
  if (!name && !profileBio && !input.description) return null;
  return {
    instagramUsername: input.username,
    name: name || undefined,
    sourceUrl: input.sourceUrl,
    profileBio,
    profileLocation,
    publicSignal,
    discoveryQuery: input.discoveryQuery,
  };
}

export function buildDiscoveryQualificationReason(input: {
  query: string;
  score: number;
  matches: string[];
}) {
  const evidence = input.matches.length
    ? `Sinais compatíveis: ${input.matches.join(", ")}.`
    : "Aderência calculada a partir da bio e dos sinais públicos disponíveis.";
  return `Descoberto automaticamente pela busca “${input.query}”. ${evidence} Score ICP ${input.score}.`.slice(0, 500);
}

export function nextDiscoveryAt(now: Date, intervalHours: number) {
  const safeInterval = Math.min(168, Math.max(6, Math.trunc(intervalHours)));
  return new Date(now.getTime() + safeInterval * 60 * 60 * 1_000).toISOString();
}
