import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getAuth, getCustomerSession } from "../lib/auth";
import { getDb } from "../db";
import { account, user } from "../db/auth-schema";
vi.mock("../lib/auth-email", () => ({ queueAuthEmail: vi.fn() }));
const origin = "http://localhost:3923";
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-google-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/auth.db`);
  vi.stubEnv("TURSO_DATABASE_URL", "");
  vi.stubEnv("TURSO_AUTH_TOKEN", "");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "isolated-google-test-secret-01234567890123456789",
  );
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-google.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-google-secret");
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
function cookieFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
let attempt = 0;
async function signInGoogle(
  email: string,
  subject: string,
  emailVerified = true,
) {
  const auth = await getAuth();
  const start = await auth.handler(
    new Request(`${origin}/api/auth/sign-in/social`, {
      method: "POST",
      headers: {
        origin,
        "Content-Type": "application/json",
        "x-forwarded-for": `192.0.2.${++attempt}`,
      },
      body: JSON.stringify({
        provider: "google",
        callbackURL: "/comprar?produto=organizador-arco",
        errorCallbackURL: "/login?next=%2Fcomprar",
        disableRedirect: true,
      }),
    }),
  );
  expect(start.status).toBe(200);
  const url = new URL((await start.json()).url);
  const encode = (body: unknown) =>
    Buffer.from(JSON.stringify(body)).toString("base64url");
  // Only the external token exchange is simulated. State, PKCE, database,
  // account binding and session cookies run through the real auth handler.
  const idToken = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ sub: subject, email, email_verified: emailVerified, name: "Cliente Google", aud: "test-google.apps.googleusercontent.com", iss: "https://accounts.google.com", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const target = input instanceof Request ? input.url : String(input);
    if (target !== "https://oauth2.googleapis.com/token")
      throw new Error(`Unexpected network call: ${target}`);
    return Response.json({
      access_token: "google-test-token",
      token_type: "Bearer",
      expires_in: 3600,
      id_token: idToken,
      scope: "openid email profile",
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    return await auth.handler(
      new Request(
        `${origin}/api/auth/callback/google?code=verified-test-code&state=${encodeURIComponent(url.searchParams.get("state")!)}`,
        { headers: { cookie: cookieFrom(start) } },
      ),
    );
  } finally {
    vi.unstubAllGlobals();
  }
}
async function localUser(email: string, verified: boolean) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db
    .insert(user)
    .values({
      id,
      name: "Cliente existente",
      email,
      emailVerified: verified,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await db
    .insert(account)
    .values({
      id: crypto.randomUUID(),
      accountId: id,
      userId: id,
      providerId: "credential",
      password: "existing-password-hash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  return id;
}
describe("Google OAuth callback", () => {
  it("signs a new Google customer in and returns to the requested checkout", async () => {
    const response = await signInGoogle("new-google@example.com", "google-new");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "/comprar?produto=organizador-arco",
    );
    expect(
      (await getCustomerSession(new Headers({ cookie: cookieFrom(response) })))
        ?.user.email,
    ).toBe("new-google@example.com");
  });
  it("links a verified Google email to an existing verified customer without duplicating the account", async () => {
    const id = await localUser("existing-google@example.com", true);
    const response = await signInGoogle(
      "existing-google@example.com",
      "google-existing",
    );
    expect(response.headers.get("location")).toBe(
      "/comprar?produto=organizador-arco",
    );
    expect(
      (await getCustomerSession(new Headers({ cookie: cookieFrom(response) })))
        ?.user.id,
    ).toBe(id);
    const accounts = await (await getDb())
      .select()
      .from(account)
      .where(eq(account.userId, id));
    expect(accounts.map((row) => row.providerId).sort()).toEqual([
      "credential",
      "google",
    ]);
    expect(
      accounts.find((row) => row.providerId === "credential")?.password,
    ).toBe("existing-password-hash");
    const repeated = await signInGoogle(
      "existing-google@example.com",
      "google-existing",
    );
    expect(
      (await getCustomerSession(new Headers({ cookie: cookieFrom(repeated) })))
        ?.user.id,
    ).toBe(id);
  });
  it("does not link an existing local account until its email is confirmed", async () => {
    const id = await localUser("unconfirmed-local@example.com", false);
    const response = await signInGoogle(
      "unconfirmed-local@example.com",
      "google-unconfirmed-local",
    );
    expect(response.headers.get("location")).toContain(
      "error=account_not_linked",
    );
    expect(cookieFrom(response)).not.toContain("session_token");
    expect(
      await (await getDb())
        .select()
        .from(account)
        .where(eq(account.userId, id)),
    ).toHaveLength(1);
  });
  it("does not link a provider email that Google has not verified", async () => {
    const id = await localUser("unconfirmed-google@example.com", true);
    const response = await signInGoogle(
      "unconfirmed-google@example.com",
      "google-unverified",
      false,
    );
    expect(response.headers.get("location")).toContain(
      "error=account_not_linked",
    );
    expect(cookieFrom(response)).not.toContain("session_token");
    expect(
      await (await getDb())
        .select()
        .from(account)
        .where(eq(account.userId, id)),
    ).toHaveLength(1);
  });
});
