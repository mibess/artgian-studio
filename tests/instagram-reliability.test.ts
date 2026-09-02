import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  decryptInstagramToken,
  encryptInstagramToken,
  shouldRefreshInstagramToken,
} from "../src/integrations/instagram/token-store";
import { extractInboundMessagesFromConversation } from "../src/integrations/instagram/sync";
import { GET as runCron } from "../app/api/cron/instagram/route";

const originalAppSecret = process.env.INSTAGRAM_APP_SECRET;
const originalBusinessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  process.env.INSTAGRAM_APP_SECRET = originalAppSecret;
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = originalBusinessId;
  process.env.CRON_SECRET = originalCronSecret;
});

describe("confiabilidade do Instagram", () => {
  it("criptografa o token antes de persistir", () => {
    process.env.INSTAGRAM_APP_SECRET = "segredo-de-integracao";
    const encrypted = encryptInstagramToken("token-muito-secreto");
    expect(encrypted).not.toContain("token-muito-secreto");
    expect(decryptInstagramToken(encrypted)).toBe("token-muito-secreto");
  });

  it("renova tokens sem validade conhecida e próximos do vencimento", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    expect(shouldRefreshInstagramToken(null, now)).toBe(true);
    expect(
      shouldRefreshInstagramToken(
        {
          key: "instagram",
          status: "healthy",
          encryptedAccessToken: "cipher",
          tokenExpiresAt: "2026-09-10T12:00:00.000Z",
          lastTokenRefreshAt: "2026-08-01T12:00:00.000Z",
          lastHealthCheckAt: null,
          lastSuccessfulSyncAt: null,
          lastRunStartedAt: null,
          lockUntil: null,
          lastError: null,
          metadata: "{}",
          updatedAt: "2026-08-01T12:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("reconcilia somente mensagens recebidas e recentes", () => {
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "business-1";
    const messages = extractInboundMessagesFromConversation({
      profile: { id: "scoped-business", user_id: "business-1", username: "loja" },
      conversation: { id: "conversation-1" },
      since: new Date("2026-09-02T10:00:00.000Z"),
      messages: [
        { id: "inbound-1", created_time: "2026-09-02T11:00:00.000Z", from: { id: "customer-1", username: "cliente" }, message: "Olá" },
        { id: "outbound-1", created_time: "2026-09-02T11:01:00.000Z", from: { id: "business-1", username: "loja" }, message: "Olá!" },
        { id: "old-1", created_time: "2026-09-01T11:00:00.000Z", from: { id: "customer-1" }, message: "Antiga" },
      ],
    });
    expect(messages).toEqual([
      expect.objectContaining({
        externalMessageId: "inbound-1",
        externalConversationId: "business-1:customer-1",
        instagramUsername: "customer-1",
        text: "Olá",
      }),
    ]);
  });

  it("rejeita chamadas do cron sem o segredo", async () => {
    process.env.CRON_SECRET = "segredo-do-cron";
    const response = await runCron(
      new NextRequest("http://localhost/api/cron/instagram"),
    );
    expect(response.status).toBe(401);
  });
});
