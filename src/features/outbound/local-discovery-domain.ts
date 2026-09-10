import type {
  PublicInstagramCandidate,
  PublicLocalBusinessOpportunity,
} from "./discovery-domain";
import { FOLLOWER_STOP_LABELS } from "./followers-discovery-domain";

// Prefer Google's stable feature ID; tracking, viewport and language are not identity.
export function mapsBusinessKey(value: string): string | null {
  try {
    const url = new URL(value, "https://www.google.com");
    if (
      url.protocol !== "https:" ||
      !["google.com", "www.google.com", "maps.google.com"].includes(
        url.hostname,
      ) ||
      !url.pathname.startsWith("/maps/")
    )
      return null;
    const decoded = decodeURIComponent(url.href);
    const feature = decoded.match(/!1s(0x[\da-f]+:0x[\da-f]+)/i)?.[1];
    if (feature) return `cid:${BigInt(feature.split(":")[1]).toString()}`;
    const cid = url.searchParams.get("cid");
    if (cid && /^\d+$/.test(cid)) return `cid:${BigInt(cid).toString()}`;
    const placeId =
      url.searchParams.get("query_place_id") ||
      decoded.match(/!1s(ChI[^!/?&#]+)/)?.[1];
    if (placeId) return `place:${placeId}`;
    if (!url.pathname.startsWith("/maps/place/")) return null;
    // Without an ID, retain path/coordinates to avoid merging same-name branches.
    return `url:${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

export function localDiscoveryQueryKey(niche: string, location: string) {
  return JSON.stringify(
    [niche, location].map((value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim(),
    ),
  );
}

export const LOCAL_STOP_LABELS = {
  target_reached: "Meta de novos resultados atingida",
  inspection_limit: "Limite de inspeções desta execução atingido",
  time_limit: "Tempo máximo da execução atingido",
  list_end: "Fim da lista de resultados do Maps",
  no_new_results: "A lista não carregou novos resultados após novas tentativas",
  scroll_limit: "Limite de rolagens desta execução atingido",
  load_failed: "Não foi possível carregar a lista de resultados do Maps",
  daily_limit: "Limite diário de novos resultados atingido",
} as const;
export function localStopLabel(reason: string | null | undefined) {
  return reason
    ? LOCAL_STOP_LABELS[reason as LocalStopReason] ||
        FOLLOWER_STOP_LABELS[reason as keyof typeof FOLLOWER_STOP_LABELS] ||
        reason
    : null;
}
export function localProgressSummary(value: string | null | undefined) {
  try {
    const progress = JSON.parse(
      value || "null",
    ) as LocalDiscoveryProgress | null;
    if (
      !progress ||
      ![
        progress.linksSeen,
        progress.skippedKnownBusinesses,
        progress.scrolls,
        progress.pendingBusinesses,
      ].every((n) => Number.isSafeInteger(n) && n >= 0)
    )
      return null;
    return `${progress.linksSeen} empresas na lista · ${progress.skippedKnownBusinesses} conhecidas ignoradas · ${progress.scrolls} rolagens · ${progress.pendingBusinesses} pendentes para continuar`;
  } catch {
    return null;
  }
}
export type LocalStopReason = keyof typeof LOCAL_STOP_LABELS;
export type LocalDiscoveryProgress = {
  stopReason: LocalStopReason;
  linksSeen: number;
  skippedKnownBusinesses: number;
  scrolls: number;
  pendingBusinesses: number;
};
export type LocalDiscoveryBatch = {
  candidates: PublicInstagramCandidate[];
  localOpportunities: PublicLocalBusinessOpportunity[];
  processedUrls: string[];
};
export type LocalDiscoveryOptions = {
  maximumNewResults?: number;
  pendingLocalBusinessUrls?: string[];
  onLocalLinks?: (urls: string[]) => Promise<void>;
  onLocalBatch?: (batch: LocalDiscoveryBatch) => Promise<number>;
};

export function boundedDiscoverySetting(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(1, Math.trunc(number)))
    : fallback;
}
