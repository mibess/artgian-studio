import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  user_id?: string | number;
  error?: { message?: string };
};

type ProfileResponse = {
  id?: string;
  user_id?: string;
  username?: string;
  name?: string;
};

function matchesState(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] || character,
  );
}

function htmlResponse(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Instagram | Artgian Studio</title><style>body{margin:0;background:#f7f3ea;color:#0b2447;font-family:system-ui,sans-serif}.wrap{max-width:760px;margin:0 auto;padding:72px 24px}h1{font-family:Georgia,serif;font-size:clamp(2.5rem,8vw,5rem);font-weight:400;line-height:.95}p{line-height:1.7;color:#56677d}textarea{box-sizing:border-box;width:100%;min-height:150px;margin-top:18px;padding:16px;border:1px solid #0b244733;border-radius:16px;background:#fff;font:13px ui-monospace,monospace;word-break:break-all}.notice{margin-top:20px;padding:16px;border-radius:14px;background:#efe4c9}.error{color:#9b3528}</style></head><body><main class="wrap">${body}</main></body></html>`,
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error_description");
  if (error) {
    return htmlResponse(
      `<p class="error">O Instagram não concluiu a autorização: ${escapeHtml(error)}</p>`,
      400,
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("instagram_oauth_state")?.value;
  if (!code || !matchesState(state, expectedState)) {
    return htmlResponse(
      '<p class="error">A autorização expirou ou não foi iniciada pelo site da Artgian Studio. Volte ao link de conexão e tente novamente.</p>',
      400,
    );
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    return htmlResponse(
      '<p class="error">As credenciais do Instagram não estão configuradas no servidor.</p>',
      503,
    );
  }

  const redirectUri = new URL(
    "/instagram/callback",
    request.nextUrl.origin,
  ).toString();
  const form = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const shortResponse = await fetch(
    "https://api.instagram.com/oauth/access_token",
    {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    },
  );
  const shortToken = (await shortResponse.json()) as TokenResponse;
  if (!shortResponse.ok || !shortToken.access_token) {
    return htmlResponse(
      `<p class="error">O Instagram recusou a troca do código: ${escapeHtml(shortToken.error?.message || "resposta inválida")}</p>`,
      502,
    );
  }

  const exchangeUrl = new URL(
    "https://graph.instagram.com/access_token",
  );
  exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
  exchangeUrl.searchParams.set("client_secret", appSecret);
  exchangeUrl.searchParams.set("access_token", shortToken.access_token);
  const longResponse = await fetch(exchangeUrl, { cache: "no-store" });
  const longToken = (await longResponse.json()) as TokenResponse;
  if (!longResponse.ok || !longToken.access_token) {
    return htmlResponse(
      `<p class="error">A autorização ocorreu, mas não foi possível gerar o token de longa duração: ${escapeHtml(longToken.error?.message || "resposta inválida")}</p>`,
      502,
    );
  }

  const profileUrl = new URL("https://graph.instagram.com/me");
  profileUrl.searchParams.set("fields", "id,user_id,username,name");
  profileUrl.searchParams.set("access_token", longToken.access_token);
  const profileResponse = await fetch(profileUrl, { cache: "no-store" });
  const profile = profileResponse.ok
    ? ((await profileResponse.json()) as ProfileResponse)
    : {};
  const accountName = profile.username ? `@${profile.username}` : "Instagram";
  const days = longToken.expires_in
    ? Math.max(1, Math.round(longToken.expires_in / 86400))
    : 60;

  const response = htmlResponse(
    `<p>Integração do Instagram</p><h1>${escapeHtml(accountName)} conectado.</h1><p>O token de longa duração foi gerado e validado. Copie o valor abaixo e use-o em <strong>INSTAGRAM_PAGE_ACCESS_TOKEN</strong>.</p><textarea readonly aria-label="Token de acesso">${escapeHtml(longToken.access_token)}</textarea><div class="notice">Validade aproximada: ${days} dias. Não envie este token por mensagem e não o compartilhe com terceiros.</div>`,
  );
  response.cookies.set("instagram_oauth_state", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/instagram",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}
