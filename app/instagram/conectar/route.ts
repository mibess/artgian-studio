import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID não configurado." },
      { status: 503 },
    );
  }

  const redirectUri = new URL(
    "/instagram/callback",
    request.nextUrl.origin,
  ).toString();
  const state = randomBytes(32).toString("hex");
  const authorizeUrl = new URL("https://www.instagram.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set(
    "scope",
    [
      "instagram_business_basic",
      "instagram_business_manage_comments",
      "instagram_business_manage_messages",
    ].join(","),
  );
  authorizeUrl.searchParams.set("enable_fb_login", "0");
  authorizeUrl.searchParams.set("force_authentication", "1");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("instagram_oauth_state", state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/instagram",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
