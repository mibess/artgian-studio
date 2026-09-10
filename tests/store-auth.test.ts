import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getAuth, getCustomerSession } from "../lib/auth";
import { getDb } from "../db";
import { account, verification } from "../db/auth-schema";
import { eq } from "drizzle-orm";
const mailbox = vi.hoisted(
  () => [] as { to: string; name: string; url: string; kind: string }[],
);
vi.mock("../lib/auth-email", () => ({
  queueAuthEmail: (mail: (typeof mailbox)[number]) => mailbox.push(mail),
}));
let directory: string;
const origin = "http://localhost:3917";
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-auth-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/auth.db`);
  vi.stubEnv("TURSO_DATABASE_URL", "");
  vi.stubEnv("TURSO_AUTH_TOKEN", "");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "isolated-auth-tests-only-0123456789abcdef0123456789",
  );
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "isolated-test-client-secret");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
function req(
  endpoint: string,
  body: unknown,
  options: { cookie?: string; origin?: string; ip?: string } = {},
) {
  return new Request(`${origin}/api/auth${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: options.origin ?? origin,
      "x-forwarded-for": options.ip ?? "192.0.2.10",
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
function cookieFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
describe("customer authentication with a real isolated database", () => {
  it("hashes passwords, restores sessions and revokes them on logout", async () => {
    const auth = await getAuth();
    const response = await auth.handler(
      req("/sign-up/email", {
        name: "Cliente Teste",
        email: "customer@example.com",
        password: "PasswordTest!123",
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).token).toBeNull();
    expect(cookieFrom(response)).not.toContain("session_token");
    const denied = await auth.handler(
      req("/sign-in/email", {
        email: "customer@example.com",
        password: "PasswordTest!123",
      }),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("EMAIL_NOT_VERIFIED");
    const mail = mailbox.find(
      (mail) =>
        mail.to === "customer@example.com" && mail.kind === "verification",
    )!;
    expect(mail).toBeTruthy();
    const verified = await auth.handler(new Request(mail.url));
    expect(verified.status).toBe(302);
    const signedIn = await auth.handler(
      req("/sign-in/email", {
        email: "customer@example.com",
        password: "PasswordTest!123",
      }),
    );
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    const cookie = cookieFrom(signedIn);
    const session = await getCustomerSession(new Headers({ cookie }));
    expect(session?.user.email).toBe("customer@example.com");
    const [credentials] = await (await getDb()).select().from(account);
    expect(credentials.password).toBeTruthy();
    expect(credentials.password).not.toBe("PasswordTest!123");
    expect(await getCustomerSession(new Headers())).toBeNull();
    expect(
      await getCustomerSession(
        new Headers({ cookie: "better-auth.session_token=forged" }),
      ),
    ).toBeNull();
    const logout = await auth.handler(req("/sign-out", {}, { cookie }));
    expect(logout.status).toBe(200);
    expect(await getCustomerSession(new Headers({ cookie }))).toBeNull();
    const login = await auth.handler(
      req("/sign-in/email", {
        email: "customer@example.com",
        password: "PasswordTest!123",
      }),
    );
    expect(login.status).toBe(200);
    expect(
      (await getCustomerSession(new Headers({ cookie: cookieFrom(login) })))
        ?.user.id,
    ).toBe(session?.user.id);
  });
  it("rejects untrusted origins and throttles repeated wrong passwords", async () => {
    const auth = await getAuth();
    const body = {
      email: "customer@example.com",
      password: "WrongPassword!123",
    };
    expect(
      (
        await auth.handler(
          req("/sign-in/email", body, { origin: "https://evil.example" }),
        )
      ).status,
    ).toBe(403);
    let last: Response | undefined;
    for (let i = 0; i < 6; i++)
      last = await auth.handler(
        req("/sign-in/email", body, { ip: "192.0.2.20" }),
      );
    expect(last?.status).toBe(429);
  });
  it("resets a password once, rejects expired links, and revokes active sessions", async () => {
    const auth = await getAuth();
    const email = "customer@example.com";
    const login = await auth.handler(
      req(
        "/sign-in/email",
        { email, password: "PasswordTest!123" },
        { ip: "192.0.2.40" },
      ),
    );
    const cookie = cookieFrom(login);
    const known = await auth.handler(
      req(
        "/request-password-reset",
        { email, redirectTo: "/login/redefinir" },
        { ip: "192.0.2.41" },
      ),
    );
    const unknown = await auth.handler(
      req(
        "/request-password-reset",
        { email: "unknown@example.com", redirectTo: "/login/redefinir" },
        { ip: "192.0.2.42" },
      ),
    );
    expect(known.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    expect(mailbox.some((mail) => mail.to === "unknown@example.com")).toBe(
      false,
    );
    const mail = mailbox.findLast((mail) => mail.kind === "reset")!;
    const callback = await auth.handler(new Request(mail.url));
    const token = new URL(callback.headers.get("location")!).searchParams.get(
      "token",
    )!;
    expect(token).toBeTruthy();
    const reset = await auth.handler(
      req(
        "/reset-password",
        { token, newPassword: "NewPassword!1234" },
        { ip: "192.0.2.43" },
      ),
    );
    expect(reset.status).toBe(200);
    expect(await getCustomerSession(new Headers({ cookie }))).toBeNull();
    expect(
      (
        await auth.handler(
          req(
            "/reset-password",
            { token, newPassword: "AnotherPassword!123" },
            { ip: "192.0.2.43" },
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await auth.handler(
          req(
            "/sign-in/email",
            { email, password: "PasswordTest!123" },
            { ip: "192.0.2.44" },
          ),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await auth.handler(
          req(
            "/sign-in/email",
            { email, password: "NewPassword!1234" },
            { ip: "192.0.2.44" },
          ),
        )
      ).status,
    ).toBe(200);
    await auth.handler(
      req(
        "/request-password-reset",
        { email, redirectTo: "/login/redefinir" },
        { ip: "192.0.2.45" },
      ),
    );
    const expiredMail = mailbox.findLast((mail) => mail.kind === "reset")!;
    const expiredToken = new URL(expiredMail.url).pathname.split("/").at(-1)!;
    await (
      await getDb()
    )
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 10000) })
      .where(eq(verification.identifier, `reset-password:${expiredToken}`));
    expect(
      (
        await auth.handler(
          req(
            "/reset-password",
            { token: expiredToken, newPassword: "ExpiredPassword!123" },
            { ip: "192.0.2.46" },
          ),
        )
      ).status,
    ).toBe(400);
  });
  it("rejects foreign email callbacks, invalid verification, and limits email requests", async () => {
    const auth = await getAuth();
    for (const [endpoint, body] of [
      [
        "/request-password-reset",
        { email: "customer@example.com", redirectTo: "https://evil.example" },
      ],
      [
        "/send-verification-email",
        { email: "customer@example.com", callbackURL: "https://evil.example" },
      ],
    ] as const)
      expect(
        (await auth.handler(req(endpoint, body, { ip: "192.0.2.50" }))).status,
      ).toBe(403);
    const invalid = await auth.handler(
      new Request(
        `${origin}/api/auth/verify-email?token=forged&callbackURL=${encodeURIComponent(origin + "/login/verificar?confirmed=1")}`,
      ),
    );
    expect(invalid.headers.get("location")).toContain("error=INVALID_TOKEN");
    let last: Response | undefined;
    for (let i = 0; i < 4; i++)
      last = await auth.handler(
        req(
          "/send-verification-email",
          { email: "absent@example.com" },
          { ip: "192.0.2.51" },
        ),
      );
    expect(last!.status).toBe(429);
  });
  it("creates Google OAuth state with the configured client and exact callback", async () => {
    const auth = await getAuth();
    const response = await auth.handler(
      req(
        "/sign-in/social",
        { provider: "google", callbackURL: "/comprar", disableRedirect: true },
        { ip: "192.0.2.30" },
      ),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    const url = new URL(result.url);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe(
      "test-client.apps.googleusercontent.com",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${origin}/api/auth/callback/google`,
    );
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });
});
