import "server-only";

import { headers } from "next/headers";

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function decodeBasicAuthorization(value: string | null) {
  if (!value?.startsWith("Basic ")) return null;
  try {
    const credentials = Buffer.from(value.slice(6), "base64").toString("utf8");
    const separator = credentials.indexOf(":");
    if (separator < 0) return null;
    return {
      username: credentials.slice(0, separator),
      password: credentials.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export async function requireAdminAccess() {
  const expectedUsername = process.env.ADMIN_USERNAME?.trim() || "artgian";
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  const authorization = decodeBasicAuthorization(
    (await headers()).get("authorization"),
  );

  if (
    !expectedPassword ||
    !authorization ||
    !safeEqual(authorization.username, expectedUsername) ||
    !safeEqual(authorization.password, expectedPassword)
  ) {
    throw new Error("Não autorizado.");
  }
}
