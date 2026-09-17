import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const product = JSON.parse(readFileSync("content/products/kit-natalino-trico.json", "utf8"));

test("kit natalino segue o modelo da loja e pode entrar no carrinho", async ({ page, request }) => {
  const response = await request.post("/api/admin/products", {
    headers: {
      origin: "http://127.0.0.1:3108",
      authorization: `Basic ${Buffer.from("artgian:teste-local").toString("base64")}`,
    },
    data: product,
  });
  expect(response.status()).toBe(200);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/produtos/kit-natalino-trico");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kit Natalino");
  await expect(page.getByText("R$ 55,00", { exact: true })).toBeVisible();
  await expect(page.getByText(/Bandeja de 18 × 18 × 2 cm/)).toBeVisible();
  await expect(page.getByText(/Embalagem: 20 × 20 × 8 cm/)).toBeVisible();
  expect(await page.locator("img[data-product-color]").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: "test-results/kit-natalino-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await page.goto("/carrinho");
  await expect(page.getByRole("article")).toContainText("Kit Natalino Tricô - 6 Peças");
  await expect(page.getByRole("article")).toContainText("R$ 55,00");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/produtos/kit-natalino-trico");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/kit-natalino-mobile.png", fullPage: true });
  await page.goto("/produtos");
  await expect(page.getByRole("link").filter({ hasText: "Kit Natalino Tricô" })).toBeVisible();
});
