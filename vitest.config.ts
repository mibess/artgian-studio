import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    env: {
      TURSO_DATABASE_URL: "",
      TURSO_AUTH_TOKEN: "",
      OPENAI_API_KEY: "",
      OUTBOUND_AUTOMATION_ENABLED: "false",
      BROWSER_SEND_ENABLED: "false",
    },
    include: ["tests/**/*.test.ts"],
    sequence: { concurrent: false },
    coverage: { reporter: ["text", "json-summary"] },
  },
});
