import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { productInputSchema } from "../lib/products/schema";

// Uses the regular admin endpoint: validation, conflict protection and auditing
// remain the same as products created through the admin interface.
const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = option("file") || "content/products/kit-natalino-trico.json";
const product = productInputSchema.parse(JSON.parse(readFileSync(file, "utf8")));
if (product.id || product.version !== 0)
  throw new Error("Este importador aceita apenas novos produtos, sem sobrescrever cadastros.");
if (!process.argv.includes("--apply")) {
  console.log(`Cadastro válido: ${product.name}, R$ ${(product.basePriceCents! / 100).toFixed(2)}. Nenhuma alteração realizada.`);
  console.log("Para cadastrar: --apply --url=https://sua-loja --env=/caminho/credenciais.env");
} else {
  const url = option("url");
  const envFile = option("env");
  if (!url || !envFile) throw new Error("Informe --url e --env para cadastrar.");
  const base = new URL(url);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)))
    throw new Error("Use HTTPS, exceto em localhost.");
  const env = parseEnv(readFileSync(envFile, "utf8"));
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD)
    throw new Error("Credenciais ADMIN_USERNAME e ADMIN_PASSWORD ausentes.");
  const response = await fetch(new URL("/api/admin/products", base), {
    method: "POST",
    redirect: "error",
    headers: {
      origin: base.origin,
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(`${env.ADMIN_USERNAME}:${env.ADMIN_PASSWORD}`).toString("base64")}`,
    },
    body: JSON.stringify(product),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Falha ao cadastrar (${response.status}).`);
  console.log(JSON.stringify(result));
  console.log(new URL(`/produtos/${product.storefront!.slug}`, base).href);
}
