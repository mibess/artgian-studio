import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import {
  extractPublicInstagramCandidate,
  instagramUsernameFromGoogleWebResult,
  instagramUsernameFromHref,
  LOCAL_WEB_RESULTS_VERIFIED_MARKER,
  normalizeLocalDiscoveryTerm,
  parseInstagramFollowerCount,
  type DiscoverySeed,
  type DiscoveryStrategy,
  type PublicInstagramCandidate,
  type PublicLocalBusinessOpportunity,
} from "../../features/outbound/discovery-domain";
import { randomInteger } from "../../features/automation/human-pacing";
import { pauseLikePerson, typeLikePerson } from "./human-pacing";

const ALLOWED_HOSTS = new Set(["www.instagram.com", "instagram.com"]);
let discoveryJobRunning = false;

type BrowserDiscoveryInput = {
  jobId: string;
  strategy?: DiscoveryStrategy;
  seeds: DiscoverySeed[];
  maximumProfiles: number;
  knownLocations: string[];
  minimumBaseFollowers?: number;
  localNiche?: string;
  localLocation?: string;
  ownUsername?: string;
  excludedUsernames?: string[];
  excludedLocalBusinessUrls?: string[];
};

function assertInstagramUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("Descoberta bloqueada: navegação fora do Instagram.");
  }
  if (url.pathname.startsWith("/accounts/login")) {
    throw new InstagramDiscoveryError(
      "A sessão do Chrome dedicado precisa entrar novamente no Instagram.",
      "unavailable",
    );
  }
}

async function profileCandidateFromPage(
  page: Page,
  username: string,
  discoveryKind: DiscoverySeed["kind"],
  discoveryQuery: string,
  knownLocations: string[],
) {
  const sourceUrl = `https://www.instagram.com/${username}/`;
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assertInstagramUrl(page.url());
  await pauseLikePerson(page, {
    minimumVariable: "DISCOVERY_MIN_PROFILE_DWELL_SECONDS",
    maximumVariable: "DISCOVERY_MAX_PROFILE_DWELL_SECONDS",
    defaultMinimumSeconds: 6,
    defaultMaximumSeconds: 14,
    absoluteMaximumSeconds: 45,
  });
  const [title, description, mainText] = await Promise.all([
    page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null),
    page.locator('meta[property="og:description"]').getAttribute("content").catch(() => null),
    page.locator("main").innerText({ timeout: 8_000 }).catch(() => null),
  ]);
  return extractPublicInstagramCandidate({
    username,
    sourceUrl,
    discoveryKind,
    discoveryQuery,
    title,
    description,
    mainText,
    knownLocations,
  });
}

