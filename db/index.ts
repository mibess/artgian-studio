import { createClient } from "@libsql/client/web";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleLibSql } from "drizzle-orm/libsql";
import * as schema from "./schema";

function createTursoDatabase(url: string, authToken: string) {
  const client = createClient({ url, authToken });
  return drizzleLibSql(client, { schema });
}

type AppDatabase = ReturnType<typeof createTursoDatabase>;

let cachedTursoDatabase: AppDatabase | undefined;

async function getCloudflareEnvironment() {
  try {
    const cloudflareWorkersModule = "cloudflare:workers";
    const { env } = await import(cloudflareWorkersModule);
    return env;
  } catch {
    return undefined;
  }
}

export async function getDb() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl || tursoAuthToken) {
    if (!tursoUrl || !tursoAuthToken) {
      throw new Error(
        "Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN em conjunto.",
      );
    }

    cachedTursoDatabase ??= createTursoDatabase(tursoUrl, tursoAuthToken);
    return cachedTursoDatabase;
  }

  const cloudflareEnvironment = await getCloudflareEnvironment();
  if (cloudflareEnvironment?.DB) {
    return drizzleD1(cloudflareEnvironment.DB, {
      schema,
    }) as unknown as AppDatabase;
  }

  throw new Error(
    "Banco indisponível. Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na Vercel ou o binding D1 `DB` no Cloudflare.",
  );
}
