import { NextRequest, NextResponse } from "next/server";

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function proxy(request: NextRequest) {
  const expectedUsername = process.env.ADMIN_USERNAME?.trim() || "artgian";
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedPassword) {
    return new NextResponse("Área administrativa não configurada.", {
      status: 503,
    });
  }

  const authorization = request.headers.get("authorization");
  let credentials = "";
  try {
    credentials = authorization?.startsWith("Basic ")
      ? atob(authorization.slice(6))
      : "";
  } catch {
    credentials = "";
  }
  const separator = credentials.indexOf(":");
  const username = separator >= 0 ? credentials.slice(0, separator) : "";
  const password = separator >= 0 ? credentials.slice(separator + 1) : "";

  if (
    !safeEqual(username, expectedUsername) ||
    !safeEqual(password, expectedPassword)
  ) {
    return new NextResponse("Autenticação necessária.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Artgian Admin"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/comercial/:path*"],
};
