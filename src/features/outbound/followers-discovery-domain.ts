import type { PublicInstagramCandidate } from "./discovery-domain";

export const FOLLOWER_STOP_LABELS = {
  followers_target_reached: "Meta de novos prospectos atingida",
  followers_inspection_limit: "Limite de inspeções desta execução atingido",
  followers_time_limit: "Tempo máximo da busca de seguidores atingido",
  followers_scroll_limit: "Limite de rolagens da lista de seguidores atingido",
  followers_list_end: "Fim da lista de seguidores disponibilizada",
  followers_restricted_list:
    "Lista parcial disponibilizada pelo Instagram percorrida",
  followers_no_new_results: "A lista de seguidores não carregou novos usuários",
  followers_list_unavailable:
    "A lista de seguidores não pôde ser aberta ou carregada",
  followers_interrupted:
    "Leitura de seguidores interrompida; pendências preservadas",
  followers_no_eligible_base:
    "Nenhum perfil-base atende ao mínimo de seguidores",
} as const;
export type FollowersProgress = {
  stopReason: keyof typeof FOLLOWER_STOP_LABELS;
  visibleUsers: number;
  skippedKnownUsers: number;
  scrolls: number;
  pendingUsers: number;
  limitedBaseProfiles: string[];
};
export function followersProgressSummary(value?: string | null) {
  try {
    const p = JSON.parse(value || "null") as FollowersProgress | null;
    if (
      !p ||
      ![p.visibleUsers, p.skippedKnownUsers, p.scrolls, p.pendingUsers].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) ||
      !Array.isArray(p.limitedBaseProfiles)
    )
      return null;
    const limited = p.limitedBaseProfiles.length
      ? " · O Instagram restringiu a lista; não representa todos os seguidores."
      : "";
    return `${p.visibleUsers} usuários na lista · ${p.skippedKnownUsers} conhecidos ignorados · ${p.scrolls} rolagens · ${p.pendingUsers} pendentes${limited}`;
  } catch {
    return null;
  }
}
export type FollowersDiscoveryOptions = {
  pendingFollowers?: Array<{ baseUsername: string; instagramUsername: string }>;
  onFollowerLinks?: (
    baseUsername: string,
    usernames: string[],
  ) => Promise<void>;
  onFollowerBatch?: (input: {
    baseUsername: string;
    candidates: PublicInstagramCandidate[];
    inspectedUsernames: string[];
    unreadableUsernames: string[];
  }) => Promise<number>;
};
export class FollowersDiscoveryError extends Error {
  constructor(
    message: string,
    public progress: FollowersProgress,
  ) {
    super(message);
    this.name = "FollowersDiscoveryError";
  }
}
