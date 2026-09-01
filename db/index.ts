import { createClient } from "@libsql/client";
import { drizzle as drizzleLibSql } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";

function createDatabase(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return { client, db: drizzleLibSql(client, { schema }) };
}

type AppDatabase = ReturnType<typeof createDatabase>["db"];

let cachedRemoteDatabase: AppDatabase | undefined;
let cachedLocalDatabase: AppDatabase | undefined;
let localInitialization: Promise<void> | undefined;

async function initializeLocalDatabase(
  database: ReturnType<typeof createDatabase>,
) {
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  await database.client.execute("PRAGMA foreign_keys = ON");
  await database.client.execute("PRAGMA journal_mode = WAL");
  await database.client.execute("PRAGMA busy_timeout = 5000");
  await migrate(database.db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  await database.client.execute("PRAGMA optimize");
}

export async function getDb() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl && !tursoAuthToken) {
    throw new Error(
      "Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN em conjunto.",
    );
  }

  if (tursoUrl && tursoAuthToken) {
    cachedRemoteDatabase ??= createDatabase(tursoUrl, tursoAuthToken).db;
    return cachedRemoteDatabase;
  }

  return getLocalCommercialDb();
}

export async function getLocalCommercialDb() {
  const url = process.env.DATABASE_URL?.trim() || "file:./data/artgian.db";
  if (!url.startsWith("file:")) {
    throw new Error("DATABASE_URL do CRM deve apontar para um SQLite local com prefixo file:.");
  }
  if (!cachedLocalDatabase) {
    await mkdir(
      path.dirname(
        path.resolve(
          /* turbopackIgnore: true */ process.cwd(),
          url.slice("file:".length),
        ),
      ),
      { recursive: true },
    );
    const database = createDatabase(url);
    cachedLocalDatabase = database.db;
    localInitialization = initializeLocalDatabase(database);
  }
  await localInitialization;
  return cachedLocalDatabase;
}
