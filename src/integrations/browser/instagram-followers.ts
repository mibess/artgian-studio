import type { Locator, Page } from "playwright-core";
import {
  instagramUsernameFromHref,
  parseInstagramFollowerCount,
  type DiscoverySeed,
  type PublicInstagramCandidate,
} from "../../features/outbound/discovery-domain";
import {
  FollowersDiscoveryError,
  type FollowersDiscoveryOptions,
  type FollowersProgress,
} from "../../features/outbound/followers-discovery-domain";
import { boundedDiscoverySetting } from "../../features/outbound/local-discovery-domain";
import { pauseLikePerson } from "./human-pacing";
import { randomInteger } from "../../features/automation/human-pacing";

export async function openFollowersList(page: Page) {
  const name =
    /^(?:[\d.,\s\u00a0]+(?:mil|milh[oõ]es|million|[km])?\s*)?(?:seguidores|followers)$/i;
  const main = page.locator("main");
  const link = main.getByRole("link", { name }).first();
  const control = (await link.count())
    ? link
    : main.getByRole("button", { name }).first();
  await control.click({ timeout: 8_000 });
  const dialog = page
    .getByRole("dialog")
    .filter({
      has: page.getByText(/^(Seguidores|Followers)$/i, { exact: true }),
    })
    .last();
  await dialog.waitFor({ state: "visible", timeout: 8_000 });
  return dialog;
}

// Locate the actual scrollable descendant, not the modal shell. Both reading and
// scrolling use the same element; links outside this followers list are ignored.
async function readFollowersList(dialog: Locator, distance = 0) {
  return dialog.evaluate(
    (element, distance) => {
      const containers = [
        element,
        ...Array.from(element.querySelectorAll("div")),
      ].filter(
        (item) =>
          item.clientHeight > 0 &&
          item.scrollHeight > item.clientHeight + 10 &&
          /(auto|scroll)/.test(getComputedStyle(item).overflowY),
      );
      const scroller = containers.sort(
        (a, b) =>
          b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight),
      )[0];
      const root = scroller || element;
      const text = element.textContent || "";
      const result = {
        hrefs: Array.from(root.querySelectorAll("a[href]")).map(
          (a) => a.getAttribute("href") || "",
        ),
        limited:
          /(?:somente|s[oó])\s+.+?pode ver todos os seguidores|only\s+.+?can see all followers/i.test(
            text,
          ),
        empty: /nenhum seguidor|no followers(?: yet)?/i.test(text),
        position: scroller?.scrollTop || 0,
        bottom:
          !scroller ||
          scroller.scrollTop + scroller.clientHeight >=
            scroller.scrollHeight - 4,
      };
      if (distance && scroller)
        scroller.scrollBy({ top: distance, behavior: "smooth" });
      return result;
    },
    distance,
    { timeout: 8_000 },
  );
}