export async function executeInstagramDiscoveryOnPage(
  page: Page,
  input: {
    seeds: DiscoverySeed[];
    maximumProfiles: number;
    knownLocations: string[];
    ownUsername?: string;
    excludedUsernames?: string[];
  },
) {
  const maximumProfiles = Math.min(30, Math.max(1, Math.trunc(input.maximumProfiles)));
  const ownUsername = input.ownUsername?.replace(/^@/, "").toLocaleLowerCase("en-US");
  const excludedUsernames = new Set(
    (input.excludedUsernames || []).map((username) => username.toLocaleLowerCase("en-US")),
  );
  const discovered = new Map<string, { username: string; seed: DiscoverySeed }>();
  const scannedSeeds: DiscoverySeed[] = [];
  let queriesScanned = 0;
  await page.goto("https://www.instagram.com/explore/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assertInstagramUrl(page.url());
  await pauseLikePerson(page, {
    minimumVariable: "DISCOVERY_MIN_ACTION_DELAY_SECONDS",
    maximumVariable: "DISCOVERY_MAX_ACTION_DELAY_SECONDS",
    defaultMinimumSeconds: 2,
    defaultMaximumSeconds: 5,
  });
  const searchInput = page.getByPlaceholder(/^(Pesquisar|Search)$/i);
  await searchInput.waitFor({ state: "visible", timeout: 15_000 });

  for (const seed of input.seeds.slice(0, 10)) {
    const query = seed.kind === "hashtag"
      ? `#${seed.value.replace(/^#+/, "").replace(/\s+/g, "")}`
      : seed.value;
    await searchInput.focus();
    await searchInput.fill("");
    await pauseLikePerson(page, {
      minimumVariable: "DISCOVERY_MIN_ACTION_DELAY_SECONDS",
      maximumVariable: "DISCOVERY_MAX_ACTION_DELAY_SECONDS",
      defaultMinimumSeconds: 1,
      defaultMaximumSeconds: 3,
    });
    await typeLikePerson(page, searchInput, query);
    await pauseLikePerson(page, {
      minimumVariable: "DISCOVERY_MIN_RESULTS_WAIT_SECONDS",
      maximumVariable: "DISCOVERY_MAX_RESULTS_WAIT_SECONDS",
      defaultMinimumSeconds: 4,
      defaultMaximumSeconds: 8,
    });
    const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href): href is string => Boolean(href)),
    );
    queriesScanned += 1;
    scannedSeeds.push(seed);
    for (const href of hrefs) {
      const username = instagramUsernameFromHref(href);
      if (
        !username ||
        username === ownUsername ||
        excludedUsernames.has(username) ||
        discovered.has(username)
      ) continue;
      discovered.set(username, { username, seed });
      if (discovered.size >= maximumProfiles * 3) break;
    }
    if (discovered.size >= maximumProfiles * 3) break;
    await pauseLikePerson(page, {
      minimumVariable: "DISCOVERY_MIN_SECONDS_BETWEEN_SEARCHES",
      maximumVariable: "DISCOVERY_MAX_SECONDS_BETWEEN_SEARCHES",
      defaultMinimumSeconds: 6,
      defaultMaximumSeconds: 14,
      absoluteMaximumSeconds: 60,
    });
  }

  const candidates: PublicInstagramCandidate[] = [];
  let profilesInspected = 0;
  for (const discoveredProfile of discovered.values()) {
    if (profilesInspected >= maximumProfiles) break;
    if (profilesInspected > 0) {
      await pauseLikePerson(page, {
        minimumVariable: "DISCOVERY_MIN_SECONDS_BETWEEN_PROFILES",
        maximumVariable: "DISCOVERY_MAX_SECONDS_BETWEEN_PROFILES",
        defaultMinimumSeconds: 8,
        defaultMaximumSeconds: 20,
        absoluteMaximumSeconds: 90,
      });
    }
    profilesInspected += 1;
    const candidate = await profileCandidateFromPage(
      page,
      discoveredProfile.username,
      discoveredProfile.seed.kind,
      discoveredProfile.seed.value,
      input.knownLocations,
    );
    if (candidate) candidates.push(candidate);
  }
  return {
    candidates,
    queriesScanned,
    profilesInspected,
    scannedSeeds,
  };
}

async function collectInstagramProfileLinks(page: Page) {
  const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
    anchors
      .map((anchor) => anchor.getAttribute("href"))
      .filter((href): href is string => Boolean(href)),
  );
  return hrefs.flatMap((href) => {
    const username = instagramUsernameFromHref(href);
    return username ? [username] : [];
  });
}

