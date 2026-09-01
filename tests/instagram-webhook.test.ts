import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractInstagramMessages, verifyMetaSignature } from "../src/integrations/instagram/webhook";

describe("webhook do Instagram", () => {
  it("valida assinatura em tempo constante", () => {
    process.env.INSTAGRAM_APP_SECRET = "segredo-de-teste";
    const body = JSON.stringify({ object: "instagram" });
    const signature = `sha256=${createHmac("sha256", "segredo-de-teste").update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, signature)).toBe(true);
    expect(verifyMetaSignature(body, "sha256=invalida")).toBe(false);
  });

  it("ignora echoes e extrai mensagens inbound", () => {
    const messages = extractInstagramMessages({ entry: [{ id: "business", messaging: [{ sender: { id: "lead-1" }, timestamp: 1_800_000_000_000, message: { mid: "message-1", text: "Quanto custa?" } }, { sender: { id: "business" }, message: { mid: "echo", text: "Olá", is_echo: true } }] }] });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ externalMessageId: "message-1", instagramUsername: "lead-1", text: "Quanto custa?" });
  });
});
