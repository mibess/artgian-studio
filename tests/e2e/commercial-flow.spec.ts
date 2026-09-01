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
