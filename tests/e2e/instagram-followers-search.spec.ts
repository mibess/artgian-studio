import { expect, test, type BrowserContext } from "@playwright/test";
import { executeInstagramFollowersDiscoveryOnPage } from "../../src/integrations/browser/instagram-discovery";

test.beforeEach(() => {
  for (const suffix of [
    "ACTION_DELAY_SECONDS",
    "RESULTS_WAIT_SECONDS",
    "PROFILE_DWELL_SECONDS",
    "SECONDS_BETWEEN_PROFILES",
  ]) {
    process.env[`DISCOVERY_MIN_${suffix}`] = "0.25";
    process.env[`DISCOVERY_MAX_${suffix}`] = "0.25";
  }
});

async function fixture(context: BrowserContext, opens = true) {
  const visits: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "www.instagram.com") return route.abort();
    visits.push(url.pathname);
    if (url.pathname === "/perfilbase/")
      return route.fulfill({
        contentType: "text/html",
        body: `<meta property="og:description" content="113 mil seguidores"><main><a href="#" id="followers">113 mil seguidores</a><a href="/sugestao.errada/">Sugestão fora da lista</a></main><script>document.querySelector('#followers').onclick=(event)=>{event.preventDefault();${opens ? `document.body.insertAdjacentHTML('beforeend','<div role="dialog"><h2>Seguidores</h2><p>Somente perfilbase pode ver todos os seguidores.</p><div id="list" style="height:180px;overflow-y:auto"><a href="/conhecido/">Conhecido</a><div style="height:850px"></div></div></div>');const list=document.querySelector('#list');list.onscroll=()=>{if(list.dataset.loaded)return;list.dataset.loaded='1';list.insertAdjacentHTML('beforeend','<a href="/rejeitado/">Rejeitado</a><a href="/aprovado/">Aprovado</a><a href="/pendente/">Pendente</a>');};` : ""}};</script>`,
      });
    const username = url.pathname.split("/")[1];
    return route.fulfill({
      contentType: "text/html",
      body: `<meta property="og:title" content="Perfil (@${username}) • Instagram"><meta property="og:description" content="Negócio de manicure no Brasil"><main>${username}\nManicure e pedicure</main>`,
    });
  });
  return visits;
}
const input = {
  seeds: [{ kind: "base_profile" as const, value: "perfilbase" }],
  maximumProfiles: 10,
  maximumNewResults: 1,
  minimumBaseFollowers: 20000,
  knownLocations: ["Brasil"],
  excludedUsernames: ["conhecido"],
};

