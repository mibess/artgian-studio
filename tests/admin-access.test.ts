import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, adminDestination,
  createAdminSession, hasAdminAccess, validAdminCredentials, validAdminSession,
} from "../lib/admin-access";
import { proxy } from "../proxy";

beforeEach(() => {
  vi.stubEnv("ADMIN_USERNAME", "artgian");
  vi.stubEnv("ADMIN_PASSWORD", "test-password");
});
afterEach(() => vi.unstubAllEnvs());

describe("admin authentication", () => {
  it("validates environment credentials and fails closed without a password", () => {
    expect(validAdminCredentials("artgian", "test-password")).toBe(true);
    expect(validAdminCredentials("other", "test-password")).toBe(false);
    expect(validAdminCredentials("artgian", "wrong")).toBe(false);
    vi.stubEnv("ADMIN_USERNAME", "");
    expect(validAdminCredentials("artgian", "test-password")).toBe(true);
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(validAdminCredentials("artgian", "")).toBe(false);
    expect(() => createAdminSession()).toThrow();
  });

  it("rejects tampered, malformed, expired sessions and credential rotation", () => {
    const now = Date.now();
    const token = createAdminSession(now);
    expect(validAdminSession(token, now)).toBe(true);
    expect(validAdminSession(`${token}x`, now)).toBe(false);
    expect(validAdminSession(token.replace(/^\d+/, "9999999999"), now)).toBe(false);
    expect(validAdminSession("broken", now)).toBe(false);
    expect(validAdminSession(token, now + ADMIN_SESSION_MAX_AGE * 1000)).toBe(false);
    vi.stubEnv("ADMIN_USERNAME", "changed");
    expect(validAdminSession(token, now)).toBe(false);
    vi.stubEnv("ADMIN_USERNAME", "artgian");
    vi.stubEnv("ADMIN_PASSWORD", "changed");
    expect(validAdminSession(token, now)).toBe(false);
  });

  it("authorizes cookies and existing explicit API credentials", () => {
    expect(hasAdminAccess(new Headers({ cookie: `other=1; ${ADMIN_SESSION_COOKIE}=${createAdminSession()}; last=2` }))).toBe(true);
    expect(hasAdminAccess(new Headers({ authorization: `Basic ${Buffer.from("artgian:test-password").toString("base64")}` }))).toBe(true);
    expect(hasAdminAccess(new Headers({ cookie: `${ADMIN_SESSION_COOKIE}=fake` }))).toBe(false);
    expect(hasAdminAccess(new Headers())).toBe(false);
  });
});

describe("admin routing", () => {
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/conta", "/admin/../conta", "/admin/login", "/admin/login/", null])("rejects unsafe login destination %s", (value) => {
    expect(adminDestination(value)).toBe("/admin");
  });
  it("preserves legacy destinations and filters", () => {
    expect(adminDestination("/comercial/campanhas?id=123&aba=publico")).toBe("/admin/campanhas?id=123&aba=publico");
    expect(adminDestination("/comercial/pedidos")).toBe("/admin/pedidos-comerciais");
    expect(adminDestination("/admin/descontos?q=TEST")).toBe("/admin/descontos?q=TEST");
  });
  it("keeps login public, redirects protected pages and returns 401 for APIs", () => {
    expect(proxy(new NextRequest("https://example.com/admin/login")).status).toBe(200);
    const page = proxy(new NextRequest("https://example.com/comercial/campanhas?id=123"));
    const location = new URL(page.headers.get("location")!);
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("next")).toBe("/admin/campanhas?id=123");
    const api = proxy(new NextRequest("https://example.com/api/admin/coupons"));
    expect(api.status).toBe(401);
    expect(api.headers.has("www-authenticate")).toBe(false);
  });
  it("redirects authenticated legacy URLs and allows admin requests", () => {
    const headers = { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession()}` };
    expect(proxy(new NextRequest("https://example.com/comercial/pedidos?q=1", { headers })).headers.get("location")).toBe("https://example.com/admin/pedidos-comerciais?q=1");
    expect(proxy(new NextRequest("https://example.com/admin/descontos", { headers })).status).toBe(200);
  });
});
