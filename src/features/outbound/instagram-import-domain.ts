import { instagramUsernameFromHref } from "./discovery-domain";

export function parseImportedInstagramUsername(value: string) {
  const trimmed = value.trim();
  if (/^https:\/\//i.test(trimmed)) return instagramUsernameFromHref(trimmed);
  const username = trimmed.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(username)) return null;
  return instagramUsernameFromHref(`https://www.instagram.com/${username}/`);
}

export type InstagramImportPayload = {
  campaignId: string;
  opportunityId: string;
  instagramUsername: string;
};

export function parseInstagramImportPayload(
  value: string,
): InstagramImportPayload | null {
  try {
    const parsed = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed.campaignId !== "string" ||
      typeof parsed.opportunityId !== "string" ||
      typeof parsed.instagramUsername !== "string"
    )
      return null;
    const instagramUsername = parseImportedInstagramUsername(
      parsed.instagramUsername,
    );
    return instagramUsername
      ? {
          campaignId: parsed.campaignId,
          opportunityId: parsed.opportunityId,
          instagramUsername,
        }
      : null;
  } catch {
    return null;
  }
}

export function isPendingLocalOpportunity(
  opportunity: { status: string; instagramUsername: string | null },
  knownProspectUsernames: Set<string>,
) {
  if (opportunity.status === "instagram_found") return false;
  const username = parseImportedInstagramUsername(
    opportunity.instagramUsername || "",
  );
  return !username || !knownProspectUsernames.has(username);
}
