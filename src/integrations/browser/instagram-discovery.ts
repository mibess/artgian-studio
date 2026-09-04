import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import {
  extractPublicInstagramCandidate,
  instagramUsernameFromHref,
  type DiscoverySeed,
  type PublicInstagramCandidate,
} from "../../features/outbound/discovery-domain";

const ALLOWED_HOSTS = new Set(["www.instagram.com", "instagram.com"]);
let discoveryJobRunning = false;

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
  discoveryQuery: string,
  knownLocations: string[],
) {
  const sourceUrl = `https://www.instagram.com/${username}/`;
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assertInstagramUrl(page.url());
  await page.waitForTimeout(700);
  const [title, description, mainText] = await Promise.all([
    page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null),
    page.locator('meta[property="og:description"]').getAttribute("content").catch(() => null),
    page.locator("main").innerText({ timeout: 8_000 }).catch(() => null),
  ]);
  return extractPublicInstagramCandidate({
    username,
    sourceUrl,
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
  },
) {
  const maximumProfiles = Math.min(30, Math.max(1, Math.trunc(input.maximumProfiles)));
  const ownUsername = input.ownUsername?.replace(/^@/, "").toLocaleLowerCase("en-US");
  const discovered = new Map<string, { username: string; query: string }>();
  let queriesScanned = 0;
  await page.goto("https://www.instagram.com/explore/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assertInstagramUrl(page.url());
  const searchInput = page.getByPlaceholder(/^(Pesquisar|Search)$/i);
  await searchInput.waitFor({ state: "visible", timeout: 15_000 });

  for (const seed of input.seeds.slice(0, 10)) {
    const query = seed.kind === "hashtag"
      ? `#${seed.value.replace(/^#+/, "").replace(/\s+/g, "")}`
      : seed.value;
    await searchInput.fill(query);
    await page.waitForTimeout(1_200);
    const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href): href is string => Boolean(href)),
    );
    queriesScanned += 1;
    for (const href of hrefs) {
      const username = instagramUsernameFromHref(href);
      if (!username || username === ownUsername || discovered.has(username)) continue;
      discovered.set(username, { username, query: seed.value });
      if (discovered.size >= maximumProfiles * 3) break;
    }
    if (discovered.size >= maximumProfiles * 3) break;
  }

  const candidates: PublicInstagramCandidate[] = [];
  let profilesInspected = 0;
  for (const discoveredProfile of discovered.values()) {
    if (profilesInspected >= maximumProfiles) break;
    profilesInspected += 1;
    const candidate = await profileCandidateFromPage(
      page,
      discoveredProfile.username,
      discoveredProfile.query,
      input.knownLocations,
    );
    if (candidate) candidates.push(candidate);
  }
  return {
    candidates,
    queriesScanned,
    profilesInspected,
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

export async function discoverInstagramProfiles(input: {
  jobId: string;
  seeds: DiscoverySeed[];
  maximumProfiles: number;
  knownLocations: string[];
  ownUsername?: string;
}) {
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
