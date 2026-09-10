import type { Page } from "playwright-core";
import { boundedDiscoverySetting } from "../../features/outbound/local-discovery-domain";
import {
  hashtagResultUrl,
  instagramPostFromHref,
  normalizeHashtag,
  postAuthorFromSignals,
  type HashtagDiscoveryOptions,
} from "../../features/outbound/hashtag-discovery-domain";
import { randomInteger } from "../../features/automation/human-pacing";
import { pauseLikePerson } from "./human-pacing";

function assertSession(page: Page) {
  const url = new URL(page.url());
  if (
    url.protocol !== "https:" ||
    !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
    /^\/(accounts|challenge|checkpoint)\//.test(url.pathname)
  ) {
    throw new Error(
      "A busca por hashtag precisa de uma sessão válida do Instagram; confira o Chrome.",
    );
  }
}

export async function readPostAuthor(page: Page) {
  const signals = await page.evaluate(() => {
    const root =
      document.querySelector("article") ||
      document.querySelector('[role="dialog"]');
    const headerHrefs = root
      ? Array.from(
          root.querySelectorAll('header a[href], a[rel="author"]'),
        ).map((a) => a.getAttribute("href") || "")
      : [];
    const structuredAuthors: string[] = [];
    for (const script of document.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      try {
        const value = JSON.parse(script.textContent || "null");
        const entries = Array.isArray(value)
          ? value
          : Array.isArray(value?.["@graph"])
            ? value["@graph"]
            : [value];
        for (const entry of entries) {
          if (
            !["SocialMediaPosting", "VideoObject", "ImageObject"].includes(
              entry?.["@type"],
            )
          )
            continue;
          const authors = Array.isArray(entry.author)
            ? entry.author
            : [entry.author];
          for (const author of authors)
            if (typeof author?.url === "string")
              structuredAuthors.push(author.url);
        }
      } catch {
        /* Optional public metadata. */
      }
    }
    return {
      headerHrefs,
      structuredAuthors,
      leadingProfileHrefs: Array.from(document.querySelectorAll("main a[href]"))
        .filter(
          (a) =>
            !a.closest("aside, nav") &&
            a.textContent?.trim() &&
            /^\/[a-z0-9._]+\/$/i.test(a.getAttribute("href") || ""),
        )
        .slice(0, 2)
        .map((a) => a.getAttribute("href") || ""),
      firstAvatarAlt: document
        .querySelector(
          'main a[href] img[alt^="Foto do perfil de "], main a[href] img[alt^="Profile picture of "], main a[href] img[alt$="profile picture"]',
        )
        ?.getAttribute("alt"),
      title: document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute("content"),
    };
  });
  return postAuthorFromSignals(signals);
}

