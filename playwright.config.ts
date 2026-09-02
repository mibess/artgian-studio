import { defineConfig } from "@playwright/test";

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
      DATABASE_URL: "file:./data/e2e.db",
      COMMERCIAL_DEMO_MODE: "true",
      OUTBOUND_AUTOMATION_ENABLED: "false",
    },
  },
});
