import { defineConfig } from "@playwright/test";

// Share the same isolated database with tests that seed records directly.
const databaseUrl =
  process.env.E2E_DATABASE_URL || `file:./data/e2e-${Date.now()}.db`;
process.env.E2E_DATABASE_URL = databaseUrl;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3108",
    httpCredentials: { username: "artgian", password: "teste-local" },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROME_PATH ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3108",
    url: "http://127.0.0.1:3108",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ADMIN_USERNAME: "artgian",
      ADMIN_PASSWORD: "teste-local",
      DATABASE_URL: databaseUrl,
      TURSO_DATABASE_URL: "",
      TURSO_AUTH_TOKEN: "",
      BETTER_AUTH_SECRET: "e2e-only-secret-do-not-use-in-production-123456789",
      BETTER_AUTH_URL: "http://127.0.0.1:3108",
      AUTH_EMAIL_TEST_OUTBOX: "./data/e2e-auth-emails.jsonl",
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      MERCADO_PAGO_ACCESS_TOKEN: "",
      MELHOR_ENVIO_ACCESS_TOKEN: "",
      COMMERCIAL_DATABASE_MODE: "local",
      COMMERCIAL_DEMO_MODE: "true",
      OUTBOUND_AUTOMATION_ENABLED: "false",
      BROWSER_SEND_ENABLED: "false",
      INSTAGRAM_AUTO_REPLY_ENABLED: "false",
      OPENAI_API_KEY: "",
      QSTASH_TOKEN: "",
      QSTASH_CURRENT_SIGNING_KEY: "",
      QSTASH_NEXT_SIGNING_KEY: "",
    },
  },
});
