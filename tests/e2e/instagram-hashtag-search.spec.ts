import { expect, test } from "@playwright/test";
import { executeInstagramDiscoveryOnPage } from "../../src/integrations/browser/instagram-discovery";
import type { RememberedHashtagPost } from "../../src/features/outbound/hashtag-discovery-domain";
import { readPostAuthor } from "../../src/integrations/browser/instagram-hashtags";

test("lê a autoria no layout real sem article/header, sem usar comentaristas", async ({
  page,
}) => {
  await page.setContent(`<main><div><a href="/sonheem3d/">sonheem3d</a></div>
    <a href="/sonheem3d/"><img alt="Foto do perfil de sonheem3d"></a>
    <a href="/sonheem3d/">sonheem3d</a><p>Legenda</p>
    <a href="/comentarista/"><img alt="Foto do perfil de comentarista"></a>
    <a href="/comentarista/">comentarista</a></main>`);
  expect(await readPostAuthor(page)).toBe("sonheem3d");
  await page.setContent(
    '<main><p>Sem autor visível</p><a href="/comentarista/">comentarista</a></main>',
  );
  expect(await readPostAuthor(page)).toBeNull();
});

test("divide orçamento entre hashtags e alterna candidatos entre buscas", async ({
  context,
  page,
}) => {
  test.setTimeout(60000);
  const previous = { ...process.env };
  for (const suffix of [
    "ACTION_DELAY_SECONDS",
    "RESULTS_WAIT_SECONDS",
    "PROFILE_DWELL_SECONDS",
    "SECONDS_BETWEEN_PROFILES",
    "SECONDS_BETWEEN_SEARCHES",
  ])
    for (const bound of ["MIN", "MAX"])
      process.env[`DISCOVERY_${bound}_${suffix}`] = "0.25";
  process.env.MAX_HASHTAG_POSTS_PER_RUN = "4";
  const inspectedPosts: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "www.instagram.com") return route.abort();
    let body = "";
    if (url.pathname === "/explore/")
      body = `<input placeholder="Pesquisar"><div id="results"></div><script>
      document.querySelector('input').addEventListener('input', e => {
        const term=e.target.value;
        document.querySelector('#results').innerHTML=term.startsWith('#')
          ? '<a href="/explore/tags/'+term.slice(1)+'/">'+term+'</a>'
          : [1,2,3,4,5,6,7,8,9,10,11,12,13].map(i=>'<a href="/'+term+i+'/">'+term+i+'</a>').join('');
      });</script>`;
    else if (url.pathname.includes("/explore/tags/")) {
      const tag = url.pathname.split("/")[3];
      body =
        "<main>" +
        [1, 2, 3, 4].map((i) => `<a href="/p/${tag}${i}/">post</a>`).join("") +
        "</main>";
    } else if (url.pathname.startsWith("/p/")) {
      const key = url.pathname.split("/")[2];
      inspectedPosts.push(key);
      body = key.startsWith("falha")
        ? "<main>Carregando conteúdo</main>"
        : `<article><header><a href="/autor${key}/">autor</a></header></article>`;
    } else {
      const username = url.pathname.split("/")[1];
      body = `<meta property="og:title" content="Autor (@${username}) • Instagram"><main>${username}\nMeu hobby geek</main>`;
    }
    await route.fulfill({ contentType: "text/html", body });
  });
  try {
    const result = await executeInstagramDiscoveryOnPage(page, {
      seeds: [
        { kind: "keyword", value: "termoa" },
        { kind: "hashtag", value: "falha" },
        { kind: "keyword", value: "termob" },
        { kind: "hashtag", value: "valido" },
      ],
      maximumProfiles: 4,
      knownLocations: [],
      excludedUsernames: ["termoa1"],
    });
    expect(inspectedPosts).toEqual(["falha1", "falha2", "valido1", "valido2"]);
    expect(result.queriesScanned).toBe(4);
    expect(result.candidates.map((c) => c.instagramUsername)).toEqual([
      "termoa2",
      "termob1",
      "autorvalido1",
      "termoa3",
    ]);
    expect(context.pages()).toEqual([page]);
  } finally {
    for (const key of Object.keys(process.env))
      if (key.startsWith("DISCOVERY_") || key.startsWith("MAX_HASHTAG_")) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
  }
});

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
