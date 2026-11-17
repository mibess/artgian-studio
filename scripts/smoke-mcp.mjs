import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Explicit invocation only. Test access expires in five minutes and is revoked
// in finally. It can read templates and upload, but cannot create/publish products.
if (!process.argv.includes("--run")) throw new Error("Use --run com credenciais temporárias no ambiente.");
const base = "https://www.artgian.com.br";
const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;
if (url !== "libsql://artgian-prod-mibess.aws-us-east-2.turso.io" || !authToken) throw new Error("Informe a conexão temporária do banco de produção.");
const db = createClient({ url, authToken });
const clientId = randomUUID(), connectionId = randomUUID(), access = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(access).digest("hex");
const client = new Client({ name: "artgian-deployment-smoke", version: "1.0.0" });
let created = false;
try {
  const unauthorized = await fetch(`${base}/mcp`, { redirect: "error" });
  if (unauthorized.status !== 401 || !unauthorized.headers.get("www-authenticate")?.includes("resource_metadata")) throw new Error("MCP sem proteção OAuth esperada.");
  const metadata = await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).json();
  if (metadata.resource !== `${base}/mcp` || metadata.authorization_servers?.[0] !== base) throw new Error("Discovery de recurso inválido.");
  const authorization = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
  if (authorization.issuer !== base || !authorization.code_challenge_methods_supported?.includes("S256")) throw new Error("Discovery OAuth inválido.");
  await db.batch([
    { sql: "INSERT INTO mcp_clients (id,name,redirect_uris,created_at) VALUES (?,?,?,?)", args: [clientId, "Verificação da implantação (acesso temporário)", "[]", Date.now()] },
    { sql: "INSERT INTO mcp_connections (id,client_id,scopes,created_at) VALUES (?,?,?,?)", args: [connectionId, clientId, "products:read images:write", Date.now()] },
    { sql: "INSERT INTO mcp_credentials (hash,kind,connection_id,details,expires_at) VALUES (?,?,?,?,?)", args: [tokenHash, "access", connectionId, JSON.stringify({ resource: `${base}/mcp` }), Date.now() + 300_000] },
  ], "write");
  created = true;
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${access}` } } }));
  const listed = await client.listTools();
  for (const name of ["upload_product_image", "create_product", "publish_product", "get_product_templates", "create_upload_link", "list_uploaded_images", "find_editable_products", "update_product"])
    if (!listed.tools.some(t => t.name === name)) throw new Error(`Ferramenta ausente: ${name}`);
  const templates = await client.callTool({ name: "get_product_templates", arguments: {} });
  if (templates.isError) throw new Error("Falha ao consultar o catálogo.");
  const image = await client.callTool({ name: "upload_product_image", arguments: { base64: (await readFile("public/kit-natalino-trico-referencia.png")).toString("base64") } });
  if (image.isError) throw new Error("Falha no upload real de imagem.");
  const saved = image.structuredContent?.result;
  const photo = await fetch(new URL(saved.url, base));
  if (photo.status !== 200 || photo.headers.get("content-type") !== "image/webp" || !(await photo.arrayBuffer()).byteLength) throw new Error("Imagem enviada indisponível.");
  const noImage = await client.callTool({ name: "create_product", arguments: { idempotencyKey: "deployment-smoke-no-product", publish: true, name: "Teste não cadastrado", slug: "teste-nao-cadastrado", category: "Teste", description: "Esta operação deve falhar.", priceCents: 5500, imageIds: [], shippingPackage: null } });
  if (!noImage.isError) throw new Error("Cadastro sem imagem deveria ser rejeitado.");
  console.log(JSON.stringify({ oauthDiscovery: true, authenticationRequired: true, officialSdkConnected: true, tools: listed.tools.length, templates: true, imageUpload: true, imageAvailable: true, noImageRejected: true, productCreated: false, imageId: saved.imageId }));
} finally {
  await client.close().catch(() => {});
  if (created) await db.batch([
    { sql: "UPDATE mcp_connections SET revoked_at=? WHERE id=?", args: [Date.now(), connectionId] },
    { sql: "DELETE FROM mcp_credentials WHERE connection_id=?", args: [connectionId] },
  ], "write");
  db.close();
}
