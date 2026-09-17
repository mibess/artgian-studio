import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "artgian_admin_session";
export const ADMIN_SESSION_MAX_AGE = 12 * 60 * 60;

function credentials() {
  return {
    username: process.env.ADMIN_USERNAME?.trim() || "artgian",
    password: process.env.ADMIN_PASSWORD?.trim() || "",
  };
}

function safeEqual(left: string, right: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(left), hash(right));
}

export function isAdminConfigured() {
  return Boolean(credentials().password);
}

export function validAdminCredentials(username: string, password: string) {
  const expected = credentials();
  const validUsername = safeEqual(username, expected.username);
  const validPassword = safeEqual(password, expected.password);
  return Boolean(expected.password) && validUsername && validPassword;
}

function sign(payload: string) {
  const { username, password } = credentials();
  return createHmac("sha256", password)
    .update(JSON.stringify(["artgian-admin-session-v1", username, payload]))
    .digest("base64url");
}

export function createAdminSession(now = Date.now()) {
  if (!isAdminConfigured()) throw new Error("Área administrativa não configurada.");
  const expires = Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE;
  const payload = `${expires}.${randomBytes(32).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function validAdminSession(token: string | undefined, now = Date.now()) {
  if (!token || !isAdminConfigured()) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, signature] = parts;
  if (!/^\d{10,}$/.test(expires) || !/^[\w-]{43}$/.test(nonce)) return false;
  const expiration = Number(expires);
  const current = Math.floor(now / 1000);
  return (
    Number.isSafeInteger(expiration) &&
    expiration > current &&
    expiration <= current + ADMIN_SESSION_MAX_AGE &&
    safeEqual(signature, sign(`${expires}.${nonce}`))
  );
}

export function hasAdminAccess(headers: Headers) {
  const token = headers.get("cookie")?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(ADMIN_SESSION_COOKIE.length + 1);
  if (validAdminSession(token)) return true;

  // Keep explicit Basic credentials working for existing API clients.
  const { username, password } = credentials();
  if (!password) return false;
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  return safeEqual(headers.get("authorization") || "", expected);
}

/** Accept only destinations inside the admin, including old commercial links. */
export function adminDestination(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  try {
    const url = new URL(value, "https://admin.local");
    if (url.origin !== "https://admin.local") return "/admin";
    if (url.pathname === "/comercial/pedidos" || url.pathname.startsWith("/comercial/pedidos/")) {
      url.pathname = url.pathname.replace("/comercial/pedidos", "/admin/pedidos-comerciais");
    } else if (url.pathname === "/comercial" || url.pathname.startsWith("/comercial/")) {
      url.pathname = url.pathname.replace("/comercial", "/admin");
    }
    if (
      (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) ||
      url.pathname === "/admin/login" || url.pathname.startsWith("/admin/login/")
    ) return "/admin";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}
