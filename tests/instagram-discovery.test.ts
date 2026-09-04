import type { Page } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { executeInstagramDiscoveryOnPage } from "../src/integrations/browser/instagram-discovery";

function createDiscoveryPage() {
  let currentUrl = "about:blank";
  const searchInput = {
    waitFor: vi.fn(),
    click: vi.fn(),
    fill: vi.fn(),
    pressSequentially: vi.fn(),
  };
  const page = {
    goto: vi.fn(async (url: string) => { currentUrl = url; }),
    url: vi.fn(() => currentUrl),
    waitForTimeout: vi.fn(),
    getByPlaceholder: vi.fn(() => searchInput),
    locator: vi.fn((selector: string) => ({
      evaluateAll: vi.fn(async () => ["/explore/", "/perfil.bom/", "/p/ABC/", "/perfil.outro/"]),
      getAttribute: vi.fn(async () => {
        const username = currentUrl.includes("perfil.outro") ? "Perfil Outro" : "Ateliê Bom";
        if (selector.includes("og:title")) return `${username} (@perfil.bom) • Instagram`;
        return "Presentes personalizados e decoração no Brasil";
      }),
      innerText: vi.fn(async () => currentUrl.includes("perfil.outro")
        ? "perfil.outro\nPerfil Outro\nArte personalizada\nBrasil"
        : "perfil.bom\nAteliê Bom\nPresentes personalizados\nBrasil"),
    })),
  } as unknown as Page;
  return { page, searchInput };
}

describe("descoberta no Chrome dedicado", () => {
  it("pesquisa, filtra rotas internas e lê perfis sem acionar mensagem", async () => {
    const { page, searchInput } = createDiscoveryPage();
    const result = await executeInstagramDiscoveryOnPage(page, {
      seeds: [{ kind: "keyword", value: "presente personalizado" }],
      maximumProfiles: 2,
      knownLocations: ["Brasil"],
      ownUsername: "artgian.studio",
    });
    expect(result.queriesScanned).toBe(1);
    expect(result.profilesInspected).toBe(2);
    expect(result.candidates.map((candidate) => candidate.instagramUsername)).toEqual([
      "perfil.bom",
      "perfil.outro",
    ]);
    expect(vi.mocked(page.goto)).toHaveBeenCalledWith(
      "https://www.instagram.com/explore/",
      expect.any(Object),
    );
    expect(searchInput.click).toHaveBeenCalledOnce();
    expect(searchInput.fill).toHaveBeenCalledWith("");
    expect(
      searchInput.pressSequentially.mock.calls.map(([chunk]) => chunk).join(""),
    ).toBe("presente personalizado");
  });
});
