import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

test("importa um Instagram da empresa pendente e mantém reprovações visíveis", async ({
  page,
}) => {
  // Mesmo banco isolado do servidor E2E; nunca usa Chrome, IA ou banco de produção.
  Object.assign(process.env, {
    DATABASE_URL: process.env.E2E_DATABASE_URL || "file:./data/e2e.db",
    COMMERCIAL_DATABASE_MODE: "local",
    TURSO_DATABASE_URL: "",
    TURSO_AUTH_TOKEN: "",
    COMMERCIAL_DEMO_MODE: "true",
    INSTAGRAM_DISCOVERY_ENABLED: "true",
    OPENAI_API_KEY: "",
    QSTASH_TOKEN: "",
    OUTBOUND_AUTOMATION_ENABLED: "false",
    BROWSER_SEND_ENABLED: "false",
  });
  await page.goto("/comercial/campanhas");
  const [
    { getCommercialDb },
    schema,
    { executeInstagramImport },
    { runWorkerOnce },
  ] = await Promise.all([
    import("../../src/db/commercial"),
    import("../../db/schema"),
    import("../../src/features/outbound/instagram-import"),
    import("../../src/worker/processor"),
  ]);
  const db = await getCommercialDb();
  const suffix = Date.now();
  const campaignId = `e2e-import-${suffix}`;
  const username = `natalia.import.${suffix}`;
  const campaignUrl = `/comercial/campanhas?id=${campaignId}&aba=publico&filtro=empresas`;
  await db
    .insert(schema.campaigns)
    .values({
      id: campaignId,
      name: "Parcerias · Importação E2E",
      source: "Google Maps",
      segment: "Manicure e pedicure",
      funnelType: "partner",
      discoveryStrategy: "local_business",
      discoveryLocalNiche: "Manicure",
      discoveryLocalLocation: "Brodowski SP",
      discoveryMinimumScore: 40,
    });
  await db.insert(schema.localBusinessOpportunities).values([
    {
      id: `op-${suffix}`,
      campaignId,
      businessName: "Manicure Importação E2E",
      niche: "Manicure",
      location: "Brodowski SP",
      googleMapsUrl: `https://www.google.com/maps/place/${suffix}`,
      websiteUrl: "https://www.facebook.com/exemplo",
      status: "instagram_not_found",
    },
    {
      id: `bad-${suffix}`,
      campaignId,
      businessName: "Empresa para conferir E2E",
      niche: "Manicure",
      location: "Brodowski SP",
      googleMapsUrl: `https://www.google.com/maps/place/bad-${suffix}`,
      status: "website_opportunity",
    },
  ]);
  await page.goto(campaignUrl);
  const card = page
    .locator("article")
    .filter({ hasText: "Manicure Importação E2E" });
  await card.getByText("Importar Instagram", { exact: true }).click();
  await card.getByLabel("Instagram da empresa").fill(`@${username}`);
  await page.screenshot({
    path: "test-results/campaign-import.png",
    fullPage: true,
    caret: "initial",
  });
  await card.getByRole("button", { name: "Validar e importar" }).click();
  await expect(page).toHaveURL(/aba=publico&filtro=empresas/);
  await expect(
    card.getByText("Aguardando o Chrome local.", { exact: false }),
  ).toBeVisible();
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.idempotencyKey, `import-instagram:op-${suffix}`));
  expect(job.status).toBe("pending");
  const processJob = (jobId: string, fits: boolean) =>
    runWorkerOnce(jobId, {
      executeInstagramImportJob: (input) =>
        executeInstagramImport(input, {
          inspect: async () => ({
            instagramUsername: input.instagramUsername,
            sourceUrl: `https://www.instagram.com/${input.instagramUsername}/`,
            profileBio: "Manicure e pedicure em Brodowski SP",
            discoveryQuery: "Importação",
          }),
          qualify: async () => ({
            available: true,
            decisions: [
              {
                index: 0,
                fits,
                confidence: "high",
                classification: "business",
                reason: fits
                  ? "Empresa local alinhada"
                  : "O perfil não corresponde ao segmento da campanha",
              },
            ],
          }),
        }),
    });
  expect(await processJob(job.id, true)).toMatchObject({
    imported: true,
    created: 1,
  });
  await page.getByRole("button", { name: "Atualizar importações" }).click();
  await expect(card).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Importações de Instagram" }),
  ).toContainText("Instagram aprovado e adicionado ao Público");
  await page.getByRole("link", { name: "Ver perfis no Público →" }).click();
  await expect(
    page.getByRole("button", { name: "Preparar rascunho" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: /Mensagem para/ }),
  ).toHaveCount(0);
  await page.goto(campaignUrl);
  const badCard = page
    .locator("article")
    .filter({ hasText: "Empresa para conferir E2E" });
  await badCard.getByText("Importar Instagram", { exact: true }).click();
  await badCard.getByLabel("Instagram da empresa").fill(`bad.import.${suffix}`);
  await badCard.getByRole("button", { name: "Validar e importar" }).click();
  await expect(badCard.getByRole("status")).toContainText(
    "Aguardando o Chrome",
  );
  const [badJob] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.idempotencyKey, `import-instagram:bad-${suffix}`));
  await processJob(badJob.id, false);
  await page.getByRole("button", { name: "Atualizar importações" }).click();
  await expect(badCard).toBeVisible();
  await expect(badCard.getByRole("status")).toContainText(
    "O perfil não corresponde ao segmento",
  );
  expect(
    await db
      .select()
      .from(schema.outboundProspects)
      .where(
        and(
          eq(schema.outboundProspects.campaignId, campaignId),
          eq(schema.outboundProspects.status, "identified"),
        ),
      ),
  ).toHaveLength(1);
});
