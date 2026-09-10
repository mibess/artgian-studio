import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const smtp = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
}));
const tasks = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock("nodemailer", () => ({
  default: { createTransport: smtp.createTransport },
}));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => tasks.push(task),
}));
import {
  authEmailContent,
  deliverAuthEmail,
  queueAuthEmail,
} from "../lib/auth-email";
const mail = {
  to: "customer@example.com",
  name: '<img src=x onerror="bad()">',
  kind: "reset" as const,
  url: "https://www.artgian.com.br/api/auth/reset-password/test-secret?callbackURL=%2Flogin%2Fredefinir",
};
beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_URL", "https://www.artgian.com.br");
  vi.stubEnv("SMTP_HOST", "smtp.zoho.com");
  vi.stubEnv("SMTP_PORT", "465");
  vi.stubEnv("SMTP_USER", "contato@artgian.com.br");
  vi.stubEnv("SMTP_PASSWORD", "isolated-secret");
  vi.stubEnv("AUTH_EMAIL_FROM", "Artgian Studio <contato@artgian.com.br>");
  vi.stubEnv("AUTH_EMAIL_TEST_OUTBOX", "");
  smtp.createTransport.mockReturnValue({
    sendMail: smtp.sendMail,
    close: smtp.close,
  });
  smtp.sendMail.mockResolvedValue({ accepted: [mail.to], rejected: [] });
  tasks.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("authentication email delivery", () => {
  it("escapes user HTML and only accepts links belonging to the store", () => {
    const content = authEmailContent(mail);
    expect(content.html).not.toContain("<img src=x");
    expect(content.html).toContain("&lt;img");
    expect(content.text).toContain("30 minutos");
    expect(() =>
      authEmailContent({ ...mail, url: "https://evil.example/reset" }),
    ).toThrow();
  });
  it("delivers both text and HTML over verified TLS after the response", async () => {
    queueAuthEmail(mail);
    expect(smtp.sendMail).not.toHaveBeenCalled();
    await tasks[0]();
    expect(smtp.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: true,
        requireTLS: true,
        tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      }),
    );
    expect(smtp.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: mail.to,
        text: expect.stringContaining(mail.url),
        html: expect.stringContaining("Criar nova senha"),
      }),
    );
    expect(smtp.close).toHaveBeenCalled();
  });
  it("requires TLS for port 587 and rejects unsupported ports", async () => {
    vi.stubEnv("SMTP_PORT", "587");
    await deliverAuthEmail({ ...mail, kind: "verification" });
    expect(smtp.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: false, requireTLS: true }),
    );
    vi.stubEnv("SMTP_PORT", "25");
    await expect(deliverAuthEmail(mail)).rejects.toThrow(
      "AUTH_EMAIL_INVALID_PORT",
    );
  });
  it("fails safely without credentials and does not expose SMTP error details", async () => {
    vi.stubEnv("SMTP_PASSWORD", "");
    await expect(deliverAuthEmail(mail)).rejects.toThrow(
      "AUTH_EMAIL_NOT_CONFIGURED",
    );
    vi.stubEnv("SMTP_PASSWORD", "isolated-secret");
    smtp.sendMail.mockRejectedValue(
      new Error("isolated-secret customer@example.com test-secret"),
    );
    await expect(deliverAuthEmail(mail)).rejects.toThrow(
      /^AUTH_EMAIL_DELIVERY_FAILED$/,
    );
    expect(smtp.close).toHaveBeenCalled();
  });
  it("never enables the local test mailbox in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_EMAIL_TEST_OUTBOX", "/must-not-be-created");
    await deliverAuthEmail(mail);
    expect(smtp.sendMail).toHaveBeenCalledOnce();
  });
});
