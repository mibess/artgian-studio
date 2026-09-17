import { expect, test } from "@playwright/test";
import { loginAdmin } from "./admin-login";

test.use({ httpCredentials: undefined });

test("login, navegação integrada, sessão e saída", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/descontos?q=TEST");
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await page.getByLabel("Usuário", { exact: true }).fill("artgian");
  await page.getByLabel("Senha", { exact: true }).fill("incorreta");
  await page.getByRole("button", { name: "Entrar no admin" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Usuário ou senha inválidos." })).toBeVisible();
  await expect(page.getByLabel("Usuário", { exact: true })).toHaveValue("artgian");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no admin" }).click();
  await expect(page).toHaveURL(/\/admin\/descontos\?q=TEST$/);
  const cookie = (await context.cookies()).find((item) => item.name === "artgian_admin_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  const menu = page.getByRole("navigation", { name: "Menu administrativo" });
  await expect(menu.getByRole("link", { name: "Descontos", exact: true })).toHaveAttribute("aria-current", "page");
  await menu.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: /Olá, Angélica/i })).toBeVisible();
  await menu.getByRole("link", { name: "Pedidos e etiquetas" }).click();
  await expect(page.getByRole("heading", { name: "Pedidos e etiquetas", exact: true })).toBeVisible();
  await menu.getByRole("link", { name: "Pedidos comerciais" }).click();
  await expect(page.getByRole("heading", { name: "Pedidos comerciais", exact: true })).toBeVisible();
  await page.reload();
  await expect(menu).toBeVisible();
  await page.goto("/comercial/pedidos?message=teste");
  await expect(page).toHaveURL(/\/admin\/pedidos-comerciais\?message=teste$/);
  await page.getByRole("button", { name: "Sair do admin" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await context.cookies()).some((item) => item.name === "artgian_admin_session")).toBe(false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
});

test("login e menu funcionam no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/login");
  await page.screenshot({ path: "test-results/admin-login-mobile.png", fullPage: true, caret: "initial" });
  await loginAdmin(page);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("navigation", { name: "Menu administrativo" }).getByRole("link", { name: "Descontos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Descontos", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu administrativo" })).not.toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/admin-descontos-mobile.png", fullPage: true, animations: "disabled" });
});

test("APIs recusam acessos sem sessão e sessões inválidas", async ({ request, context, page }) => {
  for (const path of ["/api/admin/coupons", "/api/admin/orders/missing/label"]) {
    const response = await request.post(path, { form: { action: "delete" } });
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toBeUndefined();
  }
  await context.addCookies([{ name: "artgian_admin_session", value: "invalid", url: "http://127.0.0.1:3108" }]);
  await page.goto("/admin/pedidos");
  await expect(page).toHaveURL(/\/admin\/login/);
});
