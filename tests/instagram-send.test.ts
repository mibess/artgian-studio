import { describe, expect, it, vi } from "vitest";
import {
  getInstagramRecipientId,
  isInstagramReplyWindowOpen,
  sendInstagramText,
} from "../src/integrations/instagram/send";

describe("envio oficial do Instagram", () => {
  it("extrai somente destinatários reais de conversas do webhook", () => {
    expect(getInstagramRecipientId("17841412290657201:28189437390667071")).toBe(
      "28189437390667071",
    );
    expect(getInstagramRecipientId("ig:cliente.teste")).toBeNull();
    expect(getInstagramRecipientId("demo-ext-conv")).toBeNull();
  });

  it("respeita a janela de resposta de 24 horas", () => {
    const now = new Date("2026-09-02T15:00:00.000Z");
    expect(isInstagramReplyWindowOpen("2026-09-01T15:00:01.000Z", now)).toBe(true);
    expect(isInstagramReplyWindowOpen("2026-09-01T14:59:59.000Z", now)).toBe(false);
  });

  it("envia texto sem colocar o token na URL", async () => {
    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, options) => {
      capturedUrl = String(input);
      capturedOptions = options;
      return new Response(
        JSON.stringify({ recipient_id: "123", message_id: "mid-456" }),
        { status: 200 },
      );
    };
    const result = await sendInstagramText({
      recipientId: "123",
      text: "Olá!",
      accessToken: "token-secreto",
      apiVersion: "v26.0",
      fetchImpl,
    });

    expect(result).toEqual({ recipientId: "123", messageId: "mid-456" });
    expect(capturedUrl).toBe("https://graph.instagram.com/v26.0/me/messages");
    expect(capturedUrl).not.toContain("token-secreto");
    expect(capturedOptions?.headers).toMatchObject({ Authorization: "Bearer token-secreto" });
    expect(JSON.parse(String(capturedOptions?.body))).toEqual({
      recipient: { id: "123" },
      message: { text: "Olá!" },
    });
  });

  it("marca falha de rede como envio incerto", async () => {
    await expect(
      sendInstagramText({
        recipientId: "123",
        text: "Olá!",
        accessToken: "token-secreto",
        fetchImpl: vi.fn(async () => {
          throw new Error("socket encerrado");
        }) as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "uncertain" });
  });
});
