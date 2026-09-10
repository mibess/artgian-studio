import "server-only";
import { safeReturnTo } from "./auth-redirect";
import { queueAuthEmail } from "./auth-email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "../db";
import * as schema from "../db/auth-schema";

export function googleLoginEnabled() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

function createAuth(database: Awaited<ReturnType<typeof getDb>>) {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32)
    throw new Error(
      "Configure BETTER_AUTH_SECRET com pelo menos 32 caracteres.",
    );
  const baseURL =
    process.env.BETTER_AUTH_URL?.trim() ||
    (process.env.NODE_ENV !== "production"
      ? "http://localhost:3000"
      : undefined);
  if (!baseURL)
    throw new Error("Configure BETTER_AUTH_URL com a URL pública da loja.");
  return betterAuth({
    appName: "Artgian Studio",
    baseURL,
    secret,
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        queueAuthEmail({ to: user.email, name: user.name, url, kind: "reset" });
      },
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        const link = new URL(url);
        const callback = new URL(
          link.searchParams.get("callbackURL") || "/conta",
          baseURL,
        );
        const next = safeReturnTo(
          callback.pathname === "/login/verificar"
            ? callback.searchParams.get("next") || undefined
            : callback.pathname + callback.search,
        );
        link.searchParams.set(
          "callbackURL",
          `${baseURL}/login/verificar?confirmed=1&next=${encodeURIComponent(next)}`,
        );
        queueAuthEmail({
          to: user.email,
          name: user.name,
          url: link.href,
          kind: "verification",
        });
      },
    },
    socialProviders: googleLoginEnabled()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account",
          },
        }
      : {},
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
      },
    },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;
export async function getAuth() {
  auth ??= createAuth(await getDb());
  return auth;
}

export async function getCustomerSession(headers: Headers) {
  if (!headers.get("cookie")?.includes("better-auth.session_token"))
    return null;
  return (await getAuth()).api.getSession({ headers });
}
