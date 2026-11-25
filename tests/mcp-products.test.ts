import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST as register } from "../app/oauth/register/route";
import { POST as token } from "../app/oauth/token/route";
import { POST as mcp, GET as mcpGet } from "../app/mcp/route";
import { POST as uploadHttp } from "../app/api/mcp/images/route";
import { POST as adminSave } from "../app/api/admin/products/route";
import { GET as imageGet } from "../app/api/product-images/[id]/route";
import { GET as discovery } from "../app/.well-known/oauth-protected-resource/mcp/route";
import { approveAuthorization, authenticate, digest, exchangeToken, MCP_SCOPES, secret } from "../lib/mcp/auth";
import { createProduct, createProductSchema, findEditableProducts, imageOwner, publishProduct, updateProduct, updateProductSchema } from "../lib/mcp/products";
import { createUploadLink } from "../lib/mcp/uploads";
import { uploadProductImage } from "../lib/products/images";
import { getDb } from "../db";
import { catalogProducts, mcpConnections, mcpCredentials, mcpProductOperations, productImages } from "../db/schema";

const origin = "https://shop.test";
let directory: string, access: string, refresh: string, clientId: string, imageId: string;
let identity: { connectionId: string; scopes: string[] };
let bytes: Buffer;
const headers = () => ({ authorization: `Bearer ${access}` });
const request = (path: string, body?: unknown) => new Request(origin + path, { method: "POST", headers: { "content-type": "application/json", ...headers() }, body: JSON.stringify(body) });
beforeAll(async () => {
  directory = await mkdtemp("/tmp/artgian-mcp-");
  process.env.DATABASE_URL = `file:${directory}/test.db`;
  process.env.MCP_PUBLIC_URL = `${origin}/mcp`;
  process.env.ADMIN_USERNAME = "artgian";
  process.env.ADMIN_PASSWORD = "test-only-password";
  bytes = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#aabbcc" } }).png().toBuffer();
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

async function connect(scopes: readonly string[] = MCP_SCOPES) {
  const response = await register(request("/oauth/register", { client_name: "IA de teste", redirect_uris: ["https://client.test/callback"] }));
  expect(response.status).toBe(201);
  const { client_id } = await response.json();
  const verifier = secret();
  const params = new URLSearchParams({ client_id, redirect_uri: "https://client.test/callback", response_type: "code", code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"), state: "opaque-state", resource: `${origin}/mcp`, scope: scopes.join(" ") });
  const callbackUrl = await approveAuthorization(params);
  if (!callbackUrl) throw new Error("Esperava a primeira autorização deste cliente");
  const callback = new URL(callbackUrl);
  expect(callback.searchParams.get("state")).toBe("opaque-state");
  const exchange = new URLSearchParams({ grant_type: "authorization_code", client_id, code: callback.searchParams.get("code")!, code_verifier: verifier, redirect_uri: "https://client.test/callback", resource: `${origin}/mcp` });
  await expect(exchangeToken(new URLSearchParams({ ...Object.fromEntries(exchange), code_verifier: "x".repeat(43) }))).rejects.toThrow("PKCE");
  const result = await token(new Request(origin + "/oauth/token", { method: "POST", body: exchange }));
  expect(result.status).toBe(200);
  const body = await result.json();
  await expect(exchangeToken(exchange)).rejects.toThrow("utilizado");
  return { clientId: client_id, access: body.access_token as string, refresh: body.refresh_token as string };
}
const product = (key: string, publish = false) => createProductSchema.parse({ idempotencyKey: key, publish, name: `Produto ${key}`, slug: key, category: "Natal", description: "Um kit com seis peças.", priceCents: 5500, imageIds: [imageId], shippingPackage: { widthCm: 20, heightCm: 8, lengthCm: 20, weightKg: 0.27 } });

describe("MCP remoto de produtos", () => {
  it("anuncia OAuth, bloqueia chamadas sem token e valida registro e PKCE", async () => {
    expect((await mcpGet(new Request(origin + "/mcp"))).status).toBe(401);
    expect((await mcpGet(new Request(origin + "/mcp"))).headers.get("WWW-Authenticate")).toContain("resource_metadata");
    expect((await discovery().json()).resource).toBe(`${origin}/mcp`);
    expect((await register(request("/oauth/register", { redirect_uris: ["javascript:alert(1)"] }))).status).toBe(400);
    ({ access, refresh, clientId } = await connect());
    identity = await authenticate(new Request(origin, { headers: headers() }));
    const rows = await (await getDb()).select().from(mcpCredentials);
    expect(rows.every(r => r.hash !== access && r.hash !== refresh)).toBe(true);
  });
  it("entrega um único retorno ao repetir o consentimento, inclusive depois da troca do código", async () => {
    const redirectUri = "http://127.0.0.1:32123/callback/teste";
    const registered = await register(request("/oauth/register", { redirect_uris: [redirectUri] }));
    const { client_id } = await registered.json();
    const verifier = secret();
    const query = new URLSearchParams({
      client_id, redirect_uri: redirectUri, resource: origin + "/mcp", response_type: "code",
      code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      state: "uma-tentativa", scope: "products:read images:write",
    });
    const reordered = new URLSearchParams(query);
    reordered.set("scope", "images:write products:read");
    const approvals = await Promise.all([approveAuthorization(query), approveAuthorization(reordered)]);
    const [callback] = approvals.filter((value): value is string => value !== null);
    expect(approvals).toContain(null);
    expect(callback).toBeTruthy();

    const db = await getDb();
    const connections = await db.select().from(mcpConnections).where(eq(mcpConnections.clientId, client_id));
    expect(connections).toHaveLength(1);
    const credentials = () => db.select().from(mcpCredentials).where(eq(mcpCredentials.connectionId, connections[0].id));
    const code = new URL(callback).searchParams.get("code")!;
    expect(await credentials()).toMatchObject([{ hash: digest(code), kind: "code" }]);
    const tokens = await exchangeToken(new URLSearchParams({
      grant_type: "authorization_code", client_id, code, code_verifier: verifier, redirect_uri: redirectUri, resource: origin + "/mcp",
    }));
    expect(await approveAuthorization(query)).toBeNull();
    expect((await credentials()).map(row => row.kind).sort()).toEqual(["access", "refresh"]);
    expect((await authenticate(new Request(origin, { headers: { authorization: "Bearer " + tokens.access_token } }))).connectionId).toBe(connections[0].id);

    const nextAttempt = new URLSearchParams(query);
    nextAttempt.set("code_challenge", createHash("sha256").update(secret()).digest("base64url"));
    expect(await approveAuthorization(nextAttempt)).toBeTruthy();
    expect(await db.select().from(mcpConnections).where(eq(mcpConnections.clientId, client_id))).toHaveLength(2);
  });
  it("usa o SDK oficial para inicializar, listar ferramentas e rejeitar imagens inventadas", async () => {
    const client = new Client({ name: "integration-test", version: "1.0.0" });
    const fetcher: typeof fetch = async (input, init) => {
      const req = new Request(input, init);
      return req.method === "POST" ? mcp(req) : mcpGet(req);
    };
    const transport = new StreamableHTTPClientTransport(new URL(origin + "/mcp"), { fetch: fetcher, requestInit: { headers: headers() } });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map(t => t.name)).toEqual(expect.arrayContaining(["create_product", "find_editable_products", "update_product"]));
    const referencePath = "/porta-palhetas-solo";
    const summary = await client.callTool({ name: "get_product_templates", arguments: { summaryOnly: true, referencePath } });
    const summaryData = summary.structuredContent as { result: { products: Array<Record<string, unknown>> } };
    expect(summaryData.result.products).toHaveLength(1);
    expect(summaryData.result.products[0]).toMatchObject({ url: referencePath, pageUrl: origin + referencePath, template: "porta-palhetas-solo" });
    expect(summaryData.result.products[0]).not.toHaveProperty("presentation");
    const reference = await client.callTool({ name: "get_product_templates", arguments: { referencePath } });
    expect(reference.structuredContent).toMatchObject({ result: { products: [{ presentation: { template: "porta-palhetas-solo", copy: { text002: { value: expect.any(String) } } } }] } });
    expect((await client.callTool({ name: "upload_product_image", arguments: { base64: "aW52YWxpZA==" } })).isError).toBe(true);
    const result = await client.callTool({ name: "upload_product_image", arguments: { base64: bytes.toString("base64") } });
    expect(result.isError).not.toBe(true);
    imageId = (result.structuredContent as { result: { imageId: string } }).result.imageId;
    const created = await createProduct({ ...product("decoracao-editavel"), name: "Decoração editável", aliases: ["Peça"] }, identity);
    const lookup = await client.callTool({ name: "find_editable_products", arguments: { query: "DECORACAO EDITAVEL" } });
    expect(lookup.structuredContent).toMatchObject({ result: { product: { id: created.id, status: "draft" } } });
    const edit = await client.callTool({ name: "update_product", arguments: { id: created.id, version: created.version, changes: { priceCents: 4800 } } });
    expect(edit.isError).not.toBe(true);
    expect((await findEditableProducts(created.id, identity)).product).toMatchObject({ priceCents: 4800, aliases: ["Peça"], status: "draft" });
    await client.close();
  });
  it("decodifica imagens, remove metadados e deduplica uploads sem aceitar HTML ou SVG", async () => {
    const again = await uploadProductImage(bytes, imageOwner(identity));
    expect(again.imageId).toBe(imageId);
    await expect(uploadProductImage(Buffer.from("<svg/>"), imageOwner(identity))).rejects.toThrow("Imagem inválida");
    const response = await imageGet(new Request(origin), { params: Promise.resolve({ id: imageId }) });
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format).toBe("webp");
    expect((await (await getDb()).select().from(productImages))).toHaveLength(1);
  });
  it("não cria nenhum produto sem imagem, nem pela API administrativa", async () => {
    expect(createProductSchema.safeParse({ ...product("no-image-key"), imageIds: [] }).success).toBe(false);
    await expect(createProduct({ ...product("missing-image"), imageIds: [crypto.randomUUID()] }, identity)).rejects.toThrow("Envie a imagem");
    const { default: seed } = await import("../content/products/kit-natalino-trico.json");
    const response = await adminSave(new Request(origin + "/api/admin/products", { method: "POST", headers: { origin, authorization: `Basic ${Buffer.from("artgian:test-only-password").toString("base64")}` }, body: JSON.stringify({ ...seed, storefront: { ...seed.storefront, listed: false, presentation: { ...seed.storefront.presentation, media: [] } } }) }));
    expect(response.status).toBe(400);
    expect((await (await getDb()).select().from(catalogProducts)).some(p => p.name === "Produto missing-image")).toBe(false);
  });
  it("bloqueia origens e corpos excessivos antes de executar ferramentas", async () => {
    expect((await mcp(new Request(origin + "/mcp", { method: "POST", headers: { ...headers(), origin: "https://evil.test" }, body: "{}" }))).status).toBe(403);
    expect((await mcp(new Request(origin + "/mcp", { method: "POST", headers: { ...headers(), "content-length": "3000001" }, body: "{}" }))).status).toBe(413);
  });
  it("cria rascunho, impede duplicação e publica na mesma fonte usada pelo carrinho", async () => {
    const input = product("natal-idempotent");
    const first = await createProduct(input, identity), second = await createProduct(input, identity);
    expect(first.id).toBe(second.id);
    await expect(createProduct({ ...input, priceCents: 6000 }, identity)).rejects.toThrow("outros dados");
    const { getProductCatalog } = await import("../lib/products/repository");
    expect((await getProductCatalog())[input.slug].active).toBe(false);
    const published = await publishProduct(first.id, first.version, identity);
    expect(published.url).toBe(`${origin}/produtos/${input.slug}`);
    const { getProductSelection } = await import("../lib/catalog");
    const catalog = await getProductCatalog();
    expect(getProductSelection({ productId: input.slug, quantity: 2 }, catalog)?.subtotalCents).toBe(11000);
    expect(catalog[input.slug].shippingPackage?.weightKg).toBe(0.27);
  });
  it("reverte a operação inteira quando o nome conflita, permitindo corrigir e repetir a chave", async () => {
    const first = product("rollback-first");
    await createProduct(first, identity);
    const collision = { ...product("rollback-second"), name: first.name };
    await expect(createProduct(collision, identity)).rejects.toThrow("Já existe");
    expect(await (await getDb()).select().from(mcpProductOperations).where(eq(mcpProductOperations.key, collision.idempotencyKey))).toHaveLength(0);
    expect((await createProduct({ ...collision, name: "Nome corrigido" }, identity)).id).toBeTruthy();
  });
  it("edita na versão atual, mantém imagens do admin e preserva a publicação", async () => {
    const created = await createProduct(product("editavel-teste"), identity);
    const adminPhoto = await uploadProductImage(bytes, "admin");
    const db = await getDb();
    const [row] = await db.select().from(catalogProducts).where(eq(catalogProducts.id, created.id));
    const store = JSON.parse(row.storefront!);
    store.presentation.media.push({ src: adminPhoto.url, alt: "Referência original do admin" });
    await db.update(catalogProducts).set({ storefront: JSON.stringify(store), version: created.version + 1 }).where(eq(catalogProducts.id, row.id));

    const lookup = await findEditableProducts("editavel-teste", identity);
    expect(lookup.product).toMatchObject({ id: created.id, status: "draft", version: created.version + 1 });
    const newBytes = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#113355" } }).png().toBuffer();
    const ownPhoto = await uploadProductImage(newBytes, imageOwner(identity));
    const changes = { priceCents: 6500, coverImageId: ownPhoto.imageId, addImageIds: [adminPhoto.imageId],
      presentation: { sections: [{ title: "Detalhe", text: "Foto de referência", image: adminPhoto.url }] } };
    await expect(updateProduct({ id: row.id, version: created.version, changes }, identity)).rejects.toThrow("versão");
    const edited = await updateProduct({ id: row.id, version: lookup.product!.version, changes }, identity);
    expect(edited).toMatchObject({ id: row.id, version: created.version + 2, active: false, listed: false, purchasable: false });
    const read = (await findEditableProducts(row.id, identity)).product!;
    expect(read.priceCents).toBe(6500);
    expect(read.presentation?.media).toEqual([
      { src: ownPhoto.url, alt: row.name }, ...store.presentation.media,
    ]);
    expect(read.presentation?.sections[0]?.image).toBe(adminPhoto.url);
    expect(read.variants).toEqual(store.variants);
    expect(read.shippingPackage).toEqual(store.shippingPackage);
    const published = await publishProduct(row.id, edited.version, identity);
    const writeOnly = { ...identity, scopes: ["products:write"] };
    await expect(updateProduct({ id: row.id, version: published.version, changes: { priceCents: 7000 } }, writeOnly)).rejects.toThrow("permissão");
    const updated = await updateProduct({ id: row.id, version: published.version, changes: { category: "Decoração" } }, identity);
    expect(updated).toMatchObject({ active: true, listed: true, purchasable: true });
    const final = (await findEditableProducts(row.id, identity)).product!;
    expect(final).toMatchObject({ category: "Decoração", status: "active", priceCents: 6500 });
    expect(final.presentation?.media).toEqual(read.presentation?.media);
  });
  it("protege as edições e buscas por conexão e recusa imagens alheias", async () => {
    const created = await createProduct(product("editavel-isolado"), identity);
    const foreign = { connectionId: crypto.randomUUID(), scopes: [...MCP_SCOPES] };
    const foreignPhoto = await uploadProductImage(bytes, imageOwner(foreign));
    expect((await findEditableProducts(created.id, foreign)).matches).toEqual([]);
    await expect(updateProduct({ ...created, changes: { name: "Produto alheio" } }, foreign)).rejects.toThrow("só pode editar");
    await expect(findEditableProducts(created.id, { ...identity, scopes: ["products:read"] })).rejects.toThrow("permissão");
    await expect(updateProduct({ ...created, changes: { coverImageId: foreignPhoto.imageId } }, identity)).rejects.toThrow("Envie a imagem");
    await expect(updateProduct({ ...created, changes: { presentation: { sections: [{ title: "", text: "", image: foreignPhoto.url }] } } }, identity)).rejects.toThrow("Envie a imagem");
    expect(updateProductSchema.safeParse({ id: created.id, version: 1, changes: { active: true } }).success).toBe(false);
    expect(updateProductSchema.safeParse({ id: created.id, version: 1, changes: { presentation: { media: [] } } }).success).toBe(false);
    expect((await findEditableProducts(created.id, identity)).product?.version).toBe(created.version);
  });
  it("cria e edita prazos confirmados, preserva omissões e permite remover a informação", async () => {
    const fulfillment = { readyToShip: true, preparationDays: 2 };
    const input = createProductSchema.parse({ ...product("fulfillment-product"), fulfillment });
    const created = await createProduct(input, identity);
    expect((await findEditableProducts(created.id, identity)).product?.fulfillment).toEqual(fulfillment);
    const { getProductCatalog } = await import("../lib/products/repository");
    expect((await getProductCatalog())[input.slug].fulfillment).toEqual(fulfillment);
    const edited = await updateProduct({ ...created, changes: { description: "Descrição revisada sem alterar o envio." } }, identity);
    expect((await findEditableProducts(created.id, identity)).product?.fulfillment).toEqual(fulfillment);
    const madeToOrder = { readyToShip: false, preparationDays: 7 };
    await expect(updateProduct({ ...created, changes: { fulfillment: madeToOrder } }, identity)).rejects.toThrow("versão");
    const changed = await updateProduct({ id: created.id, version: edited.version, changes: { fulfillment: madeToOrder } }, identity);
    expect((await findEditableProducts(created.id, identity)).product?.fulfillment).toEqual(madeToOrder);
    await updateProduct({ id: created.id, version: changed.version, changes: { fulfillment: null } }, identity);
    expect((await findEditableProducts(created.id, identity)).product?.fulfillment).toBeNull();
    expect(createProductSchema.safeParse({ ...input, fulfillment: { readyToShip: false, preparationDays: 0 } }).success).toBe(false);
    expect(updateProductSchema.safeParse({ id: created.id, version: changed.version, changes: { fulfillment: { readyToShip: true, preparationDays: -1 } } }).success).toBe(false);
  });
  it("cria, consulta e altera a ficha técnica pelo MCP", async () => {
    const details = [{ label: "Material", value: "PLA" }];
    const input = createProductSchema.parse({ ...product("ficha-tecnica"), technicalDetails: details });
    const { id, version } = await createProduct(input, identity);
    expect((await findEditableProducts(id, identity)).product?.technicalDetails).toEqual(details);

    const edited = await updateProduct({ id, version, changes: { description: "Nova descrição comercial." } }, identity);
    expect((await findEditableProducts(id, identity)).product?.technicalDetails).toEqual(details);

    const updated = [{ label: "Dimensões", value: "26 cm de altura" }];
    const changed = await updateProduct(updateProductSchema.parse({ id, version: edited.version, changes: { technicalDetails: updated } }), identity);
    expect((await findEditableProducts(id, identity)).product?.technicalDetails).toEqual(updated);
    await updateProduct({ id, version: changed.version, changes: { technicalDetails: [] } }, identity);
    expect((await findEditableProducts(id, identity)).product?.technicalDetails).toEqual([]);
  });
  it("publica diretamente somente com permissão, imagens próprias e embalagem", async () => {
    const other = await connect(["products:write", "images:write"]);
    const limited = await authenticate(new Request(origin, { headers: { authorization: `Bearer ${other.access}` } }));
    await expect(createProduct(product("no-permission", true), limited)).rejects.toThrow("permissão");
    await expect(createProduct(product("foreign-image"), limited)).rejects.toThrow("Envie a imagem");
    await expect(publishProduct((await createProduct(product("own-draft"), identity)).id, 1, { ...limited, scopes: [...MCP_SCOPES] })).rejects.toThrow("só pode publicar");
    await expect(createProduct({ ...product("no-package", true), shippingPackage: null }, identity)).rejects.toThrow("peso");
    const published = await createProduct(product("publish-direct", true), identity);
    expect(published.published).toBe(true);
  });
  it("o link permite apenas upload e deixa a foto disponível para a conexão correta", async () => {
    const link = await createUploadLink(identity), ticket = new URL(link.url).hash.slice(1);
    await expect(authenticate(new Request(origin, { headers: { authorization: `Bearer ${ticket}` } }))).rejects.toThrow("expirada");
    const response = await uploadHttp(new Request(origin + "/api/mcp/images", { method: "POST", headers: { "x-upload-token": ticket, origin }, body: new Uint8Array(bytes) }));
    expect(response.status).toBe(201);
    expect((await response.json()).imageId).toBe(imageId);
    await (await getDb()).update(mcpCredentials).set({ expiresAt: Date.now() - 1 }).where(eq(mcpCredentials.hash, digest(ticket)));
    expect((await uploadHttp(new Request(origin, { method: "POST", headers: { "x-upload-token": ticket }, body: new Uint8Array(bytes) }))).status).toBe(401);
  });
  it("rotaciona refresh tokens, vincula o recurso e revoga todos os acessos da conexão", async () => {
    const form = new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: refresh, resource: `${origin}/mcp` });
    await expect(exchangeToken(new URLSearchParams({ ...Object.fromEntries(form), resource: "https://other.test/mcp" }))).rejects.toThrow("Recurso");
    const next = await exchangeToken(form);
    await expect(exchangeToken(form)).rejects.toThrow("utilizado");
    access = next.access_token;
    await (await getDb()).update(mcpConnections).set({ revokedAt: Date.now() }).where(eq(mcpConnections.id, identity.connectionId));
    await expect(authenticate(new Request(origin, { headers: headers() }))).rejects.toThrow("revogada");
  });
});
