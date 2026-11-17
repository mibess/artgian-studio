import { afterEach, describe, expect, it, vi } from "vitest";
import { instagramProfileUrl, resolveInstagramConversationUrl } from "../src/integrations/instagram/links";

afterEach(() => vi.unstubAllEnvs());

describe("referências do Instagram", () => {
  it("abre DMs pelo username, sem tratar o ID composto da API como thread web", async () => {
    expect(await resolveInstagramConversationUrl({ externalId: "123:456" }, "@cliente.real"))
      .toBe("https://ig.me/m/cliente.real");
    expect(instagramProfileUrl("@cliente.real")).toBe("https://www.instagram.com/cliente.real/");
    expect(instagramProfileUrl("123456")).toBeNull();
    expect(instagramProfileUrl("../direct")).toBeNull();
  });

  it("resolve IDs de usuários antes de abrir DMs", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ username: "cliente.resolvido" }));
    expect(await resolveInstagramConversationUrl({ externalId: "123:456" }, "456", { accessToken: "test", fetchImpl }))
      .toBe("https://ig.me/m/cliente.resolvido");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/456?");
  });

  it("recupera a publicação de comentários antigos e inclui o comentário original", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ media: { id: "789" } }))
      .mockResolvedValueOnce(Response.json({ permalink: "https://www.instagram.com/reel/ABC_123/?tracking=remove" }));
    expect(await resolveInstagramConversationUrl({ externalId: "comment:456" }, "cliente", { accessToken: "test", fetchImpl }))
      .toBe("https://www.instagram.com/reel/ABC_123/?comment_id=456");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/456?fields=media");
    expect(String(fetchImpl.mock.calls[1][0])).toContain("/789?fields=permalink");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer test" }, cache: "no-store" });
  });

  it.each(["https://evil.example/p/abc/", "https://instagram.com.evil.example/p/abc/", "javascript:alert(1)", "https://www.instagram.com/accounts/login/"])("recusa destino inesperado: %s", async (permalink) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ media: { id: "789" } }))
      .mockResolvedValueOnce(Response.json({ permalink }));
    expect(await resolveInstagramConversationUrl({ externalId: "comment:456" }, "cliente", { accessToken: "test", fetchImpl })).toBeNull();
  });

  it("não inventa um destino quando o comentário foi removido ou a API falha", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("{}", { status: 403 }));
    expect(await resolveInstagramConversationUrl({ externalId: "comment:456" }, "cliente", { accessToken: "test", fetchImpl })).toBeNull();
    fetchImpl.mockRejectedValueOnce(new Error("network"));
    expect(await resolveInstagramConversationUrl({ externalId: "comment:456" }, "cliente", { accessToken: "test", fetchImpl })).toBeNull();
  });
});
