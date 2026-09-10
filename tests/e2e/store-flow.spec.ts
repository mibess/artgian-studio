import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("cart persists variants, synchronizes tabs and checks out all products", async ({
  page,
  context,
}) => {
  await page.goto("/organizador-arco");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.goto("/porta-palhetas-solo");
  await page.getByRole("textbox", { name: "Nome na peça" }).fill("Ana");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.getByRole("textbox", { name: "Nome na peça" }).fill("Bia");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.goto("/carrinho");
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Carrinho, 4 itens" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(3);
  const second = await context.newPage();
  await second.goto("/carrinho");
  await page
    .getByRole("button", { name: "Aumentar quantidade de Organizador" })
    .click();
  await expect(
    second.getByRole("link", { name: "Carrinho, 5 itens" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Remover Porta-Palhetas Solo, Terracota, Ana",
      exact: true,
    })
    .click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("link", { name: "Finalizar compra" }).click();
  await expect(page.locator("aside")).toContainText("Organizador Arco");
  await expect(page.locator("aside")).toContainText("Porta-Palhetas Solo");
  await expect(page.locator("aside")).toContainText("Bia");
  await page.getByLabel("CEP").fill("01001000");
  await page.route("**/api/shipping/quote", async (route) => {
    expect(route.request().postDataJSON().items).toHaveLength(2);
    await route.fulfill({
      json: {
        postalCode: "01001000",
        options: [
          {
            serviceId: "1",
            serviceName: "PAC",
            companyName: "Correios",
            companyId: "1",
            priceCents: 1500,
            deliveryTimeDays: 5,
            volumes: [],
          },
        ],
      },
    });
  });
  await page.getByRole("button", { name: /Calcular/ }).click();
  await expect(
    page.getByRole("button", { name: "Pagar com Mercado Pago" }),
  ).toBeEnabled();
  await page.getByLabel("CEP").fill("02002000");
  await expect(
    page.getByRole("button", { name: "Calcule a entrega para continuar" }),
  ).toBeDisabled();
  await second.close();
});

test("registration, session persistence, logout and protected account", async ({
  page,
}) => {
  const email = `store-e2e-${Date.now()}@example.com`;
  await page.goto("/conta");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByRole("button", { name: "Continuar com Google" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome completo").fill("Cliente Teste");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("StoreTest!12345");
  await page.getByLabel("Confirmar senha").fill("different123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "As senhas não coincidem.",
  );
  await page.getByLabel("Confirmar senha").fill("StoreTest!12345");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/login\/verificar/);
  let mail: { url: string } | undefined;
  await expect
    .poll(async () => {
      const lines = await readFile("data/e2e-auth-emails.jsonl", "utf8").catch(
        () => "",
      );
      mail = lines
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .findLast((m) => m.to === email && m.kind === "verification");
      return Boolean(mail);
    })
    .toBe(true);
  await page.goto(mail!.url);
  await expect(
    page.getByRole("heading", { name: "E-mail confirmado." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Entrar na minha conta", exact: true })
    .click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("StoreTest!12345");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await expect(
    page.getByRole("heading", { name: "Olá, Cliente." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Olá, Cliente." }),
  ).toBeVisible();
  const cookies = await page.context().cookies();
  expect(
    cookies.find((cookie) => cookie.name.includes("session_token"))?.httpOnly,
  ).toBe(true);
  await page.goto(
    "/comprar?produto=organizador-arco&cor=rosa-marfim&quantidade=1",
  );
  await expect(page.getByLabel("Nome completo")).toHaveValue("Cliente Teste");
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(email);
  await page.goto("/conta");
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/conta");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "E-mail ou senha incorretos",
  );
  await page.getByLabel("Senha", { exact: true }).fill("StoreTest!12345");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page).toHaveURL(/\/conta$/);
});

test("invalid saved carts recover and mobile pages have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/carrinho");
  await page.evaluate(() =>
    localStorage.setItem("artgian:cart:v1", "{invalid-json"),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio." }),
  ).toBeVisible();
  for (const path of [
    "/carrinho",
    "/login",
    "/login/recuperar",
    "/login/verificar",
    "/login/redefinir",
    "/organizador-arco",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("authentication rejects foreign origins and invalid OAuth callbacks", async ({
  request,
}) => {
  const rejected = await request.post("/api/auth/sign-up/email", {
    headers: { origin: "https://evil.example" },
    data: {
      name: "Test",
      email: "csrf@example.com",
      password: "StoreTest!12345",
    },
  });
  expect(rejected.status()).toBe(403);
  const callback = await request.get(
    "/api/auth/callback/google?code=forged&state=forged",
    { maxRedirects: 0 },
  );
  expect([302, 303, 400]).toContain(callback.status());
});

test("password recovery accepts the emailed link once and logs in with the new password", async ({
  page,
}) => {
  const email = `reset-e2e-${Date.now()}@example.com`;
  await page.goto("/login");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome completo").fill("Cliente Recuperação");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("OriginalTest!123");
  await page.getByLabel("Confirmar senha").fill("OriginalTest!123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/login\/verificar/);
  async function messageUrl(kind: string) {
    let url = "";
    await expect
      .poll(async () => {
        const lines = await readFile(
          "data/e2e-auth-emails.jsonl",
          "utf8",
        ).catch(() => "");
        url =
          lines
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line))
            .findLast((m) => m.to === email && m.kind === kind)?.url || "";
        return Boolean(url);
      })
      .toBe(true);
    return url;
  }
  await page.goto(await messageUrl("verification"));
  await page.goto("/login/recuperar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.getByRole("status")).toContainText("Se houver uma conta");
  await page.goto(await messageUrl("reset"));
  const resetUrl = page.url();
  await page.getByLabel("Nova senha", { exact: true }).fill("ResetTest!12345");
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("mismatch123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "As senhas" }),
  ).toBeVisible();
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("ResetTest!12345");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Sua senha foi alterada",
  );
  await expect(page).toHaveURL(/\/login\/redefinir$/);
  await page.getByRole("link", { name: "Entrar com a nova senha" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("ResetTest!12345");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await page.goto(resetUrl);
  await page.getByLabel("Nova senha", { exact: true }).fill("ReusedTest!12345");
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("ReusedTest!12345");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("link", { name: "Solicitar novo link" }),
  ).toBeVisible();
});
