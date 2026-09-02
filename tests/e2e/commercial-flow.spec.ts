import { expect, test } from "@playwright/test";

test("dashboard, leads e inbound dry-run funcionam", async ({ page }) => {
  await page.goto("/comercial");
  await expect(page.getByRole("heading", { name: /Olá, Angélica/i })).toBeVisible();
  await expect(page.getByText("Radar de oportunidades")).toBeVisible();

  await page.getByRole("link", { name: "Leads" }).click();
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  await expect(page.getByText("Mariana Costa")).toBeVisible();

  await page.getByRole("link", { name: "Conversas" }).click();
  await expect(page.getByRole("heading", { name: "Conversas", exact: true })).toBeVisible();
  await page.getByLabel("Perfil de teste").fill(`e2e.${Date.now()}`);
  await page.getByLabel("Mensagem recebida").fill("Quanto custa uma miniatura? Preciso de 2 unidades para 20/09.");
  await page.getByRole("button", { name: "Processar em dry-run" }).click();
  await expect(page.getByText(/Inbound processado/)).toBeVisible();
  await expect(page.getByText(/Composição do score/)).toBeVisible();
});

test("prospecção prepara e revisa rascunho sem enviar mensagem", async ({ page }) => {
  const suffix = Date.now();
  await page.goto("/comercial/campanhas");
  await expect(page.getByRole("heading", { name: "Campanhas e prospecção" })).toBeVisible();
  await expect(page.getByText("Envio outbound bloqueado")).toBeVisible();

  await page.getByPlaceholder("Parcerias locais").fill(`Campanha E2E ${suffix}`);
  await page.getByRole("textbox", { name: "Origem", exact: true }).fill("Instagram");
  await page.getByPlaceholder("Arquitetura e decoração").fill("Decoração local");
  await page.getByRole("button", { name: "Criar campanha segura" }).click();
  await expect(page.getByText("Nenhuma mensagem externa foi enviada.")).toBeVisible();

  await page.locator('select[name="campaignId"]').selectOption({ label: `Campanha E2E ${suffix}` });
  await page.getByPlaceholder("@perfil").fill(`prospecto.e2e.${suffix}`.slice(0, 30));
  await page.getByPlaceholder("Por que este perfil é relevante para a campanha?").fill("Perfil público alinhado ao segmento local da campanha de teste.");
  await page.getByRole("button", { name: "Adicionar sem contatar" }).click();
  await expect(page.getByText("Primeiro contato somente manual").last()).toBeVisible();

  await page.getByRole("button", { name: "Preparar rascunho" }).last().click();
  await expect(page.getByText("Aprovação registra o texto; não envia.").last()).toBeVisible();
  await page.getByRole("button", { name: "Salvar revisão" }).last().click();
  await expect(page.getByText("Nenhuma mensagem externa foi enviada.")).toBeVisible();
});
