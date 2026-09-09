import type { BusinessConfig } from "../../config/business";
import type { OutboundFunnel } from "./domain";

const INSTAGRAM_RESERVED_PATHS = new Set([
  "about",
  "accounts",
  "api",
  "blog",
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
  "press",
  "reel",
  "reels",
  "stories",
  "terms",
  "topics",
  "tv",
  "web",
]);

export const DISCOVERY_STRATEGIES = [
  "instagram_search",
  "instagram_followers",
  "local_business",
] as const;

export type DiscoveryStrategy = (typeof DISCOVERY_STRATEGIES)[number];

export type DiscoverySeed = {
  kind: "keyword" | "hashtag" | "location" | "base_profile" | "local_business";
  value: string;
};

export type DiscoverySeedPerformance = {
  kind: DiscoverySeed["kind"];
  value: string;
  profilesInspected: number;
  profilesQualified: number;
  profilesCreated: number;
  lastSearchedAt?: string | null;
};

export type PublicInstagramCandidate = {
  instagramUsername: string;
  name?: string;
  sourceUrl: string;
  profileCategory?: string;
  profileBio?: string;
  profileLocation?: string;
  publicSignal?: string;
  discoveryKind?: DiscoverySeed["kind"];
  discoveryQuery: string;
};

export type PublicLocalBusinessOpportunity = {
  businessName: string;
  niche: string;
  location: string;
  address?: string;
  phone?: string;
  googleMapsUrl: string;
  websiteUrl?: string;
  instagramUsername?: string;
  status: "website_opportunity" | "instagram_not_found";
  notes?: string;
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

export function normalizeDiscoveryStrategy(value: unknown): DiscoveryStrategy {
  return DISCOVERY_STRATEGIES.includes(value as DiscoveryStrategy)
    ? value as DiscoveryStrategy
    : "instagram_search";
}

export function parseInstagramBaseProfiles(value: string, maximum = 8) {
  const handles = value.split(/[,;\n]/).map((item) => {
    const trimmed = item.trim();
    const fromUrl = instagramUsernameFromHref(trimmed);
    return (fromUrl || trimmed.replace(/^@/, "")).toLocaleLowerCase("en-US");
  });
  return [...new Set(handles)]
    .filter((handle) => /^[a-z0-9._]{1,30}$/.test(handle))
    .slice(0, maximum);
}

export function parseInstagramFollowerCount(value: string | null | undefined) {
  if (!value) return null;
  const normalized = normalize(value).replace(/\u00a0/g, " ");
  const match = normalized.match(
    /([\d.,]+)\s*(bilhao|bilhoes|bi|billion|bil|milhao|milhoes|mi|million|m|mil|thousand|k)?\s+(?:followers?|seguidores?)/i,
  );
  if (!match) return null;
  let numeric = match[1];
  const suffix = match[2] || "";
  const decimalSuffix = /^(bilhao|bilhoes|bi|billion|bil|milhao|milhoes|mi|million|m|mil|thousand|k)$/i.test(suffix);
  if (decimalSuffix) {
    numeric = numeric.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  } else {
    numeric = numeric.replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  }
  const base = Number(numeric);
  if (!Number.isFinite(base)) return null;
  const multiplier = /^(bilhao|bilhoes|bi|billion|bil)$/i.test(suffix)
    ? 1_000_000_000
    : /^(milhao|milhoes|mi|million|m)$/i.test(suffix)
      ? 1_000_000
      : /^(mil|thousand|k)$/i.test(suffix)
        ? 1_000
        : 1;
  return Math.round(base * multiplier);
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
  }).slice(0, input.maximum ?? seeds.length);
}

export function discoverySeedKey(seed: DiscoverySeed) {
  return `${seed.kind}:${normalize(seed.value)}`;
}

function balancedRotatedSeeds(seeds: DiscoverySeed[], cursor: number) {
  const kinds: DiscoverySeed["kind"][] = [
    "hashtag",
    "keyword",
    "location",
    "base_profile",
    "local_business",
  ];
  const safeCursor = Number.isFinite(cursor) ? Math.max(0, Math.trunc(cursor)) : 0;
  const orderedKinds = kinds.map((_, index) => kinds[(index + safeCursor) % kinds.length]);
  const buckets = new Map(
    kinds.map((kind) => {
      const values = seeds.filter((seed) => seed.kind === kind);
      if (!values.length) return [kind, values] as const;
      const offset = safeCursor % values.length;
      return [kind, [...values.slice(offset), ...values.slice(0, offset)]] as const;
    }),
  );
  const result: DiscoverySeed[] = [];
  let index = 0;
  while (result.length < seeds.length) {
    let added = false;
    for (const kind of orderedKinds) {
      const seed = buckets.get(kind)?.[index];
      if (!seed) continue;
      result.push(seed);
      added = true;
    }
    if (!added) break;
    index += 1;
  }
  return result;
}

