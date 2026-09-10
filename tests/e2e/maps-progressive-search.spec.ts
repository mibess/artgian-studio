import { expect, test } from "@playwright/test";
import { executeLocalBusinessDiscoveryOnPage } from "../../src/integrations/browser/instagram-discovery";

test("campanha mostra motivo de encerramento e continuidade no histórico", async ({
  page,
}) => {
  Object.assign(process.env, {
    DATABASE_URL: "file:./data/e2e.db",
    COMMERCIAL_DATABASE_MODE: "local",
    TURSO_DATABASE_URL: "",
    TURSO_AUTH_TOKEN: "",
    COMMERCIAL_DEMO_MODE: "true",
  });
  await page.goto("/comercial/campanhas");
  const { getCommercialDb } = await import("../../src/db/commercial");
  const schema = await import("../../db/schema");
  const db = await getCommercialDb();
  const campaignId = `progress-${Date.now()}`;
  await db
    .insert(schema.campaigns)
    .values({
      id: campaignId,
      name: "Busca progressiva · Teste",
      source: "Maps",
      discoveryStrategy: "local_business",
    });
  await db
    .insert(schema.discoveryRuns)
    .values({
      id: `${campaignId}-run`,
      campaignId,
      status: "completed",
      profilesInspected: 2,
      profilesQualified: 1,
      profilesCreated: 1,
      skippedLowScore: 1,
      stopReason: "target_reached",
      localSearchProgress: JSON.stringify({
        stopReason: "target_reached",
        linksSeen: 12,
        skippedKnownBusinesses: 7,
        scrolls: 3,
        pendingBusinesses: 3,
      }),
    });
  await page.goto(`/comercial/campanhas?id=${campaignId}&aba=historico`);
  await expect(
    page.getByText("Meta de novos resultados atingida", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("3 pendentes para continuar", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/maps-search-history.png",
    fullPage: true,
  });
  await page.goto(`/comercial/campanhas?id=${campaignId}`);
  await expect(
    page.getByText("Meta de novos resultados atingida", { exact: true }),
  ).toBeVisible();
});

test("Maps: ignora conhecidos, rola a lista, substitui rejeitado e preserva excedentes", async ({
  context,
  page,
}) => {
  // All remote navigation is fulfilled locally. No Google/Instagram/AI request.
  const previous = { ...process.env };
  for (const action of [
    "ACTION_DELAY",
    "RESULTS_WAIT",
    "PROFILE_DWELL",
    "SECONDS_BETWEEN_PROFILES",
    "SCROLL_PAUSE",
  ]) {
    const suffix =
      action === "SECONDS_BETWEEN_PROFILES" ? action : action + "_SECONDS";
    process.env[`DISCOVERY_MIN_${suffix}`] = "0.25";
    process.env[`DISCOVERY_MAX_${suffix}`] = "0.25";
  }
  const maps = (n: number) =>
    `https://www.google.com/maps/place/Empresa${n}/data=!1s0x1:0x${n}`;
  const opened: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "www.google.com" && url.pathname.includes("/place/")) {
      const id = url.pathname.match(/Empresa(\d)/)![1];
      opened.push(id);
      await route.fulfill({
        contentType: "text/html",
        body: `<h1>Manicure ${id}</h1><button data-item-id="address">Brodowski SP</button><button data-item-id="phone:1">16 9999</button><h2>Resultados da Web</h2><a href="https://www.instagram.com/manicure.${id}/">Instagram</a><a data-item-id="authority" href="https://example.org">Site</a>`,
      });
    } else if (url.hostname === "www.google.com") {
      await route.fulfill({
        contentType: "text/html",
        body: `<div role="feed" style="height:200px;overflow:auto"><a href="${maps(1)}">Conhecida</a><div style="height:900px"></div></div><script>const feed=document.querySelector('[role="feed"]'); feed.addEventListener('scroll',()=>{if(feed.dataset.loaded)return;feed.dataset.loaded='1';feed.insertAdjacentHTML('beforeend',${JSON.stringify([2, 3, 4].map((n) => `<a href="${maps(n)}">Empresa ${n}</a>`).join("") + "<p>Você chegou ao final da lista</p>")});});</script>`,
      });
    } else if (url.hostname === "www.instagram.com") {
      const username = url.pathname.split("/")[1];
      await route.fulfill({
        contentType: "text/html",
        body: `<meta property="og:title" content="Manicure (@${username}) • Instagram"><meta property="og:description" content="Manicure e pedicure em Brodowski SP"><main>${username}\nManicure e pedicure em Brodowski SP</main>`,
      });
    } else await route.abort();
  });
  try {
    const saved: string[] = [];
    const validated: string[] = [];
    const result = await executeLocalBusinessDiscoveryOnPage(page, {
      seeds: [{ kind: "local_business", value: "Manicure em Brodowski" }],
      maximumProfiles: 10,
      maximumNewResults: 1,
      knownLocations: ["Brodowski"],
      localNiche: "Manicure",
      localLocation: "Brodowski",
      excludedLocalBusinessUrls: [maps(1) + "?hl=pt"],
      onLocalLinks: async (urls) => {
        saved.push(...urls);
      },
      onLocalBatch: async (batch) => {
        validated.push(
          ...batch.candidates.map((candidate) => candidate.instagramUsername),
        );
        return batch.candidates.some(
          (candidate) => candidate.instagramUsername === "manicure.3",
        )
          ? 1
          : 0;
      },
    });
    expect(opened).toEqual(["2", "3"]);
    expect(validated).toEqual(["manicure.2", "manicure.3"]);
    expect(saved).toEqual([maps(2), maps(3), maps(4)]);
    expect(result.profilesInspected).toBe(2);
    expect(result.localProgress).toMatchObject({
      stopReason: "target_reached",
      skippedKnownBusinesses: 1,
      pendingBusinesses: 1,
    });
    expect(result.localProgress.scrolls).toBeGreaterThan(0);
    expect(context.pages()).toEqual([page]);
    await expect(page.getByRole("feed")).toBeVisible();
  } finally {
    for (const key of Object.keys(process.env))
      if (key.startsWith("DISCOVERY_")) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
  }
});
