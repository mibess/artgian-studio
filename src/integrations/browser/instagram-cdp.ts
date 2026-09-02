import { chromium } from "@playwright/test";

let browserJobRunning = false;
const ALLOWED_HOSTS = new Set(["www.instagram.com", "instagram.com"]);

function assertAllowedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("Navegação bloqueada: domínio não permitido.");
  }
}

export async function inspectInstagramWithDedicatedPage(targetUrl: string) {
  if (process.env.OUTBOUND_AUTOMATION_ENABLED !== "true") {
    throw new Error("Outbound está desativado. Use somente o dry-run aprovado.");
  }
  if (!process.env.CHROME_CDP_URL || !process.env.CHROME_PROFILE_DIR) {
    throw new Error("Configure CHROME_CDP_URL e um CHROME_PROFILE_DIR dedicado.");
  }
  assertAllowedUrl(targetUrl);
  if (browserJobRunning) throw new Error("Já existe um job de navegador em execução.");
  browserJobRunning = true;
  const browser = await chromium.connectOverCDP(process.env.CHROME_CDP_URL);
  const context = browser.contexts()[0];
  if (!context) {
    browserJobRunning = false;
    throw new Error("Nenhum contexto dedicado foi encontrado no Chrome.");
  }
  const page = await context.newPage();
  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    assertAllowedUrl(page.url());
    return { url: page.url(), title: await page.title(), dryRun: true };
  } finally {
    await page.close().catch(() => undefined);
    browserJobRunning = false;
  }
}
