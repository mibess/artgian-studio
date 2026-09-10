import { expect, test } from "@playwright/test";
import { executeInstagramDiscoveryOnPage } from "../../src/integrations/browser/instagram-discovery";
import type { RememberedHashtagPost } from "../../src/features/outbound/hashtag-discovery-domain";

test("hashtag abre resultado e posts, extrai autores e retoma sem repetir usuários", async ({
  context,
  page,
}) => {
  const savedEnvironment = { ...process.env };
  for (const suffix of [
    "ACTION_DELAY_SECONDS",
    "RESULTS_WAIT_SECONDS",
    "PROFILE_DWELL_SECONDS",
    "SECONDS_BETWEEN_PROFILES",
    "SECONDS_BETWEEN_SEARCHES",
  ]) {
    process.env[`DISCOVERY_MIN_${suffix}`] = "0.25";
    process.env[`DISCOVERY_MAX_${suffix}`] = "0.25";
  }
  process.env.MAX_HASHTAG_POSTS_PER_RUN = "3";
  const visits: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "www.instagram.com") return route.abort();
    visits.push(url.pathname);
    if (url.pathname === "/explore/")
      return route.fulfill({
        contentType: "text/html",
        body: '<input placeholder="Pesquisar"><a href="/sugestao.errada/">Perfil sugerido</a><a href="/explore/tags/manicure/">#manicure</a>',
      });
    if (url.pathname === "/explore/tags/manicure/")
      return route.fulfill({
        contentType: "text/html",
        body: `<main><a href="/p/KNOWN01/">Conhecido</a><div style="height:2000px"></div></main><script>window.addEventListener('scroll',()=>{if(document.body.dataset.more)return;document.body.dataset.more='1';document.querySelector('main').insertAdjacentHTML('beforeend','<a href="/p/POST001/">Post 1</a><a href="/p/POST002/">Post 2 mesmo autor</a><a href="/reel/POST003/">Reel</a><a href="/p/POST004/">Pendente</a>');});</script>`,
      });
    const post = url.pathname.match(/^\/(?:p|reel)\/([^/]+)/)?.[1];
    if (post) {
      const username =
        post === "POST004"
          ? "autor.final"
          : post === "POST003"
            ? "autor.segundo"
            : "autor.primeiro";
      return route.fulfill({
        contentType: "text/html",
        body: `<article><header><a href="/${username}/">${username}</a></header><p>Legenda</p><section><a href="/comentarista.errado/">Comentário</a></section></article><aside><a href="/sugestao.errada/">Sugestão</a></aside>`,
      });
    }
    const username = url.pathname.split("/")[1];
    return route.fulfill({
      contentType: "text/html",
      body: `<meta property="og:title" content="Autor (@${username}) • Instagram"><meta property="og:description" content="Manicure em Brodowski"><main>${username}\nManicure em Brodowski</main>`,
    });
  });
  const memory: RememberedHashtagPost[] = [
    {
      hashtag: "manicure",
      postKey: "KNOWN01",
      postUrl: "https://www.instagram.com/p/KNOWN01/",
      instagramUsername: "ja.analisado",
      status: "resolved",
      revisitAfter: null,
    },
  ];
  const run = (excludedUsernames: string[]) =>
    executeInstagramDiscoveryOnPage(page, {
      seeds: [{ kind: "hashtag", value: "manicure" }],
      maximumProfiles: 1,
      knownLocations: ["Brodowski"],
      excludedUsernames,
      rememberedHashtagPosts: memory.map((post) => ({ ...post })),
      onHashtagLinks: async (hashtag, posts) => {
        for (const post of posts)
          if (!memory.some((known) => known.postKey === post.postKey))
            memory.push({
              hashtag,
              ...post,
              instagramUsername: null,
              status: "pending",
              revisitAfter: null,
            });
      },
      onHashtagPost: async (hashtag, postKey, username) => {
        Object.assign(
          memory.find(
            (post) => post.hashtag === hashtag && post.postKey === postKey,
          )!,
          {
            instagramUsername: username,
            status: username ? "resolved" : "unavailable",
          },
        );
      },
    });
  try {
    const first = await run(["ja.analisado"]);
    expect(
      first.candidates.map((candidate) => candidate.instagramUsername),
    ).toEqual(["autor.primeiro"]);
    expect(first.candidates[0].discoveryKind).toBe("hashtag");
    expect(visits).toContain("/explore/tags/manicure/");
    expect(visits).toContain("/p/POST001/");
    expect(visits).toContain("/reel/POST003/");
    expect(visits).not.toContain("/p/KNOWN01/");
    expect(visits).not.toContain("/comentarista.errado/");
    expect(visits).not.toContain("/sugestao.errada/");
    expect(memory.find((post) => post.postKey === "POST004")?.status).toBe(
      "pending",
    );
    const previousVisits = visits.length;
    const second = await run(["ja.analisado", "autor.primeiro"]);
    expect(
      second.candidates.map((candidate) => candidate.instagramUsername),
    ).toEqual(["autor.segundo"]);
    expect(visits.slice(previousVisits)).not.toContain("/p/POST001/");
    expect(visits.slice(previousVisits)).not.toContain("/p/POST002/");
    expect(visits.slice(previousVisits)).not.toContain("/reel/POST003/");
    expect(visits.slice(previousVisits)).not.toContain("/autor.primeiro/");
    expect(context.pages()).toEqual([page]);
  } finally {
    for (const key of Object.keys(process.env))
      if (key.startsWith("DISCOVERY_") || key.startsWith("MAX_HASHTAG_")) {
        if (savedEnvironment[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnvironment[key];
      }
  }
});
