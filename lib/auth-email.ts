import "server-only";
import { after } from "next/server";
import nodemailer from "nodemailer";

export type AuthEmail = {
  to: string;
  name: string;
  url: string;
  kind: "verification" | "reset";
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

export function authEmailContent(message: AuthEmail) {
  const url = new URL(message.url);
  if (url.origin !== new URL(process.env.BETTER_AUTH_URL!).origin)
    throw new Error("Origem inválida para e-mail de autenticação");
  const verification = message.kind === "verification";
  const subject = verification
    ? "Confirme seu e-mail — Artgian Studio"
    : "Redefina sua senha — Artgian Studio";
  const action = verification ? "Confirmar meu e-mail" : "Criar nova senha";
  const description = verification
    ? "Confirme seu e-mail para acessar sua conta na Artgian Studio. Este link é válido por 1 hora."
    : "Recebemos uma solicitação para redefinir sua senha. Este link é válido por 30 minutos e pode ser usado uma única vez.";
  const greeting = `Olá, ${message.name || "cliente"}.`;
  const footer =
    "Se você não solicitou esta mensagem, pode ignorá-la. Não compartilhe este link.";
  return {
    subject,
    text: `${greeting}\n\n${description}\n\n${action}: ${url.href}\n\n${footer}\n\nArtgian Studio`,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f3ea;font-family:Arial,sans-serif;color:#0b2447"><div style="max-width:520px;margin:32px auto;padding:32px;background:#fff;border-radius:20px"><p style="letter-spacing:2px;color:#98702e;font-size:12px">ARTGIAN STUDIO</p><h1 style="font-size:26px">${escapeHtml(subject.split(" — ")[0])}</h1><p>${escapeHtml(greeting)}</p><p style="line-height:1.7">${description}</p><p style="margin:28px 0"><a href="${escapeHtml(url.href)}" style="display:inline-block;padding:15px 24px;border-radius:30px;background:#0b2447;color:white;text-decoration:none">${action}</a></p><p style="font-size:12px;line-height:1.7">Se o botão não funcionar, copie este endereço:<br><a style="word-break:break-all" href="${escapeHtml(url.href)}">${escapeHtml(url.href)}</a></p><p style="font-size:12px;line-height:1.7;color:#647087">${footer}</p></div></body></html>`,
  };
}

export async function deliverAuthEmail(message: AuthEmail) {
  const content = authEmailContent(message);
  // Isolated Playwright mailbox. Never available on a deployed or production server.
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.VERCEL &&
    process.env.AUTH_EMAIL_TEST_OUTBOX
  ) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      process.env.AUTH_EMAIL_TEST_OUTBOX,
      JSON.stringify({ ...message, ...content }) + "\n",
      { mode: 0o600 },
    );
    return;
  }
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  const port = Number(process.env.SMTP_PORT || 465);
  if (!host || !user || !pass || !from)
    throw new Error("AUTH_EMAIL_NOT_CONFIGURED");
  if (![465, 587].includes(port)) throw new Error("AUTH_EMAIL_INVALID_PORT");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from,
      to: message.to,
      ...content,
      ...(process.env.AUTH_EMAIL_REPLY_TO
        ? { replyTo: process.env.AUTH_EMAIL_REPLY_TO }
        : {}),
    });
    if (result.rejected.length || !result.accepted.length)
      throw new Error("Rejected");
  } catch {
    // Do not log SMTP responses: they may include recipient or credential details.
    throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
  } finally {
    transport.close();
  }
}

export function queueAuthEmail(message: AuthEmail) {
  // Run after the HTTP response, with Vercel lifecycle support and no delivery timing leak.
  after(async () => {
    try {
      await deliverAuthEmail(message);
    } catch (error) {
      console.error(
        "[auth-email]",
        message.kind,
        error instanceof Error && /^AUTH_EMAIL_/.test(error.message)
          ? error.message
          : "AUTH_EMAIL_FAILED",
      );
      throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
    }
  });
}
