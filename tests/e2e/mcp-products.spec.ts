import { test, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { loginAdmin } from "./admin-login";

test("instalador público abre o Codex e permite copiar o endereço no celular", async ({ page, context, request, baseURL }) => {
  const endpoint = new URL("/mcp", baseURL).href;
  const discovery = await request.get(endpoint, { maxRedirects: 0 });
  expect(discovery.status()).toBe(401);
  expect(discovery.headers()["www-authenticate"]).toContain(`resource_metadata="${new URL("/.well-known/oauth-protected-resource/mcp", baseURL).href}"`);
  const htmlRequest = await request.get(endpoint, { headers: { accept: "text/html" }, maxRedirects: 0 });
  expect(htmlRequest.status()).toBe(401);
  const bearerRequest = await request.get(endpoint, {
    headers: { accept: "text/html", "sec-fetch-mode": "navigate", authorization: "Bearer expired" },
    maxRedirects: 0,
  });
  expect(bearerRequest.status()).toBe(401);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(endpoint).origin });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mcp");
  await expect(page).toHaveURL(/\/mcp\/instalar$/);
  await expect(page.getByRole("heading", { name: "Conectar o Codex à Artgian" })).toBeVisible();
  const launch = page.getByRole("link", { name: "Abrir no Codex" });
  await expect(launch).toHaveAttribute("href", /^codex:\/\/new\?prompt=/);
  const prompt = new URL((await launch.getAttribute("href"))!).searchParams.get("prompt");
  expect(prompt).toContain(endpoint);
  await expect(page.locator("main")).toContainText(/computador (?:onde|em que)|mesmo computador/i);
  await page.getByRole("button", { name: "Copiar mensagem", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);

  await page.getByText("O navegador parou em 127.0.0.1 após autorizar?", { exact: true }).click();
  await page.getByRole("button", { name: "Copiar comando de recuperação" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("codex mcp login artgian --no-browser");

  await page.getByText("Conectar manualmente ou usar outro aplicativo", { exact: true }).click();
  const copyUrl = page.getByRole("button", { name: "Copiar URL", exact: true });
  await expect(copyUrl).toBeVisible();
  await expect(page.getByText(endpoint, { exact: true })).toBeVisible();
  await copyUrl.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(endpoint);
  await page.getByText("Usar o terminal do Codex", { exact: true }).click();
  await expect(page.getByText(`codex mcp add artgian --url ${endpoint}`, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("painel de conexões exige login e oferece o instalador público", async ({ page }) => {
  await page.goto("/admin/mcp");
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
  await loginAdmin(page);
  await page.goto("/admin/produtos");
  await page.locator('a[href="/admin/mcp"]').click();
  await expect(page).toHaveURL(/\/admin\/mcp$/);
  await page.getByRole("link", { name: "Abrir instalação" }).click();
  await expect(page).toHaveURL(/\/mcp\/instalar$/);
  await expect(page.getByRole("heading", { name: "Conectar o Codex à Artgian" })).toBeVisible();
});

test("instalação da skill aponta para arquivos públicos e funciona com o MCP já conectado", async ({ page, request, baseURL }) => {
  await page.goto("/mcp/instalar#edicao");
  const entrypoint = new URL("/skills/artgian-editar-produto/SKILL.md", baseURL);
  const metadata = new URL("agents/openai.yaml", entrypoint);
  const source = await page.getByRole("link", { name: "Ler instruções da skill" }).getAttribute("href");
  expect(source).toBe(entrypoint.href);

  for (const button of ["Instalar skill de edição", "Abrir no Codex"]) {
    const launch = await page.getByRole("link", { name: button, exact: true }).getAttribute("href");
    const prompt = new URL(launch!).searchParams.get("prompt");
    expect(prompt).toContain(entrypoint.href);
    expect(prompt).toContain(metadata.href);
  }
  for (const file of [entrypoint, metadata]) {
    const response = await request.get(file.href);
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe(readFileSync(`public${file.pathname}`, "utf8"));
  }
});

test("conecta IA pelo admin, exige foto, publica e permite revogar o acesso", async ({ page, request }) => {
  const origin = "http://127.0.0.1:3108";
  const clientName = `Minha IA E2E ${Date.now()}`;
  const registration = await request.post("/oauth/register", { data: { client_name: clientName, redirect_uris: ["http://127.0.0.1:3108/oauth/test-callback"] } });
  expect(registration.status()).toBe(201);
  const { client_id } = await registration.json();
  const verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({ client_id, redirect_uri: `${origin}/oauth/test-callback`, response_type: "code", resource: `${origin}/mcp`, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"), scope: "products:read images:write products:write products:publish", state: "e2e" });
  await page.route("**/oauth/test-callback?*", route => route.fulfill({ status: 200, body: "Conexão autorizada." }));
  await page.goto(`/oauth/authorize?${params}`);
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
  await page.getByLabel("Usuário", { exact: true }).fill("artgian");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no admin" }).click();
  await expect(page.getByRole("heading", { name: "Conectar sua IA à loja" })).toBeVisible();
  await expect(page.getByText(clientName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Autorizar conexão" }).click();
  await page.waitForURL("**/oauth/test-callback?*");
  const code = new URL(page.url()).searchParams.get("code")!;
  await page.goto("/admin/mcp");
  const connection = page.getByRole("article").filter({ hasText: clientName });
  await expect(connection).toContainText("Aguardando o aplicativo");
  const exchanged = await request.post("/oauth/token", { form: { grant_type: "authorization_code", client_id, code, code_verifier: verifier, redirect_uri: `${origin}/oauth/test-callback`, resource: `${origin}/mcp` } });
  expect(exchanged.status()).toBe(200);
  await page.getByRole("button", { name: "Atualizar estado" }).click();
  await expect(connection).toContainText("Autorizada");
  // Reopening a spent consent request must not send another code to the closed callback port.
  await page.goto(`/oauth/authorize?${params}`);
  await page.getByRole("button", { name: "Autorizar conexão" }).click();
  await expect(page).toHaveURL(/\/admin\/mcp\?resultado=ja-aprovado#conexoes$/);
  await expect(page.getByRole("status").filter({ hasText: "Você já aprovou este pedido" })).toBeVisible();
  await expect(connection).toHaveCount(1);
  await expect(connection).toContainText("Autorizada");
  const { access_token } = await exchanged.json();
  const headers = { authorization: `Bearer ${access_token}`, accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25" };
  const call = async (name: string, args: unknown) => {
    const response = await request.post("/mcp", { headers, data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } } });
    expect(response.status()).toBe(200);
    return (await response.json()).result;
  };
  const link = await call("create_upload_link", {});
  await page.goto(link.structuredContent.result.url);
  await page.getByLabel("Foto do produto").setInputFiles({ name: "produto.png", mimeType: "image/png", buffer: readFileSync("public/kit-natalino-trico-capa.png") });
  await page.getByRole("button", { name: "Enviar imagem", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Foto recebida");
  const uploaded = await call("list_uploaded_images", {});
  const imageId = uploaded.structuredContent.result[0].imageId;
  const suffix = Date.now();
  const input = { idempotencyKey: `e2e-product-${suffix}`, publish: false, name: `Produto MCP ${suffix}`, slug: `produto-mcp-${suffix}`, category: "Natal", description: "Kit natalino com seis peças.", priceCents: 5500, imageIds: [], shippingPackage: { widthCm: 20, heightCm: 8, lengthCm: 20, weightKg: 0.27 } };
  expect((await call("create_product", input)).isError).toBe(true);
  const saved = await call("create_product", { ...input, imageIds: [imageId] });
  expect(saved.isError).not.toBe(true);
  expect((await call("create_product", { ...input, imageIds: [imageId] })).structuredContent.result.id).toBe(saved.structuredContent.result.id);
  await page.goto("/admin/produtos");
  const productEntry = page.getByRole("button").filter({ hasText: input.name });
  await expect(productEntry).toContainText("Rascunho");
  await productEntry.click();
  const publicPage = page.getByRole("link", { name: "Ver página" });
  await expect(publicPage).toHaveCount(0);
  await page.getByLabel("Descrição do produto").fill("Kit com seis peças para o Natal.");
  const saveProduct = page.getByRole("button", { name: "Salvar produto", exact: true });
  await saveProduct.click();
  await expect(page.getByRole("status")).toContainText("Produto salvo");
  await page.reload();
  await expect(productEntry).toContainText("Rascunho");
  const published = await call("publish_product", { id: saved.structuredContent.result.id, version: saved.structuredContent.result.version + 1 });
  expect(published.isError).not.toBe(true);
  await page.goto(published.structuredContent.result.url);
  await expect(page.getByRole("heading", { name: input.name })).toBeVisible();
  await expect(page.getByText("R$ 55,00", { exact: true })).toBeVisible();
  await expect(page.locator(`img[src="/api/product-images/${imageId}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await page.goto("/carrinho");
  await expect(page.getByRole("article")).toContainText(input.name);
  await page.goto("/admin/produtos");
  await productEntry.click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(input.name);
  await expect(publicPage).toBeVisible();
  await page.getByLabel("Produto ativo").uncheck();
  await saveProduct.click();
  await expect(productEntry).toContainText("Arquivado");
  await expect(productEntry).not.toContainText("Atendimento");
  await expect(publicPage).toHaveCount(0);
  await page.reload();
  await expect(productEntry).toContainText("Arquivado");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/mcp");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mcp-connections-mobile.png", fullPage: true });
  await connection.getByRole("button", { name: "Revogar acesso" }).click();
  await expect(connection).toContainText("Revogada");
  expect((await request.post("/mcp", { headers, data: { jsonrpc: "2.0", id: 2, method: "tools/list" } })).status()).toBe(401);
});

test("admin faz upload sem depender de arquivo no código", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/produtos");
  await page.getByRole("button", { name: "+ Novo produto", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill(`Foto Admin ${Date.now()}`);
  await page.getByLabel("Criar página na loja").check();
  await page.getByRole("tab", { name: "Página e imagens" }).click();
  await page.getByLabel("Enviar imagem do produto (obrigatória para cadastrar)").setInputFiles({ name: "produto.png", mimeType: "image/png", buffer: readFileSync("public/kit-natalino-trico-capa.png") });
  await expect(page.getByRole("status")).toContainText("Imagem enviada");
  await expect(page.getByLabel("Imagem 1 (URL)", { exact: true })).toHaveValue(/\/api\/product-images\//);
});