export async function executeInstagramFollowersDiscoveryOnPage(
  page: Page,
  input: Omit<BrowserDiscoveryInput, "jobId" | "strategy">,
) {
  const maximumProfiles = Math.min(30, Math.max(1, Math.trunc(input.maximumProfiles)));
  const minimumFollowers = Math.max(0, Math.trunc(input.minimumBaseFollowers ?? 500_000));
  const ownUsername = input.ownUsername?.replace(/^@/, "").toLocaleLowerCase("en-US");
  const excluded = new Set(
    (input.excludedUsernames || []).map((username) => username.toLocaleLowerCase("en-US")),
  );
  const discovered = new Map<string, { username: string; seed: DiscoverySeed }>();
  const scannedSeeds: DiscoverySeed[] = [];
  let profilesInspected = 0;

  for (const seed of input.seeds.filter((item) => item.kind === "base_profile").slice(0, 8)) {
    const baseUsername = seed.value.replace(/^@/, "").toLocaleLowerCase("en-US");
    await page.goto(`https://www.instagram.com/${baseUsername}/`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    assertInstagramUrl(page.url());
    await pauseLikePerson(page, {
      minimumVariable: "DISCOVERY_MIN_PROFILE_DWELL_SECONDS",
      maximumVariable: "DISCOVERY_MAX_PROFILE_DWELL_SECONDS",
      defaultMinimumSeconds: 4,
      defaultMaximumSeconds: 9,
      absoluteMaximumSeconds: 45,
    });
    const [description, mainText] = await Promise.all([
      page.locator('meta[property="og:description"]').getAttribute("content").catch(() => null),
      page.locator("main").innerText({ timeout: 8_000 }).catch(() => null),
    ]);
    const followers = parseInstagramFollowerCount(`${description || ""} ${mainText || ""}`);
    if (followers == null || followers <= minimumFollowers) continue;

    scannedSeeds.push(seed);
    await page.goto(`https://www.instagram.com/${baseUsername}/followers/`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    assertInstagramUrl(page.url());
    for (let scroll = 0; scroll < 5 && discovered.size < maximumProfiles * 3; scroll += 1) {
      await pauseLikePerson(page, {
        minimumVariable: "DISCOVERY_MIN_RESULTS_WAIT_SECONDS",
        maximumVariable: "DISCOVERY_MAX_RESULTS_WAIT_SECONDS",
        defaultMinimumSeconds: 3,
        defaultMaximumSeconds: 6,
      });
      for (const username of await collectInstagramProfileLinks(page)) {
        if (
          username === baseUsername ||
          username === ownUsername ||
          excluded.has(username) ||
          discovered.has(username)
        ) continue;
        discovered.set(username, { username, seed });
      }
      await page.locator('div[role="dialog"]').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      }).catch(() => page.mouse.wheel(0, 900));
    }
  }

  if (!scannedSeeds.length) {
    throw new InstagramDiscoveryError(
      `Nenhum perfil-base possui mais de ${minimumFollowers.toLocaleString("pt-BR")} seguidores públicos verificáveis.`,
      "rejected",
    );
  }

  const candidates: PublicInstagramCandidate[] = [];
  for (const profile of discovered.values()) {
    if (profilesInspected >= maximumProfiles) break;
    if (profilesInspected > 0) {
      await pauseLikePerson(page, {
        minimumVariable: "DISCOVERY_MIN_SECONDS_BETWEEN_PROFILES",
        maximumVariable: "DISCOVERY_MAX_SECONDS_BETWEEN_PROFILES",
        defaultMinimumSeconds: 8,
        defaultMaximumSeconds: 20,
        absoluteMaximumSeconds: 90,
      });
    }
    profilesInspected += 1;
    const candidate = await profileCandidateFromPage(
      page,
      profile.username,
      "base_profile",
      profile.seed.value,
      input.knownLocations,
    );
    if (candidate) candidates.push(candidate);
  }
  return {
    candidates,
    localOpportunities: [] as PublicLocalBusinessOpportunity[],
    queriesScanned: scannedSeeds.length,
    profilesInspected,
    scannedSeeds,
  };
}

function isSafePublicWebsiteUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const hostname = url.hostname.toLocaleLowerCase("en-US");
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^(?:fc|fd|fe8|fe9|fea|feb)[0-9a-f:]*$/i.test(hostname)
    ) return false;
    return true;
  } catch {
    return false;
  }
}

function isGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value, "https://www.google.com");
    return url.protocol === "https:" &&
      (url.hostname === "google.com" || url.hostname.endsWith(".google.com")) &&
      url.pathname.startsWith("/maps/");
  } catch {
    return false;
  }
}

async function firstText(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const text = await page.locator(selector).first().innerText({ timeout: 2_000 }).catch(() => "");
    if (text.trim()) return text.trim();
  }
  return "";
}

async function firstHref(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const href = await page.locator(selector).first().getAttribute("href").catch(() => null);
    if (href) return href;
  }
  return null;
}

