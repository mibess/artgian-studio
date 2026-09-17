import { test, expect } from "@playwright/test";
import { loginAdmin } from "./admin-login";

test("admin cria produto, publica página, altera preço e arquiva em todos os canais", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAdmin(page);
  await page.goto("/admin/produtos");
  await page
    .getByRole("button", { name: "+ Novo produto", exact: true })
    .click();
  const suffix = Date.now();
  const name = `Peça E2E ${suffix}`;
  const slug = `peca-e2e-${suffix}`;
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByLabel("Categoria", { exact: true }).fill("Decoração");
  await page
    .getByLabel("Descrição do produto")
    .fill("Uma peça com identidade própria.");
  await page.getByLabel("Tipo de preço").selectOption("fixed");
  await page.getByLabel("Preço (R$)", { exact: true }).fill("89.90");
  await page.getByLabel("Criar página na loja").check();
  await page.getByLabel("Endereço do produto").fill(slug);
  await page.getByLabel("Exibir na vitrine").check();
  await page.getByLabel("Destacar na página inicial").check();
  await page.getByLabel("Permitir compra direta").check();
  await page.getByRole("tab", { name: "Página e imagens" }).click();
  await page
    .getByRole("button", { name: "Adicionar imagem", exact: true })
    .click();
  await page
    .getByLabel("Imagem 1 (URL)", { exact: true })
    .fill("/organizador-arco-capa.png");
  await page.getByLabel("Descrição da imagem 1").fill("Peça de teste");
  await page
    .getByRole("button", { name: "Adicionar seção", exact: true })
    .click();
  await page.getByLabel("Título da seção").fill("Feita para você");
  await page
    .getByLabel("Texto da seção")
    .fill("Conteúdo personalizado cadastrado no admin.");
  await page.getByRole("tab", { name: "Atendimento", exact: true }).click();
  await page
    .getByLabel("Outros nomes usados pelos clientes (um por linha)")
    .fill(`apelido ${suffix}`);
  await page
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Produto salvo");
  await page.goto(`/produtos/${slug}`);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("R$ 89,90", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Feita para você" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click();
  await page.goto("/carrinho");
  await expect(page.getByRole("article")).toContainText("R$ 89,90");
  await page.goto("/admin/produtos");
  await page.getByRole("button").filter({ hasText: name }).click();
  await page.getByLabel("Preço (R$)", { exact: true }).fill("99.90");
  await page
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Produto salvo");
  await page.goto(`/produtos/${slug}`);
  await expect(page.getByText("R$ 99,90", { exact: true })).toBeVisible();
  await page.goto("/admin/conversas");
  await page.getByLabel("Perfil de teste").fill(`produto.e2e.${suffix}`);
  await page
    .getByLabel("Mensagem recebida")
    .fill(`Quanto custa apelido ${suffix}?`);
  await expect(page.getByLabel("Mensagem recebida")).toHaveValue(
    `Quanto custa apelido ${suffix}?`,
  );
  await page.getByRole("button", { name: "Processar em dry-run" }).click();
  await expect(page.getByText(/sai por R\$\s*99,90/)).toBeVisible();
  await page.goto("/admin/produtos");
  await page.getByRole("button").filter({ hasText: name }).click();
  await page.getByLabel("Produto ativo", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Produto salvo");
  await page.goto(`/produtos/${slug}`);
  await expect(
    page.getByRole("button", { name: "Adicionar ao carrinho" }),
  ).toHaveCount(0);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await page.goto("/carrinho");
  await expect(
    page.getByRole("alert").filter({ hasText: "Algumas opções mudaram" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remover opção indisponível" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio." }),
  ).toBeVisible();
});

test("preserva as seis páginas, imagens por variante e a edição no celular", async ({
  page,
}) => {
  for (const path of [
    "bandeja-aurora",
    "organizador-arco",
    "porta-palhetas-solo",
    "porta-incenso-samurai",
    "suporte-pocket",
    "dia-dos-pais",
  ]) {
    const response = await page.goto("/" + path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Adicionar ao carrinho" }),
    ).toBeVisible();
  }
  await page.goto("/organizador-arco");
  await page.getByText("Marrom & Branco", { exact: true }).click();
  await expect(page.locator("img[data-product-color]")).toHaveAttribute(
    "src",
    "/organizador-arco-marrom-branco.png",
  );
  await page.screenshot({
    path: "test-results/product-arco-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/porta-incenso-samurai");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/product-samurai-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await loginAdmin(page);
  await page.goto("/admin/produtos");
  await page
    .getByRole("button")
    .filter({ hasText: "Organizador Arco" })
    .click();
  await page.getByRole("tab", { name: "Página e imagens" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/product-admin-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
