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
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("heading", { name: "Campanhas e prospecção" })).toBeVisible();
  await expect(page.getByPlaceholder("Parcerias locais")).toHaveCount(0);
  await page.getByRole("link", { name: "Nova campanha", exact: true }).click();

  await page.getByPlaceholder("Parcerias locais").fill(`Campanha E2E ${suffix}`);
  await page.getByRole("textbox", { name: "Origem", exact: true }).fill("Instagram");
  await page.getByPlaceholder("Arquitetura e decoração").fill("Decoração local");
  await page.locator('select[name="funnelType"]').selectOption("partner");
  await page.screenshot({ path: "test-results/campaign-create.png", fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Criar campanha" }).click();
  await expect(page.getByText("Campanha salva. Configure a busca para começar.")).toBeVisible();
  await expect(page).toHaveURL(/id=.+&aba=busca/);
  const campaignId = new URL(page.url()).searchParams.get("id");
  await expect(page.getByText("Envio outbound bloqueado")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Estratégia e critérios" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preparar rascunho" })).toHaveCount(0);
  await page.getByRole("button", { name: "Salvar estratégia e critérios" }).click();
  await expect(page.getByText("Configuração de busca atualizada.")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("id")).toBe(campaignId);
  await expect(page).toHaveURL(/aba=busca/);
  await page.screenshot({ path: "test-results/campaign-search.png", fullPage: true, caret: "initial" });

  await page.getByText("Seguidores de perfis-base", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Seguidores de perfis-base/ })).toBeChecked();
  await expect(page.getByLabel(/Mínimo de seguidores/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar estratégia e critérios" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Adicione ao menos um perfil-base válido" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("id")).toBe(campaignId);
  await expect(page).toHaveURL(/aba=busca/);
  await page.getByText("Empresas locais", { exact: true }).click();
  await expect(page.getByLabel("Cidade ou região", { exact: true })).toBeVisible();
  await page.getByText("Termos no Instagram", { exact: true }).click();

  await page.getByRole("navigation", { name: "Etapas da campanha" }).getByRole("link", { name: /Público/ }).click();
  await page.getByText("Adicionar prospecto manualmente", { exact: true }).click();
  await page.getByPlaceholder("@perfil", { exact: true }).fill(`prospecto.e2e.${suffix}`.slice(0, 30));
  await page.getByPlaceholder("Categoria pública").fill("Arquitetura");
  await page.getByPlaceholder("Localização pública").fill("Brasil");
  await page.getByPlaceholder("Sinal público verdadeiro").fill("seu projeto recente de organização de ambientes");
  await page.getByPlaceholder("Por que este perfil é relevante para a campanha?").fill("Perfil público alinhado ao segmento local da campanha de teste.");
  await page.getByRole("button", { name: "Adicionar sem contatar" }).click();
  expect(new URL(page.url()).searchParams.get("id")).toBe(campaignId);
  await expect(page).toHaveURL(/aba=publico/);
  await expect(page.getByText("Primeiro contato somente manual").last()).toBeVisible();
  await expect(page.getByText(/Parceiros/).last()).toBeVisible();
  await page.screenshot({ path: "test-results/campaign-audience.png", fullPage: true, caret: "initial" });

  await page.getByRole("button", { name: "Preparar rascunho" }).last().click();
  await expect(page).toHaveURL(/aba=mensagens/);
  expect(new URL(page.url()).searchParams.get("id")).toBe(campaignId);
  await expect(page.getByText("Aprovação registra o texto; não envia.").last()).toBeVisible();
  await page.getByRole("button", { name: "Salvar revisão" }).last().click();
  await expect(page.getByText("Revisão salva. A mensagem está pronta para agendar.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Agendar mensagem" }).last()).toBeDisabled();
  await page.screenshot({ path: "test-results/campaign-messages.png", fullPage: true, caret: "initial" });
  await page.getByLabel("Status da mensagem").selectOption("sent");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /Mensagem para/ })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Etapas da campanha" }).getByRole("link", { name: /Público/ }).click();
  await expect(page.getByRole("link", { name: /Revisar mensagem/ })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Mensagem para/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Empresas sem Instagram/ }).click();
  await expect(page.getByRole("link", { name: /Revisar mensagem/ })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Etapas da campanha" }).getByRole("link", { name: "Histórico", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Histórico de buscas" })).toBeVisible();
  await page.getByRole("button", { name: "Atualizar resultados" }).click();
  await expect(page).toHaveURL(/aba=historico/);

  await page.getByRole("link", { name: "Todas as campanhas" }).click();
  await page.getByLabel("Pesquisar campanhas").fill(`Campanha E2E ${suffix}`);
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.screenshot({ path: "test-results/campaign-list.png", fullPage: true, caret: "initial" });
  await page.getByRole("link", { name: `Abrir campanha Campanha E2E ${suffix}` }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Etapas da campanha" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/campaign-mobile.png", fullPage: true, caret: "initial" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(400);
  await expect(page.getByRole("heading", { name: "Suas mensagens já estão revisadas" })).toBeVisible();
  await page.screenshot({ path: "test-results/campaign-overview.png", fullPage: true, caret: "initial" });

  await page.getByRole("link", { name: "Nova campanha", exact: true }).click();
  await page.getByPlaceholder("Parcerias locais").fill(`Outra campanha E2E ${suffix}`);
  await page.getByRole("textbox", { name: "Origem", exact: true }).fill("Instagram");
  await page.getByRole("button", { name: "Criar campanha", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Outra campanha E2E ${suffix}`, exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("id")).not.toBe(campaignId);
  await page.getByRole("navigation", { name: "Etapas da campanha" }).getByRole("link", { name: /Público/ }).click();
  await expect(page.getByText("Seu público aparecerá aqui", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Revisar mensagem/ })).toHaveCount(0);

  await page.getByRole("link", { name: "Funil" }).click();
  await expect(page.getByRole("heading", { name: "Funil de consumidores" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Funil de parceiros" })).toBeVisible();
});