async function findInstagramOnCurrentPage(page: Page) {
  const signals: Array<{ href?: string; text?: string }> = [];
  for (const frame of page.frames()) {
    const frameSignals = await frame.locator("a[href], button, [role='button']").evaluateAll((elements) =>
      elements.flatMap((element) => {
        const href = element.getAttribute("href") || undefined;
        const text = [
          element.getAttribute("aria-label"),
          element.textContent,
        ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
        const searchable = `${href || ""} ${text}`.toLocaleLowerCase("en-US");
        return searchable.includes("instagram") ? [{ href, text }] : [];
      }),
    ).catch(() => [] as Array<{ href?: string; text?: string }>);
    signals.push(...frameSignals);
  }
  for (const signal of signals) {
    const username = instagramUsernameFromGoogleWebResult(signal);
    if (username) return username;
  }
  return null;
}

async function revealGoogleMapsWebResults(page: Page) {
  const webResultsHeading = page.getByText(/^(Resultados da Web|Web results)$/i).first();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await webResultsHeading.isVisible().catch(() => false)) break;
    const distance = randomInteger(320, 760);
    const moved = await page.evaluate((distance) => {
      const heading = document.querySelector("h1");
      let current: Element | null = heading;
      while (current) {
        const style = window.getComputedStyle(current);
        if (
          current.scrollHeight > current.clientHeight + 80 &&
          /(auto|scroll)/.test(style.overflowY)
        ) {
          const before = current.scrollTop;
          current.scrollBy({ top: distance, behavior: "smooth" });
          return current.scrollTop !== before;
        }
        current = current.parentElement;
      }
      return false;
    }, distance).catch(() => false);
    if (!moved) break;
    await pauseLikePerson(page, {
      minimumVariable: "DISCOVERY_MIN_SCROLL_PAUSE_SECONDS",
      maximumVariable: "DISCOVERY_MAX_SCROLL_PAUSE_SECONDS",
      defaultMinimumSeconds: 0.45,
      defaultMaximumSeconds: 1.2,
      absoluteMaximumSeconds: 4,
    });
  }
  if (await webResultsHeading.isVisible().catch(() => false)) {
    await webResultsHeading.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseLikePerson(page, {
      minimumVariable: "DISCOVERY_MIN_SCROLL_PAUSE_SECONDS",
      maximumVariable: "DISCOVERY_MAX_SCROLL_PAUSE_SECONDS",
      defaultMinimumSeconds: 0.45,
      defaultMaximumSeconds: 1.2,
      absoluteMaximumSeconds: 4,
    });
  }
}

export async function findInstagramOnGoogleMapsListing(page: Page) {
  await revealGoogleMapsWebResults(page);
  return findInstagramOnCurrentPage(page);
}

