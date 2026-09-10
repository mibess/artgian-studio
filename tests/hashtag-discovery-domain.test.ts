import { describe, expect, it } from "vitest";
import {
  hashtagResultUrl,
  instagramPostFromHref,
  normalizeHashtag,
  postAuthorFromSignals,
  interleaveDiscoveryGroups,
} from "../src/features/outbound/hashtag-discovery-domain";

describe("autoria e identidade da busca por hashtag", () => {
  it("alterna as buscas sem desperdiçar vagas quando um grupo termina", () => {
    expect(
      interleaveDiscoveryGroups([["a1", "a2", "a3"], [], ["b1"], ["c1", "c2"]]),
    ).toEqual(["a1", "b1", "c1", "a2", "c2", "a3"]);
  });
  it("reconhece layout sem article apenas com autoria corroborada", () => {
    const signals = {
      headerHrefs: [],
      leadingProfileHrefs: ["/autor/", "/autor/"],
      firstAvatarAlt: "Foto do perfil de autor",
    };
    expect(postAuthorFromSignals(signals)).toBe("autor");
    expect(
      postAuthorFromSignals({
        ...signals,
        firstAvatarAlt: "Foto do perfil de comentarista",
      }),
    ).toBeNull();
    expect(
      postAuthorFromSignals({
        ...signals,
        leadingProfileHrefs: ["/autor/", "/comentarista/"],
      }),
    ).toBeNull();
    expect(
      postAuthorFromSignals({ ...signals, leadingProfileHrefs: ["/autor/"] }),
    ).toBeNull();
  });
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
