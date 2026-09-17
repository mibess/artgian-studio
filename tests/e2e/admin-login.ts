import { expect, type Page } from "@playwright/test";

export async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Usuário", { exact: true }).fill("artgian");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
