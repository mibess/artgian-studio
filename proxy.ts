import { NextRequest, NextResponse } from "next/server";
import { adminDestination, hasAdminAccess, isAdminConfigured } from "./lib/admin-access";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  if (!hasAdminAccess(request.headers)) {
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json(
        { error: isAdminConfigured() ? "Autenticação necessária." : "Área administrativa não configurada." },
        { status: isAdminConfigured() ? 401 : 503 },
      );
    }
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", adminDestination(`${pathname}${search}`));
    return NextResponse.redirect(login, 303);
  }

  if (pathname === "/comercial" || pathname.startsWith("/comercial/")) {
    return NextResponse.redirect(new URL(adminDestination(`${pathname}${search}`), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/comercial/:path*"],
};
