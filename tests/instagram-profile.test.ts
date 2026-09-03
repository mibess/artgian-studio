import { describe, expect, it, vi } from "vitest";
import { getInstagramMessagingProfile } from "../src/integrations/instagram/profile";

describe("perfil de mensageria do Instagram", () => {
  it("resolve o IGSID para o username usado pelo CRM", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          id: "123456789",
          username: "cliente.real",
          name: "Cliente Real",
        }),
        { status: 200 },
      ),
    );
    const profile = await getInstagramMessagingProfile("123456789", {
      accessToken: "token-de-teste",
      apiVersion: "v26.0",
      fetchImpl,
    });
    expect(profile).toEqual({
      id: "123456789",
      username: "cliente.real",
      name: "Cliente Real",
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "/v26.0/123456789?fields=id%2Cname%2Cusername",
    );
  });

  it("falha fechado para identificador ou resposta inválidos", async () => {
    expect(
      await getInstagramMessagingProfile("perfil", {
        accessToken: "token-de-teste",
        fetchImpl: vi.fn(),
      }),
    ).toBeNull();
    expect(
      await getInstagramMessagingProfile("123", {
        accessToken: "token-de-teste",
        fetchImpl: vi.fn<typeof fetch>(async () => new Response("{}", { status: 403 })),
      }),
    ).toBeNull();
  });
});
