import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { canonicalInstagramUsername } from "../../features/leads/domain";

let browserJobRunning = false;
const ALLOWED_HOSTS = new Set(["www.instagram.com", "instagram.com"]);

function assertAllowedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("Navegação bloqueada: domínio não permitido.");
  }
}

function getProfileUrl(username: string) {
  const normalized = canonicalInstagramUsername(username);
  if (!/^[a-z0-9._]{1,30}$/.test(normalized)) {
    throw new Error("Perfil do Instagram inválido.");
  }
  return `https://www.instagram.com/${normalized}/`;
}

function normalizeMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized.length < 10 || normalized.length > 1_000) {
    throw new Error("A primeira mensagem deve ter entre 10 e 1.000 caracteres.");
  }
  return normalized;
}

export type BrowserFirstContactResult = {
  status: "ready" | "sent";
  profileUrl: string;
};

export class InstagramBrowserSendError extends Error {
  constructor(
    message: string,
    public readonly kind: "rejected" | "uncertain" | "unavailable",
  ) {
    super(message);
    this.name = "InstagramBrowserSendError";
  }
}

export async function executeInstagramFirstContactOnPage(
  page: Page,
  input: { username: string; message: string; allowSend: boolean },
): Promise<BrowserFirstContactResult> {
  const profileUrl = getProfileUrl(input.username);
  const message = normalizeMessage(input.message);
  await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assertAllowedUrl(page.url());

  const messageControl = page
    .getByRole("button", { name: /^(mensagem|message)$/i })
    .or(page.getByRole("link", { name: /^(mensagem|message)$/i }))
    .first();
  await messageControl.waitFor({ state: "visible", timeout: 15_000 });
  if (!input.allowSend) return { status: "ready", profileUrl };

  await messageControl.click();
  assertAllowedUrl(page.url());
  const composer = page
    .locator('[contenteditable="true"][role="textbox"]')
    .last();
  await composer.waitFor({ state: "visible", timeout: 15_000 });
  const configuredDelay = Number(process.env.OUTBOUND_TYPING_DELAY_MS || 45);
  const delay = Number.isFinite(configuredDelay)
    ? Math.min(120, Math.max(20, Math.trunc(configuredDelay)))
    : 45;
  await composer.pressSequentially(message, { delay });
  try {
    await composer.press("Enter");
  } catch {
    throw new InstagramBrowserSendError(
      "A conexão falhou durante a confirmação. Confira o Instagram antes de tentar novamente.",
      "uncertain",
    );
  }
  await page.waitForTimeout(1_000);
  return { status: "sent", profileUrl };
}

async function saveBrowserDiagnostics(page: Page, jobId: string, errors: string[]) {
  const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const directory = path.join(process.cwd(), "screenshots", "outbound", safeJobId);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    page.screenshot({ path: path.join(directory, "failure.png"), fullPage: true }),
    page
      .locator("body")
      .ariaSnapshot({ timeout: 5_000 })
      .then((snapshot) =>
        writeFile(path.join(directory, "accessibility.yml"), snapshot, {
          mode: 0o600,
        }),
      ),
    writeFile(
      path.join(directory, "diagnostics.json"),
      JSON.stringify({ url: page.url(), errors: errors.slice(-20) }, null, 2),
      { mode: 0o600 },
    ),
  ]).catch(() => undefined);
  return directory;
}

export async function runInstagramFirstContact(input: {
  jobId: string;
  username: string;
  message: string;
  allowSend: boolean;
}) {
  if (input.allowSend && process.env.OUTBOUND_AUTOMATION_ENABLED !== "true") {
    throw new Error("Outbound está desativado no ambiente.");
  }
  if (input.allowSend && process.env.BROWSER_SEND_ENABLED !== "true") {
    throw new Error("Envio pelo navegador não foi liberado no ambiente.");
  }
  if (!process.env.CHROME_CDP_URL || !process.env.CHROME_PROFILE_DIR) {
    throw new Error("Configure CHROME_CDP_URL e um CHROME_PROFILE_DIR dedicado.");
  }
  if (browserJobRunning) throw new Error("Já existe um job de navegador em execução.");

  browserJobRunning = true;
  let browser;
  try {
    browser = await chromium.connectOverCDP(process.env.CHROME_CDP_URL);
  } catch {
    browserJobRunning = false;
    throw new InstagramBrowserSendError(
      "Chrome dedicado indisponível. A fila deve permanecer pausada até a sessão ser verificada.",
      "unavailable",
    );
  }
  const context = browser.contexts()[0];
  if (!context) {
    browserJobRunning = false;
    throw new Error("Nenhum contexto dedicado foi encontrado no Chrome.");
  }
  let page: Page | null = null;
  const errors: string[] = [];
  try {
    page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(`console:${message.text().slice(0, 500)}`);
      }
    });
    page.on("requestfailed", (request) => {
      errors.push(
        `network:${new URL(request.url()).hostname}:${request.failure()?.errorText || "failed"}`,
      );
    });
    return await executeInstagramFirstContactOnPage(page, input);
  } catch (error) {
    const diagnosticsDirectory = page
      ? await saveBrowserDiagnostics(page, input.jobId, errors)
      : null;
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    const diagnosticSuffix = diagnosticsDirectory
      ? ` Diagnóstico local: ${diagnosticsDirectory}`
      : "";
    if (error instanceof InstagramBrowserSendError) {
      throw new InstagramBrowserSendError(
        `${message}${diagnosticSuffix}`,
        error.kind,
      );
    }
    throw new InstagramBrowserSendError(
      `${message}${diagnosticSuffix}`,
      page ? "rejected" : "unavailable",
    );
  } finally {
    await page?.close().catch(() => undefined);
    browserJobRunning = false;
  }
}

export async function inspectInstagramWithDedicatedPage(targetUrl: string) {
  assertAllowedUrl(targetUrl);
  const username = new URL(targetUrl).pathname.split("/").filter(Boolean)[0];
  if (!username) throw new Error("URL de perfil inválida.");
  return runInstagramFirstContact({
    jobId: `inspection-${Date.now()}`,
    username,
    message: "Mensagem de validação que não será digitada nem enviada.",
    allowSend: false,
  });
}
