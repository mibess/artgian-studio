import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";

test("admin creates, edits, searches and deletes a coupon", async ({
  page,
}) => {
  const code = `E2E-${Date.now()}`;
  await page.goto("/admin/descontos");
  const create = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Novo cupom" }) });
  await create.getByLabel("Código", { exact: true }).fill(code);
  await create.getByLabel("Valor (% ou R$)", { exact: true }).fill("20");
  await create.getByLabel("Reutilizável", { exact: true }).check();
  await create.getByLabel("Limite total de usos, se reutilizável").fill("5");
  await create.getByRole("button", { name: "Criar cupom" }).click();
  await expect(page.getByRole("status")).toContainText("Cupom salvo");
  const row = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: code, exact: true }) });
  await expect(row).toContainText("20%");
  await expect(row).toContainText("0 / 5 usos");
  await row.getByText("Editar cupom", { exact: true }).click();
  await row.getByLabel("Valor (% ou R$)", { exact: true }).fill("30");
  await row.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(row).toContainText("30%");
  await page.getByLabel("Buscar código").fill(code);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Descontos", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/coupons-admin-mobile.png",
    fullPage: true,
  });
  await row.getByText("Excluir cupom", { exact: true }).click();
  await row
    .getByRole("button", { name: `Confirmar exclusão de ${code}` })
    .click();
  await expect(page.getByRole("status")).toContainText("Cupom excluído");
  await expect(
    page.getByRole("heading", { name: code, exact: true }),
  ).toHaveCount(0);
});

test("authenticated customer applies and removes a real coupon in checkout", async ({
  page,
}) => {
  const origin = "http://127.0.0.1:3108";
  const stamp = Date.now();
  const email = `coupon-${stamp}@example.com`;
  const code = `CHECKOUT-${stamp}`;
  const registration = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { name: "Cliente Cupom", email, password: "CouponTest!12345" },
  });
  expect(registration.ok()).toBe(true);
  const client = createClient({ url: process.env.E2E_DATABASE_URL! });
  await client.execute({
    sql: "update store_user set email_verified = 1 where email = ?",
    args: [email],
  });
  const login = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin },
    data: { email, password: "CouponTest!12345" },
  });
  expect(login.ok()).toBe(true);
  const created = await page.request.post("/api/admin/coupons", {
    headers: { origin },
    form: {
      action: "create",
      code,
      kind: "percent",
      value: "20",
      active: "on",
      minSubtotal: "0",
      expiresAt: "2099-01-01T10:00",
    },
  });
  expect(created.ok()).toBe(true);
  await page.goto(
    "/comprar?produto=organizador-arco&cor=rosa-marfim&quantidade=2",
  );
  await page.getByLabel("Código do cupom").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Aplicar cupom" }).click();
  await expect(page.getByRole("status")).toContainText("21,96");
  await expect(page.getByRole("status")).not.toContainText("Válido até");
  await expect(page.locator("aside")).toContainText(`Desconto · ${code}`);
  const usage = await client.execute({
    sql: "select allocated_uses from coupons where code = ?",
    args: [code],
  });
  expect(usage.rows[0].allocated_uses).toBe(0);
  await page.screenshot({
    path: "test-results/coupons-checkout.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Remover cupom" }).click();
  await expect(page.locator("aside")).not.toContainText("Desconto ·");
  await page.getByLabel("Código do cupom").fill("INEXISTENTE");
  await page.getByRole("button", { name: "Aplicar cupom" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "inválido",
  );
  await page.request.post("/api/admin/coupons", {
    headers: { origin },
    form: {
      action: "delete",
      id: String(
        (
          await client.execute({
            sql: "select id from coupons where code = ?",
            args: [code],
          })
        ).rows[0].id,
      ),
    },
  });
  client.close();
});