export async function executeFollowersDiscovery(
  page: Page,
  input: FollowersDiscoveryOptions & {
    seeds: DiscoverySeed[];
    maximumProfiles: number;
    maximumNewResults?: number;
    minimumBaseFollowers?: number;
    ownUsername?: string;
    excludedUsernames?: string[];
    knownLocations: string[];
  },
  inspect: (
    page: Page,
    username: string,
    kind: DiscoverySeed["kind"],
    query: string,
    locations: string[],
  ) => Promise<PublicInstagramCandidate | null>,
) {
  const maximumProfiles = boundedDiscoverySetting(
    String(input.maximumProfiles),
    10,
    30,
  );
  const target = boundedDiscoverySetting(
    String(input.maximumNewResults ?? maximumProfiles),
    maximumProfiles,
    30,
  );
  const deadline =
    Date.now() +
    boundedDiscoverySetting(
      process.env.MAX_FOLLOWERS_DISCOVERY_SECONDS,
      900,
      1800,
    ) *
      1000;
  const maximumScrolls = boundedDiscoverySetting(
    process.env.MAX_FOLLOWERS_DISCOVERY_SCROLLS,
    40,
    100,
  );
  const excluded = new Set(
    (input.excludedUsernames || []).map((s) =>
      s.replace(/^@/, "").toLowerCase(),
    ),
  );
  if (input.ownUsername)
    excluded.add(input.ownUsername.replace(/^@/, "").toLowerCase());
  const seen = new Set<string>();
  const skipped = new Set<string>();
  const inspectedUsers = new Set<string>();
  const selectedBases = new Set(
    input.seeds
      .filter((s) => s.kind === "base_profile")
      .slice(0, 8)
      .map((s) => s.value.replace(/^@/, "").toLowerCase()),
  );
  const pendingGlobal = new Set(
    (input.pendingFollowers || [])
      .filter(
        (p) =>
          selectedBases.has(p.baseUsername) &&
          !excluded.has(p.instagramUsername),
      )
      .map((p) => p.instagramUsername),
  );
  const candidates: PublicInstagramCandidate[] = [];
  const scannedSeeds: DiscoverySeed[] = [];
  const progress: FollowersProgress = {
    stopReason: "followers_list_end",
    visibleUsers: 0,
    skippedKnownUsers: 0,
    scrolls: 0,
    pendingUsers: 0,
    limitedBaseProfiles: [],
  };
  let newResults = 0;
  let profilesInspected = 0;
  let profilePage: Page | undefined;
  const snapshot = () => ({
    ...progress,
    pendingUsers: pendingGlobal.size,
    limitedBaseProfiles: [...progress.limitedBaseProfiles],
  });
  const stopByBudget = () => {
    if (newResults >= target) return "followers_target_reached" as const;
    if (profilesInspected >= maximumProfiles)
      return "followers_inspection_limit" as const;
    if (Date.now() >= deadline) return "followers_time_limit" as const;
    return null;
  };
  try {
    for (const seed of input.seeds
      .filter((s) => s.kind === "base_profile")
      .slice(0, 8)) {
      const budget = stopByBudget();
      if (budget) {
        progress.stopReason = budget;
        break;
      }
      const baseUsername = seed.value.replace(/^@/, "").toLowerCase();
      if (!instagramUsernameFromHref(`/${baseUsername}/`)) continue;
      const previousReason = progress.stopReason;
      progress.stopReason = "followers_list_unavailable";
      await page.goto(`https://www.instagram.com/${baseUsername}/`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      if (instagramUsernameFromHref(page.url()) !== baseUsername)
        throw new Error(
          "O perfil-base não carregou. Confira a sessão do Instagram no Chrome.",
        );
      await pauseLikePerson(page, {
        minimumVariable: "DISCOVERY_MIN_PROFILE_DWELL_SECONDS",
        maximumVariable: "DISCOVERY_MAX_PROFILE_DWELL_SECONDS",
        defaultMinimumSeconds: 4,
        defaultMaximumSeconds: 9,
      });
      const [description, text] = await Promise.all([
        page
          .locator('meta[property="og:description"]')
          .getAttribute("content", { timeout: 5_000 })
          .catch(() => null),
        page
          .locator("main")
          .innerText({ timeout: 8_000 })
          .catch(() => null),
      ]);
      const count = parseInstagramFollowerCount(
        `${description || ""} ${text || ""}`,
      );
      if (count === null || count <= (input.minimumBaseFollowers ?? 500_000)) {
        progress.stopReason = previousReason;
        continue;
      }
      let dialog: Locator;
      try {
        dialog = await openFollowersList(page);
      } catch {
        throw new Error(
          "A lista de seguidores não abriu pelo controle do perfil. Nenhum link da página foi tratado como seguidor.",
        );
      }
      scannedSeeds.push(seed);
      profilePage ??= await page.context().newPage();
      const pending: string[] = [];
      const localSeen = new Set<string>();
      const add = (usernames: string[]) => {
        const added: string[] = [];
        for (const username of usernames) {
          if (localSeen.has(username) || username === baseUsername) continue;
          localSeen.add(username);
          if (!seen.has(username)) {
            seen.add(username);
            progress.visibleUsers += 1;
          }
          if (excluded.has(username) || inspectedUsers.has(username)) {
            if (!skipped.has(username)) {
              skipped.add(username);
              progress.skippedKnownUsers += 1;
            }
            continue;
          }
          pending.push(username);
          pendingGlobal.add(username);
          added.push(username);
        }
        return added;
      };
      add(
        (input.pendingFollowers || [])
          .filter((p) => p.baseUsername === baseUsername)
          .map((p) => p.instagramUsername),
      );
      let batchCandidates: PublicInstagramCandidate[] = [];
      let batchUsers: string[] = [];
      let unreadable: string[] = [];
      const flush = async () => {
        if (!batchUsers.length) return;
        if (input.onFollowerBatch)
          newResults += await input.onFollowerBatch({
            baseUsername,
            candidates: batchCandidates,
            inspectedUsernames: batchUsers,
            unreadableUsernames: unreadable,
          });
        else newResults += batchCandidates.length;
        for (const username of batchUsers) pendingGlobal.delete(username);
        batchCandidates = [];
        batchUsers = [];
        unreadable = [];
      };
      let stagnant = 0;
      let previousPosition = -1;
      let receivedList = false;
      while (true) {
        const budget = stopByBudget();
        if (budget) {
          progress.stopReason = budget;
          break;
        }
        // Revalidate the dialog even while consuming a previously saved queue.
        if (!(await dialog.isVisible())) {
          progress.stopReason = "followers_list_unavailable";
          throw new Error("A lista de seguidores foi fechada durante a busca.");
        }
        const state = await readFollowersList(dialog);
        if (
          state.limited &&
          !progress.limitedBaseProfiles.includes(baseUsername)
        )
          progress.limitedBaseProfiles.push(baseUsername);
        const usernames = state.hrefs.flatMap(
          (href) => instagramUsernameFromHref(href) || [],
        );
        const before = localSeen.size;
        const added = add(usernames);
        if (added.length) await input.onFollowerLinks?.(baseUsername, added);
        receivedList ||= usernames.length > 0 || state.empty || state.limited;
        if (!receivedList && pending.length) {
          // A title alone is not enough to consume stale cached followers.
          stagnant += 1;
        } else if (pending.length) {
          progress.stopReason = "followers_interrupted";
          const username = pending.shift()!;
          inspectedUsers.add(username);
          if (profilesInspected)
            await pauseLikePerson(profilePage, {
              minimumVariable: "DISCOVERY_MIN_SECONDS_BETWEEN_PROFILES",
              maximumVariable: "DISCOVERY_MAX_SECONDS_BETWEEN_PROFILES",
              defaultMinimumSeconds: 8,
              defaultMaximumSeconds: 20,
              absoluteMaximumSeconds: 90,
            });
          profilesInspected += 1;
          const candidate = await inspect(
            profilePage,
            username,
            "base_profile",
            seed.value,
            input.knownLocations,
          );
          if (instagramUsernameFromHref(profilePage.url()) !== username)
            throw new Error(
              "O perfil do seguidor redirecionou para uma página inesperada. Confira a sessão do Chrome.",
            );
          if (candidate) {
            candidates.push(candidate);
            batchCandidates.push(candidate);
          } else unreadable.push(username);
          batchUsers.push(username);
          if (batchUsers.length >= Math.min(5, target - newResults))
            await flush();
          continue;
        } else {
          stagnant =
            localSeen.size > before || state.position > previousPosition
              ? 0
              : stagnant + 1;
        }
        previousPosition = state.position;
        if (stagnant >= 4 || state.empty) {
          if (!receivedList) {
            progress.stopReason = "followers_list_unavailable";
            throw new Error(
              "A janela abriu, mas a lista de seguidores não carregou.",
            );
          }
          progress.stopReason = state.limited
            ? "followers_restricted_list"
            : state.bottom
              ? "followers_list_end"
              : "followers_no_new_results";
          break;
        }
        if (progress.scrolls >= maximumScrolls) {
          progress.stopReason = "followers_scroll_limit";
          break;
        }
        await readFollowersList(dialog, randomInteger(400, 750));
        progress.scrolls += 1;
        await pauseLikePerson(page, {
          minimumVariable: "DISCOVERY_MIN_RESULTS_WAIT_SECONDS",
          maximumVariable: "DISCOVERY_MAX_RESULTS_WAIT_SECONDS",
          defaultMinimumSeconds: 3,
          defaultMaximumSeconds: 6,
        });
      }
      await flush();
      const budgetAfterBatch = stopByBudget();
      if (budgetAfterBatch) {
        progress.stopReason = budgetAfterBatch;
        break;
      }
      if (progress.scrolls >= maximumScrolls) break;
    }
    if (!scannedSeeds.length && !stopByBudget()) {
      progress.stopReason = "followers_no_eligible_base";
      throw new Error(
        `Nenhum perfil-base possui mais de ${(input.minimumBaseFollowers ?? 500_000).toLocaleString("pt-BR")} seguidores verificáveis.`,
      );
    }
    return {
      candidates: input.onFollowerBatch ? [] : candidates,
      queriesScanned: scannedSeeds.length,
      profilesInspected,
      scannedSeeds,
      followerProgress: snapshot(),
    };
  } catch (error) {
    throw new FollowersDiscoveryError(
      error instanceof Error ? error.message : "Falha na leitura de seguidores",
      snapshot(),
    );
  } finally {
    await profilePage?.close().catch(() => undefined);
  }
}