test("seguidores: clica no controle, rola lista interna, substitui rejeitado e guarda pendentes", async ({
  context,
  page,
}) => {
  const visits = await fixture(context);
  const saved: string[] = [];
  const qualified: string[] = [];
  const result = await executeInstagramFollowersDiscoveryOnPage(page, {
    ...input,
    onFollowerLinks: async (_base, usernames) => {
      saved.push(...usernames);
    },
    onFollowerBatch: async (batch) => {
      qualified.push(...batch.inspectedUsernames);
      return batch.candidates.some((c) => c.instagramUsername === "aprovado")
        ? 1
        : 0;
    },
  });
  expect(visits).toEqual(["/perfilbase/", "/rejeitado/", "/aprovado/"]);
  expect(qualified).toEqual(["rejeitado", "aprovado"]);
  expect(saved).toEqual(["rejeitado", "aprovado", "pendente"]);
  expect(result.profilesInspected).toBe(2);
  expect(result.followerProgress).toMatchObject({
    stopReason: "followers_target_reached",
    skippedKnownUsers: 1,
    pendingUsers: 1,
    limitedBaseProfiles: ["perfilbase"],
  });
  expect(result.followerProgress.scrolls).toBeGreaterThan(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(context.pages()).toEqual([page]);
  const beforeResume = visits.length;
  const resumed = await executeInstagramFollowersDiscoveryOnPage(page, {
    ...input,
    excludedUsernames: ["conhecido", "rejeitado", "aprovado"],
    pendingFollowers: [
      { baseUsername: "perfilbase", instagramUsername: "pendente" },
    ],
    onFollowerBatch: async (batch) => {
      expect(batch.inspectedUsernames).toEqual(["pendente"]);
      return 1;
    },
  });
  expect(visits.slice(beforeResume)).toEqual(["/perfilbase/", "/pendente/"]);
  expect(resumed.followerProgress.pendingUsers).toBe(0);
});

test("histórico informa lista parcial sem confundi-la com todos os seguidores", async ({
  page,
}) => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.E2E_DATABASE_URL || "file:./data/e2e.db",
    COMMERCIAL_DATABASE_MODE: "local",
    TURSO_DATABASE_URL: "",
    TURSO_AUTH_TOKEN: "",
    COMMERCIAL_DEMO_MODE: "true",
  });
  await page.goto("/comercial/campanhas");
  const { getCommercialDb } = await import("../../src/db/commercial");
  const s = await import("../../db/schema");
  const db = await getCommercialDb();
  const id = `followers-history-${Date.now()}`;
  await db.insert(s.campaigns).values({
    id,
    name: "Seguidores · Teste de histórico",
    source: "Instagram",
    discoveryStrategy: "instagram_followers",
  });
  await db.insert(s.discoveryRuns).values({
    id: `${id}-run`,
    campaignId: id,
    status: "completed",
    profilesInspected: 2,
    profilesCreated: 1,
    stopReason: "followers_target_reached",
    followerSearchProgress: JSON.stringify({
      stopReason: "followers_target_reached",
      visibleUsers: 12,
      skippedKnownUsers: 7,
      scrolls: 2,
      pendingUsers: 3,
      limitedBaseProfiles: ["perfilbase"],
    }),
  });
  await db.insert(s.auditLogs).values({
    id: `${id}-diagnostic`,
    actor: "system",
    action: "campaign_candidate_rejection_detail",
    entityType: "discovery_run",
    entityId: `${id}-run`,
    metadata: JSON.stringify({
      instagramUsername: "perfil.teste",
      stage: "pre_ai",
      reason: "Pontuação 10 abaixo do mínimo 30.",
    }),
  });
  await page.goto(`/comercial/campanhas?id=${id}&aba=historico`);
  await page.getByText("Ver motivos e falhas de leitura").click();
  await expect(
    page.getByText(
      "@perfil.teste · Filtro anterior à IA · Pontuação 10 abaixo do mínimo 30.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Meta de novos prospectos atingida", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("não representa todos os seguidores", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/followers-search-history.png",
    fullPage: true,
  });
});

test("restrição do Instagram é registrada sem tentar acessar seguidores ocultos", async ({
  context,
  page,
}) => {
  const visits = await fixture(context);
  const result = await executeInstagramFollowersDiscoveryOnPage(page, {
    ...input,
    excludedUsernames: ["conhecido", "rejeitado", "aprovado", "pendente"],
  });
  expect(visits).toEqual(["/perfilbase/"]);
  expect(result.profilesInspected).toBe(0);
  expect(result.followerProgress.stopReason).toBe("followers_restricted_list");
  expect(result.followerProgress.skippedKnownUsers).toBe(4);
});

test("não trata o perfil como lista quando o modal não abre", async ({
  context,
  page,
}) => {
  const visits = await fixture(context, false);
  await expect(
    executeInstagramFollowersDiscoveryOnPage(page, input),
  ).rejects.toMatchObject({
    progress: { stopReason: "followers_list_unavailable" },
  });
  expect(visits).toEqual(["/perfilbase/"]);
});

test("mantém a exigência de mais seguidores que o mínimo configurado", async ({
  context,
  page,
}) => {
  await fixture(context);
  await expect(
    executeInstagramFollowersDiscoveryOnPage(page, {
      ...input,
      minimumBaseFollowers: 113000,
    }),
  ).rejects.toMatchObject({
    progress: { stopReason: "followers_no_eligible_base" },
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