export function selectDiscoverySeedsForRun(input: {
  seeds: DiscoverySeed[];
  cursor: number;
  maximum?: number;
  performance?: DiscoverySeedPerformance[];
  explorationPercent?: number;
}) {
  const maximum = Math.min(
    input.seeds.length,
    Math.max(1, Math.trunc(input.maximum ?? 10)),
  );
  if (!maximum) return [];
  const rotated = balancedRotatedSeeds(input.seeds, input.cursor);
  const availableKeys = new Set(input.seeds.map(discoverySeedKey));
  const ranked = [...(input.performance || [])]
    .filter((item) => availableKeys.has(discoverySeedKey(item)))
    .filter((item) => item.profilesQualified > 0 || item.profilesCreated > 0)
    .sort((left, right) => {
      const leftYield = (left.profilesCreated * 3 + left.profilesQualified) /
        Math.max(1, left.profilesInspected);
      const rightYield = (right.profilesCreated * 3 + right.profilesQualified) /
        Math.max(1, right.profilesInspected);
      const leftLastUsed = Date.parse(left.lastSearchedAt || "") || 0;
      const rightLastUsed = Date.parse(right.lastSearchedAt || "") || 0;
      return rightYield - leftYield ||
        leftLastUsed - rightLastUsed;
    });
  const explorationPercent = Math.min(100, Math.max(0, input.explorationPercent ?? 30));
  const explorationSlots = Math.max(1, Math.ceil(maximum * explorationPercent / 100));
  const exploitationSlots = maximum - explorationSlots;
  const selected: DiscoverySeed[] = [];
  const selectedKeys = new Set<string>();
  for (const item of ranked.slice(0, exploitationSlots)) {
    const seed = input.seeds.find((candidate) => discoverySeedKey(candidate) === discoverySeedKey(item));
    if (!seed) continue;
    selected.push(seed);
    selectedKeys.add(discoverySeedKey(seed));
  }
  for (const seed of rotated) {
    if (selected.length >= maximum) break;
    const key = discoverySeedKey(seed);
    if (selectedKeys.has(key)) continue;
    selected.push(seed);
    selectedKeys.add(key);
  }
  return selected;
}

export function instagramUsernameFromHref(href: string) {
  let pathname: string;
  try {
    const url = new URL(href, "https://www.instagram.com");
    if (
      /^(?:https?:)?\/\//i.test(href) &&
      !["instagram.com", "www.instagram.com"].includes(url.hostname.toLocaleLowerCase("en-US"))
    ) return null;
    pathname = url.pathname;
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
  discoveryKind?: DiscoverySeed["kind"];
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
  const profileBio = lines.slice(0, 6).join(" · ").slice(0, 500) || undefined;
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
    discoveryKind: input.discoveryKind,
    discoveryQuery: input.discoveryQuery,
  };
}

export function isLikelyCommercialInstagramProfile(
  candidate: PublicInstagramCandidate,
) {
  const searchable = normalize([
    candidate.instagramUsername.replace(/[._-]+/g, " "),
    candidate.name,
    candidate.profileCategory,
    candidate.profileBio,
    candidate.publicSignal,
  ].filter(Boolean).join(" "));
  const commercialSignals = [
    /\b(loja|lojinha|store|shop|shopping|empresa|marca|negocio|atacado|varejo)\b/u,
    /\b(atelie|studio|estudio|agencia|consultoria|fornecedor|revendedor|distribuidor)\b/u,
    /\b(empreendedor|empreendedora|empresario|empresaria|criador de conteudo|influenciador|influenciadora)\b/u,
    /\b(encomenda|encomendas|orcamento|orcamentos|pedidos|atendimento|compre|compras)\b/u,
    /\b(frete|envio|envios|delivery|catalogo|servicos|produto e servico|produtos e servicos)\b/u,
    /\b(cnpj|whatsapp comercial|link na bio|chame no direct|chama no direct)\b/u,
    /\b(shopee|shp[ .]?ee|mercado livre|elo7|ifood|linktree|linktr[ .]?ee)\b/u,
  ];
  return commercialSignals.some((signal) => signal.test(searchable));
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
