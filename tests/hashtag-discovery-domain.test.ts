import { describe, expect, it } from "vitest";
import {
  hashtagResultUrl,
  instagramPostFromHref,
  normalizeHashtag,
  postAuthorFromSignals,
} from "../src/features/outbound/hashtag-discovery-domain";

describe("autoria e identidade da busca por hashtag", () => {
  it("aceita apenas um resultado correspondente à hashtag, nunca um perfil sugerido", () => {
    expect(hashtagResultUrl("/explore/tags/Manicure/", "#manicure")).toContain(
      "/explore/tags/Manicure/",
    );
    expect(
      hashtagResultUrl("/explore/search/keyword/?q=%23manicure", "manicure"),
    ).toBeTruthy();
    expect(hashtagResultUrl("/manicure/", "manicure")).toBeNull();
    expect(hashtagResultUrl("/explore/tags/manicures/", "manicure")).toBeNull();
    expect(
      hashtagResultUrl("https://evil.com/explore/tags/manicure/", "manicure"),
    ).toBeNull();
    expect(normalizeHashtag("#Manicure")).toBe("manicure");
  });
  it("deduplica posts/reels pelo código, removendo rastreamento", () => {
    expect(instagramPostFromHref("/p/ABC123/?igsh=tracking")).toEqual({
      postKey: "ABC123",
      postUrl: "https://www.instagram.com/p/ABC123/",
    });
    expect(instagramPostFromHref("/reel/ABC123/")?.postKey).toBe(
      instagramPostFromHref("/reels/ABC123/")?.postKey,
    );
    expect(instagramPostFromHref("/autor/")).toBeNull();
    expect(instagramPostFromHref("https://evil.com/p/ABC123/")).toBeNull();
  });
  it("exige evidência de autoria e recusa cabeçalhos ambíguos", () => {
    expect(postAuthorFromSignals({ headerHrefs: ["/autor/", "/autor/"] })).toBe(
      "autor",
    );
    expect(
      postAuthorFromSignals({ headerHrefs: ["/autor/", "/outro/"] }),
    ).toBeNull();
    expect(
      postAuthorFromSignals({
        headerHrefs: [],
        title: "Autor (@autor) • Instagram",
      }),
    ).toBe("autor");
    expect(
      postAuthorFromSignals({
        headerHrefs: [],
        structuredAuthors: ["https://www.instagram.com/autor/"],
      }),
    ).toBe("autor");
    expect(
      postAuthorFromSignals({
        headerHrefs: [],
        title: "Uma legenda menciona @comentarista",
      }),
    ).toBeNull();
  });
});
