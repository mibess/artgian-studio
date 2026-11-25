import { expect, test } from "@playwright/test";
import { loginAdmin } from "./admin-login";

test("admin salva medidas de frete com vírgula e ponto", async ({ page }) => {
  const name = `Embalagem decimal ${Date.now()}`;
  await loginAdmin(page);
  await page.goto("/admin/produtos");
  await page.getByRole("button", { name: "+ Novo produto", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByLabel("Criar página na loja").check();
  await page.getByLabel("Endereço do produto").fill(name.toLowerCase().replaceAll(" ", "-"));
  await page.getByLabel("Embalagem de envio cadastrada").check();

  const length = page.getByLabel("Comprimento (cm)", { exact: true });
  const height = page.getByLabel("Altura (cm)", { exact: true });
  const weight = page.getByLabel("Peso total (kg)", { exact: true });
  await length.clear();
  await length.pressSequentially("12,");
  await expect(length).toHaveValue("12,");
  await length.pressSequentially("5");
  await weight.clear();
  await weight.pressSequentially("0.");
  await expect(weight).toHaveValue("0.");
  await weight.pressSequentially("35");

  const save = page.getByRole("button", { name: "Salvar produto" });
  await height.clear();
  await save.click();
  await expect(page.getByRole("alert").filter({ hasText: "Altura (cm)" })).toBeVisible();
  await height.fill("4,2");
  await page.getByRole("tab", { name: "Página e imagens" }).click();
  await page.getByRole("button", { name: "Adicionar imagem", exact: true }).click();
  await page.getByLabel("Imagem 1 (URL)", { exact: true }).fill("/kit-natalino-trico-capa.png");
  await save.click();
  await expect(page.getByRole("status").filter({ hasText: "Produto salvo" })).toBeVisible();

  await page.reload();
  await page.getByRole("button").filter({ hasText: name }).click();
  await expect(length).toHaveValue("12,5");
  await expect(height).toHaveValue("4,2");
  await expect(weight).toHaveValue("0,35");
  await expect(page.getByLabel("Largura (cm)", { exact: true })).toHaveValue("1");
});
