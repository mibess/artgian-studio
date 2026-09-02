import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { integrationStates } from "../../../db/schema";
import { getCommercialDb } from "../../db/commercial";

const INTEGRATION_KEY = "instagram";
const TOKEN_FORMAT_VERSION = "v1";

function getEncryptionKey() {
  const material =
    process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!material) {
    throw new Error("Chave de criptografia do token do Instagram não configurada.");
  }
  return createHash("sha256")
    .update(`artgian:instagram-token:${material}`)
    .digest();
}

export function encryptInstagramToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    TOKEN_FORMAT_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptInstagramToken(encrypted: string) {
  const [version, iv, tag, ciphertext] = encrypted.split(":");
  if (version !== TOKEN_FORMAT_VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Formato do token criptografado inválido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function getInstagramIntegrationState() {
  const db = await getCommercialDb();
  const [state] = await db
    .select()
    .from(integrationStates)
    .where(eq(integrationStates.key, INTEGRATION_KEY))
    .limit(1);
  return state || null;
}

export async function getInstagramAccessToken() {
  const state = await getInstagramIntegrationState();
  if (state?.encryptedAccessToken) {
    try {
      return decryptInstagramToken(state.encryptedAccessToken);
    } catch {
      // A variável de ambiente continua sendo a recuperação segura caso a
      // chave de criptografia tenha sido rotacionada.
    }
  }
  const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("Token de acesso do Instagram não configurado.");
  return token;
}

export async function saveInstagramAccessToken(input: {
  accessToken: string;
  expiresInSeconds?: number;
  refreshedAt?: string;
}) {
  const db = await getCommercialDb();
  const now = input.refreshedAt || new Date().toISOString();
  const expiresAt = input.expiresInSeconds
    ? new Date(Date.parse(now) + input.expiresInSeconds * 1_000).toISOString()
    : null;
  await db
    .insert(integrationStates)
    .values({
      key: INTEGRATION_KEY,
      status: "healthy",
      encryptedAccessToken: encryptInstagramToken(input.accessToken),
      tokenExpiresAt: expiresAt,
      lastTokenRefreshAt: input.refreshedAt || null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: integrationStates.key,
      set: {
        encryptedAccessToken: encryptInstagramToken(input.accessToken),
        tokenExpiresAt: expiresAt,
        ...(input.refreshedAt ? { lastTokenRefreshAt: input.refreshedAt } : {}),
        updatedAt: now,
      },
    });
  return { expiresAt };
}

type RefreshResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { code?: number; message?: string };
};

export async function refreshInstagramAccessToken(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);
  let response: Response;
  try {
    response = await fetchImpl(url, { method: "GET", cache: "no-store" });
  } catch {
    throw new Error("Falha de rede ao renovar o token do Instagram.");
  }
  const payload = (await response.json().catch(() => ({}))) as RefreshResponse;
  if (!response.ok || !payload.access_token || !payload.expires_in) {
    const code = payload.error?.code;
    throw new Error(
      code
        ? `O Instagram recusou a renovação do token (código ${code}).`
        : "O Instagram recusou a renovação do token.",
    );
  }
  const refreshedAt = new Date().toISOString();
  const stored = await saveInstagramAccessToken({
    accessToken: payload.access_token,
    expiresInSeconds: payload.expires_in,
    refreshedAt,
  });
  return { accessToken: payload.access_token, expiresAt: stored.expiresAt };
}

export function shouldRefreshInstagramToken(
  state: Awaited<ReturnType<typeof getInstagramIntegrationState>> | null,
  now = new Date(),
) {
  if (!state?.lastTokenRefreshAt) return true;
  if (!state.tokenExpiresAt) {
    return now.getTime() - Date.parse(state.lastTokenRefreshAt) > 24 * 60 * 60 * 1_000;
  }
  return Date.parse(state.tokenExpiresAt) - now.getTime() <= 14 * 24 * 60 * 60 * 1_000;
}
