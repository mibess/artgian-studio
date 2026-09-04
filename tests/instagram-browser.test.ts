import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { executeInstagramFirstContactOnPage, InstagramBrowserSendError } from "../src/integrations/browser/instagram-cdp";

function createFakePage() {
  let currentUrl = "about:blank";
  const messageControl = {
    or: vi.fn().mockReturnThis(),
    first: vi.fn().mockReturnThis(),
    waitFor: vi.fn(),
    click: vi.fn(async () => { currentUrl = "https://www.instagram.com/direct/t/123/"; }),
  };
  const composer = {
    last: vi.fn().mockReturnThis(),
    waitFor: vi.fn(),
    pressSequentially: vi.fn(),
    press: vi.fn(),
  };
  const page = {
    goto: vi.fn(async (url: string) => { currentUrl = url; }),
    url: vi.fn(() => currentUrl),
    getByRole: vi.fn(() => messageControl),
    locator: vi.fn(() => composer),
    waitForTimeout: vi.fn(),
  } as unknown as Page;
  return { page, messageControl, composer };
}

describe("primeiro contato no Chrome dedicado", () => {
  it("no dry-run apenas valida o perfil e o controle de mensagem", async () => {
    const fake = createFakePage();
    const result = await executeInstagramFirstContactOnPage(fake.page, {
      username: "@perfil.teste",
      message: "Mensagem segura para validação.",
      allowSend: false,
    });
    expect(result.status).toBe("ready");
    const messageControlName = vi.mocked(fake.page.getByRole).mock.calls[0]?.[1]
      ?.name as RegExp;
    expect(messageControlName.test("Enviar mensagem")).toBe(true);
    expect(messageControlName.test("Send message")).toBe(true);
    expect(fake.messageControl.click).not.toHaveBeenCalled();
    expect(fake.composer.pressSequentially).not.toHaveBeenCalled();
  });

  it("só digita e confirma quando allowSend é verdadeiro", async () => {
    const fake = createFakePage();
    const result = await executeInstagramFirstContactOnPage(fake.page, {
      username: "perfil.teste",
      message: "Mensagem aprovada pela operadora.",
      allowSend: true,
    });
    expect(result.status).toBe("sent");
    expect(fake.messageControl.click).toHaveBeenCalledOnce();
    expect(
      vi.mocked(fake.composer.pressSequentially).mock.calls
        .map(([chunk]) => chunk)
        .join(""),
    ).toBe("Mensagem aprovada pela operadora.");
    expect(fake.composer.pressSequentially).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ delay: expect.any(Number) }),
    );
    expect(fake.composer.press).toHaveBeenCalledWith("Enter");
  });

  it("classifica queda durante a confirmação como envio incerto", async () => {
    const fake = createFakePage();
    vi.mocked(fake.composer.press).mockRejectedValueOnce(new Error("connection lost"));
    await expect(executeInstagramFirstContactOnPage(fake.page, {
      username: "perfil.teste",
      message: "Mensagem aprovada pela operadora.",
      allowSend: true,
    })).rejects.toMatchObject({ kind: "uncertain" } satisfies Partial<InstagramBrowserSendError>);
  });
});
