import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
export function hasAdminAccess(headers: Headers) {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return false;
  const username = process.env.ADMIN_USERNAME?.trim() || "artgian";
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(
    hash(headers.get("authorization") || ""),
    hash(expected),
  );
}
