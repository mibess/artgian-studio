import { defineConfig } from "drizzle-kit";

const useTurso = process.env.COMMERCIAL_DATABASE_MODE === "turso";

export default useTurso
  ? defineConfig({
      out: "./drizzle",
      schema: "./db/schema.ts",
      dialect: "turso",
      dbCredentials: {
        url: process.env.TURSO_DATABASE_URL || "",
        authToken: process.env.TURSO_AUTH_TOKEN || "",
      },
    })
  : defineConfig({
      out: "./drizzle",
      schema: "./db/schema.ts",
      dialect: "sqlite",
      dbCredentials: {
        url: process.env.DATABASE_URL || "file:./data/artgian.db",
      },
    });
