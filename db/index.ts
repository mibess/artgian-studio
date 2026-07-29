import { createClient } from "@libsql/client/web";
import { drizzle as drizzleLibSql } from "drizzle-orm/libsql";
import * as schema from "./schema";

function createTursoDatabase(url: string, authToken: string) {
  const client = createClient({ url, authToken });
  return drizzleLibSql(client, { schema });
}

type AppDatabase = ReturnType<typeof createTursoDatabase>;

let cachedTursoDatabase: AppDatabase | undefined;

export async function getDb() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error(
      "Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN em conjunto.",
    );
  }

  cachedTursoDatabase ??= createTursoDatabase(tursoUrl, tursoAuthToken);
  return cachedTursoDatabase;
}