async function searchGoogleMapsLikePerson(page: Page, query: string) {
  const fallbackUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  await page.goto("https://www.google.com/maps/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (!isGoogleMapsUrl(page.url())) {
    throw new InstagramDiscoveryError("O Google Maps abriu uma página inesperada.", "rejected");
  }
  await pauseLikePerson(page, {
    minimumVariable: "DISCOVERY_MIN_ACTION_DELAY_SECONDS",
    maximumVariable: "DISCOVERY_MAX_ACTION_DELAY_SECONDS",
    defaultMinimumSeconds: 2,
    defaultMaximumSeconds: 5,
  });
  const searchInput = page.locator("#searchboxinput").first();
  if (!await searchInput.isVisible().catch(() => false)) {
    await page.goto(fallbackUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return;
  }
  await searchInput.focus();
  await searchInput.fill("");
  await typeLikePerson(page, searchInput, query);
  await pauseLikePerson(page, {
    minimumVariable: "DISCOVERY_MIN_ACTION_DELAY_SECONDS",
    maximumVariable: "DISCOVERY_MAX_ACTION_DELAY_SECONDS",
    defaultMinimumSeconds: 1,
    defaultMaximumSeconds: 3,
  });
  await searchInput.press("Enter");
  await page.waitForURL(/google\.com\/maps\/(?:search|place)\//i, { timeout: 15_000 })
    .catch(() => undefined);
}

export async function executeLocalBusinessDiscoveryOnPage(
  page: Page,
  input: Omit<BrowserDiscoveryInput, "jobId" | "strategy">,
) {
  const niche = normalizeLocalDiscoveryTerm(input.localNiche || "");
  const location = normalizeLocalDiscoveryTerm(input.localLocation || "");
  if (!niche || !location) {
    throw new InstagramDiscoveryError("Informe o nicho e a localização da busca local.", "rejected");
  }
  const seed = input.seeds.find((item) => item.kind === "local_business") || {
    kind: "local_business" as const,
    value: `${niche} em ${location}`,
  };
  const maximumProfiles = Math.min(30, Math.max(1, Math.trunc(input.maximumProfiles)));
  const excludedUsernames = new Set(
    (input.excludedUsernames || []).map((username) => username.toLocaleLowerCase("en-US")),
  );
  const excludedMapsUrls = new Set(input.excludedLocalBusinessUrls || []);
  await searchGoogleMapsLikePerson(page, `${niche} em ${location}`);
  if (!isGoogleMapsUrl(page.url())) {
    throw new InstagramDiscoveryError("O Google Maps redirecionou a busca para uma página inesperada.", "rejected");
  }
  await pauseLikePerson(page, {
    minimumVariable: "DISCOVERY_MIN_RESULTS_WAIT_SECONDS",
    maximumVariable: "DISCOVERY_MAX_RESULTS_WAIT_SECONDS",
    defaultMinimumSeconds: 4,
    defaultMaximumSeconds: 8,
  });
  const mapsLinks = await page.locator('a[href*="/maps/place/"]').evaluateAll((anchors) =>
    [...new Set(anchors.flatMap((anchor) => {
      const href = anchor.getAttribute("href");
      return href ? [href] : [];
    }))],
  );
  const candidates: PublicInstagramCandidate[] = [];
  const localOpportunities: PublicLocalBusinessOpportunity[] = [];
  let profilesInspected = 0;

  for (const rawMapsUrl of mapsLinks) {
    if (profilesInspected >= maximumProfiles) break;
    const mapsUrl = new URL(rawMapsUrl, "https://www.google.com").toString();
    if (!isGoogleMapsUrl(mapsUrl) || excludedMapsUrls.has(mapsUrl)) continue;
    if (profilesInspected > 0) {
      await pauseLikePerson(page, {
        minimumVariable: "DISCOVERY_MIN_SECONDS_BETWEEN_PROFILES",
        maximumVariable: "DISCOVERY_MAX_SECONDS_BETWEEN_PROFILES",
        defaultMinimumSeconds: 8,
        defaultMaximumSeconds: 20,
        absoluteMaximumSeconds: 90,
      });
    }
    await page.goto(mapsUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!isGoogleMapsUrl(page.url())) continue;
    await pauseLikePerson(page, {
      minimumVariable: "DISCOVERY_MIN_PROFILE_DWELL_SECONDS",
      maximumVariable: "DISCOVERY_MAX_PROFILE_DWELL_SECONDS",
      defaultMinimumSeconds: 4,
      defaultMaximumSeconds: 8,
      absoluteMaximumSeconds: 45,
    });
    profilesInspected += 1;
    const businessName = await firstText(page, ["h1", '[role="main"] h1']) || "Empresa local";
    const address = await firstText(page, [
      '[data-item-id="address"]',
      'button[data-item-id="address"]',
      'button[aria-label^="Endereço:"]',
      'button[aria-label^="Address:"]',
    ]);
    const phone = await firstText(page, [
      '[data-item-id^="phone:"]',
      'button[data-item-id^="phone:"]',
      'button[aria-label^="Telefone:"]',
      'button[aria-label^="Phone:"]',
    ]);
    let instagramUsername = await findInstagramOnGoogleMapsListing(page);
    const websiteHref = await firstHref(page, [
      'a[data-item-id="authority"]',
      'a[aria-label^="Site:"]',
      'a[aria-label^="Website:"]',
    ]);
    const websiteUrl = isSafePublicWebsiteUrl(websiteHref) ? websiteHref! : undefined;

    if (!instagramUsername && websiteUrl) {
      await pauseLikePerson(page, {
        minimumVariable: "DISCOVERY_MIN_ACTION_DELAY_SECONDS",
        maximumVariable: "DISCOVERY_MAX_ACTION_DELAY_SECONDS",
        defaultMinimumSeconds: 2,
        defaultMaximumSeconds: 5,
      });
      await page.goto(websiteUrl, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
      if (isSafePublicWebsiteUrl(page.url())) {
        await pauseLikePerson(page, {
          minimumVariable: "DISCOVERY_MIN_RESULTS_WAIT_SECONDS",
          maximumVariable: "DISCOVERY_MAX_RESULTS_WAIT_SECONDS",
          defaultMinimumSeconds: 2,
          defaultMaximumSeconds: 5,
        });
        instagramUsername = await findInstagramOnCurrentPage(page);
      }
    }

    if (instagramUsername) {
      localOpportunities.push({
        businessName,
        niche,
        location,
        address: address || undefined,
        phone: phone || undefined,
        googleMapsUrl: mapsUrl,
        websiteUrl,
        instagramUsername,
        status: "instagram_found",
        notes: `${LOCAL_WEB_RESULTS_VERIFIED_MARKER} Instagram @${instagramUsername} identificado automaticamente.`,
      });
      if (excludedUsernames.has(instagramUsername)) continue;
      await pauseLikePerson(page, {
        minimumVariable: "DISCOVERY_MIN_ACTION_DELAY_SECONDS",
        maximumVariable: "DISCOVERY_MAX_ACTION_DELAY_SECONDS",
        defaultMinimumSeconds: 2,
        defaultMaximumSeconds: 5,
      });
      const candidate = await profileCandidateFromPage(
        page,
        instagramUsername,
        "local_business",
        seed.value,
        [location, ...input.knownLocations],
      );
      if (candidate) {
        candidates.push({
          ...candidate,
          name: candidate.name || businessName,
          profileLocation: candidate.profileLocation || location,
          publicSignal: candidate.publicSignal || `Empresa encontrada no Google Maps em ${location}`,
          localBusinessUrl: mapsUrl,
        });
      }
      continue;
    }

    localOpportunities.push({
      businessName,
      niche,
      location,
      address: address || undefined,
      phone: phone || undefined,
      googleMapsUrl: mapsUrl,
      websiteUrl,
      status: websiteUrl ? "instagram_not_found" : "website_opportunity",
      notes: websiteUrl
        ? `${LOCAL_WEB_RESULTS_VERIFIED_MARKER} Site encontrado, mas nenhum perfil do Instagram foi identificado automaticamente.`
        : `${LOCAL_WEB_RESULTS_VERIFIED_MARKER} Nenhum site ou Instagram foi identificado; oportunidade de criação de site.`,
    });
  }

  return {
    candidates,
    localOpportunities,
    queriesScanned: 1,
    profilesInspected,
    scannedSeeds: [seed],
  };
}

export class InstagramDiscoveryError extends Error {
  constructor(
    message: string,
    public readonly kind: "rejected" | "unavailable",
  ) {
    super(message);
    this.name = "InstagramDiscoveryError";
  }
}

async function saveDiscoveryDiagnostics(page: Page, jobId: string, errors: string[]) {
  const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const directory = path.join(process.cwd(), "screenshots", "discovery", safeJobId);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    page.screenshot({ path: path.join(directory, "failure.png"), fullPage: true }),
    writeFile(
      path.join(directory, "diagnostics.json"),
      JSON.stringify({ url: page.url(), errors: errors.slice(-20) }, null, 2),
      { mode: 0o600 },
    ),
  ]).catch(() => undefined);
  return directory;
}

export async function discoverInstagramProfiles(input: BrowserDiscoveryInput) {
  if (process.env.INSTAGRAM_DISCOVERY_ENABLED !== "true") {
    throw new InstagramDiscoveryError(
      "A descoberta está bloqueada por INSTAGRAM_DISCOVERY_ENABLED.",
      "unavailable",
    );
  }
  if (!process.env.CHROME_CDP_URL || !process.env.CHROME_PROFILE_DIR) {
    throw new InstagramDiscoveryError(
      "Configure CHROME_CDP_URL e um CHROME_PROFILE_DIR dedicado.",
      "unavailable",
    );
  }
  if (discoveryJobRunning) {
    throw new InstagramDiscoveryError("Já existe uma descoberta em execução.", "unavailable");
  }

  discoveryJobRunning = true;
  let browser;
  try {
    browser = await chromium.connectOverCDP(process.env.CHROME_CDP_URL);
  } catch {
    discoveryJobRunning = false;
    throw new InstagramDiscoveryError(
      "Chrome dedicado indisponível para descoberta.",
      "unavailable",
    );
  }
  const context = browser.contexts()[0];
  if (!context) {
    discoveryJobRunning = false;
    throw new InstagramDiscoveryError(
      "Nenhum contexto dedicado foi encontrado no Chrome.",
      "unavailable",
    );
  }

  let page: Page | null = null;
  const errors: string[] = [];
  try {
    page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console:${message.text().slice(0, 500)}`);
    });
    page.on("requestfailed", (request) => {
      const hostname = new URL(request.url()).hostname;
      errors.push(`network:${hostname}:${request.failure()?.errorText || "failed"}`);
    });
    if (input.strategy === "instagram_followers") {
      return await executeInstagramFollowersDiscoveryOnPage(page, input);
    }
    if (input.strategy === "local_business") {
      return await executeLocalBusinessDiscoveryOnPage(page, input);
    }
    return await executeInstagramDiscoveryOnPage(page, input);
  } catch (error) {
    const diagnosticsDirectory = page
      ? await saveDiscoveryDiagnostics(page, input.jobId, errors)
      : null;
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    throw new InstagramDiscoveryError(
      diagnosticsDirectory ? `${message} Diagnóstico local: ${diagnosticsDirectory}` : message,
      error instanceof InstagramDiscoveryError ? error.kind : "rejected",
    );
  } finally {
    await page?.close().catch(() => undefined);
    discoveryJobRunning = false;
  }
}