export async function discoverHashtagAuthors(
  searchPage: Page,
  input: HashtagDiscoveryOptions & {
    hashtag: string;
    maximumAuthors: number;
    maximumPosts: number;
    excludedUsernames: Set<string>;
    deadline: number;
  },
) {
  const hashtag = normalizeHashtag(input.hashtag);
  const remembered = input.rememberedHashtagPosts || [];
  const knownPosts = new Map<string, (typeof remembered)[number]>();
  for (const post of remembered) {
    // A pending occurrence under another hashtag must not hide known authorship.
    if (
      !knownPosts.get(post.postKey)?.instagramUsername ||
      post.instagramUsername
    )
      knownPosts.set(post.postKey, post);
  }
  const authors = new Set<string>();
  const seenPosts = new Set<string>();
  const pending: Array<{ postKey: string; postUrl: string }> = [];
  let postsInspected = 0;
  let scrolls = 0;
  const rememberAuthor = (username: string | null) => {
    if (username && !input.excludedUsernames.has(username))
      authors.add(username);
  };
  for (const post of remembered.filter((row) => row.hashtag === hashtag)) {
    if (post.instagramUsername) {
      seenPosts.add(post.postKey);
      rememberAuthor(post.instagramUsername);
    } else if (
      post.status === "author_unresolved" &&
      post.revisitAfter &&
      post.revisitAfter > new Date().toISOString()
    )
      seenPosts.add(post.postKey);
    else {
      seenPosts.add(post.postKey);
      pending.push(post);
    }
  }
  if (authors.size >= input.maximumAuthors)
    return {
      authors: [...authors].slice(0, input.maximumAuthors),
      postsInspected,
      scrolls,
    };
  const hrefs = await searchPage
    .locator("a[href]")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") || ""),
    );
  const resultUrl = hrefs
    .map((href) => hashtagResultUrl(href, hashtag))
    .find(Boolean);
  if (!resultUrl)
    throw new Error(
      `Não foi encontrado um resultado navegável para #${hashtag}. Nenhum perfil sugerido foi usado como autor.`,
    );

  const tagPage = await searchPage.context().newPage();
  let postPage: Page | undefined;
  try {
    await tagPage.goto(resultUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    assertSession(tagPage);
    if (!hashtagResultUrl(tagPage.url(), hashtag))
      throw new Error(
        "O resultado da hashtag redirecionou para uma página inesperada.",
      );
    await pauseLikePerson(tagPage, {
      minimumVariable: "DISCOVERY_MIN_RESULTS_WAIT_SECONDS",
      maximumVariable: "DISCOVERY_MAX_RESULTS_WAIT_SECONDS",
      defaultMinimumSeconds: 4,
      defaultMaximumSeconds: 8,
    });
    postPage = await searchPage.context().newPage();
    const maximumScrolls = boundedDiscoverySetting(
      process.env.MAX_HASHTAG_SCROLLS_PER_QUERY,
      30,
      60,
    );
    let stagnant = 0;
    let previousPosition = -1;
    while (authors.size < input.maximumAuthors && Date.now() < input.deadline) {
      if (pending.length) {
        if (postsInspected >= input.maximumPosts) break;
        const post = pending.shift()!;
        const known = knownPosts.get(post.postKey);
        if (known?.instagramUsername) {
          rememberAuthor(known.instagramUsername);
          await input.onHashtagPost?.(
            hashtag,
            post.postKey,
            known.instagramUsername,
          );
          continue;
        }
        if (
          known?.status === "author_unresolved" &&
          known.revisitAfter &&
          known.revisitAfter > new Date().toISOString()
        )
          continue;
        if (postsInspected)
          await pauseLikePerson(postPage, {
            minimumVariable: "DISCOVERY_MIN_SECONDS_BETWEEN_PROFILES",
            maximumVariable: "DISCOVERY_MAX_SECONDS_BETWEEN_PROFILES",
            defaultMinimumSeconds: 8,
            defaultMaximumSeconds: 20,
            absoluteMaximumSeconds: 90,
          });
        await postPage.goto(post.postUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        assertSession(postPage);
        if (instagramPostFromHref(postPage.url())?.postKey !== post.postKey)
          throw new Error(
            "O post da hashtag redirecionou para uma página inesperada.",
          );
        await pauseLikePerson(postPage, {
          minimumVariable: "DISCOVERY_MIN_PROFILE_DWELL_SECONDS",
          maximumVariable: "DISCOVERY_MAX_PROFILE_DWELL_SECONDS",
          defaultMinimumSeconds: 4,
          defaultMaximumSeconds: 8,
        });
        let username = await readPostAuthor(postPage);
        // React may still be rendering the byline after DOMContentLoaded.
        if (!username && Date.now() + 1000 < input.deadline) {
          await postPage.waitForTimeout(1000);
          username = await readPostAuthor(postPage);
        }
        postsInspected += 1;
        await input.onHashtagPost?.(hashtag, post.postKey, username);
        knownPosts.set(post.postKey, {
          hashtag,
          ...post,
          instagramUsername: username,
          status: username ? "resolved" : "author_unresolved",
          revisitAfter: null,
        });
        rememberAuthor(username);
        continue;
      }
      const snapshot = await tagPage.evaluate(() => {
        const root = document.querySelector("main") || document;
        return {
          hrefs: Array.from(root.querySelectorAll("a[href]")).map(
            (anchor) => anchor.getAttribute("href") || "",
          ),
          position:
            window.scrollY +
            Array.from(document.querySelectorAll("main, main *")).reduce(
              (total, element) => total + element.scrollTop,
              0,
            ),
        };
      });
      const added: Array<{ postKey: string; postUrl: string }> = [];
      for (const href of snapshot.hrefs) {
        const post = instagramPostFromHref(href);
        if (!post || seenPosts.has(post.postKey)) continue;
        seenPosts.add(post.postKey);
        added.push(post);
        pending.push(post);
      }
      if (added.length) await input.onHashtagLinks?.(hashtag, added);
      stagnant =
        added.length || snapshot.position > previousPosition ? 0 : stagnant + 1;
      previousPosition = snapshot.position;
      if (pending.length) continue;
      if (
        stagnant >= 4 ||
        scrolls >= maximumScrolls ||
        postsInspected >= input.maximumPosts
      )
        break;
      await tagPage.evaluate(
        (distance) => {
          let current: Element | null = document.querySelector(
            'main a[href*="/p/"], main a[href*="/reel/"]',
          );
          while (current) {
            if (
              current.scrollHeight > current.clientHeight + 80 &&
              /(auto|scroll)/.test(getComputedStyle(current).overflowY)
            ) {
              current.scrollBy({ top: distance, behavior: "smooth" });
              return;
            }
            current = current.parentElement;
          }
          window.scrollBy({ top: distance, behavior: "smooth" });
        },
        randomInteger(450, 800),
      );
      scrolls += 1;
      await pauseLikePerson(tagPage, {
        minimumVariable: "DISCOVERY_MIN_RESULTS_WAIT_SECONDS",
        maximumVariable: "DISCOVERY_MAX_RESULTS_WAIT_SECONDS",
        defaultMinimumSeconds: 4,
        defaultMaximumSeconds: 8,
      });
    }
    return {
      authors: [...authors].slice(0, input.maximumAuthors),
      postsInspected,
      scrolls,
    };
  } finally {
    await postPage?.close().catch(() => undefined);
    await tagPage.close().catch(() => undefined);
  }
}
