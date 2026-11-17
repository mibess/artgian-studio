import "server-only";
import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { realpath, readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { productImages } from "../../db/schema";
import { McpHttpError } from "../mcp/http";
import type { ProductInput } from "./schema";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const imagePath = (id: string) => `/api/product-images/${id}`;
export async function uploadProductImage(bytes: Buffer, owner: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new McpHttpError("Envie uma imagem PNG, JPEG ou WebP de até 2 MB.", 413);
  let output;
  try {
    const source = sharp(bytes, { limitInputPixels: 24_000_000, animated: false });
    const meta = await source.metadata();
    if (!["png", "jpeg", "webp"].includes(meta.format || "") || (meta.pages || 1) > 1 || !meta.width || !meta.height || meta.width < 100 || meta.height < 100) throw new Error("Formato inválido");
    output = await source.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
  } catch { throw new McpHttpError("Imagem inválida. Use PNG, JPEG ou WebP estático com pelo menos 100 × 100 pixels."); }
  if (output.data.length > 1_500_000) throw new McpHttpError("Imagem muito complexa. Envie uma versão menor.", 413);
  const db = await getDb();
  const hash = createHash("sha256").update(output.data).digest("hex");
  await db.insert(productImages).values({ id: randomUUID(), owner, contentHash: hash, data: output.data.toString("base64"), width: output.info.width, height: output.info.height, createdAt: Date.now() }).onConflictDoNothing();
  const [row] = await db.select({ id: productImages.id, width: productImages.width, height: productImages.height }).from(productImages).where(and(eq(productImages.owner, owner), eq(productImages.contentHash, hash)));
  return { imageId: row.id, url: imagePath(row.id), width: row.width, height: row.height };
}
export async function ownedImage(id: string, owner: string) {
  const [row] = await (await getDb()).select({ id: productImages.id }).from(productImages).where(and(eq(productImages.id, id), eq(productImages.owner, owner)));
  if (!row) throw new McpHttpError("Envie a imagem por esta conexão antes de cadastrar o produto.");
  return imagePath(row.id);
}
export async function validateProductImages(p: ProductInput) {
  const media = p.storefront?.presentation.media || [];
  if ((!p.id || p.storefront) && !media[0]?.src) throw new McpHttpError("Imagem obrigatória. Envie uma imagem antes de cadastrar o produto.");
  const sources = [...media.map(m => m.src), ...(p.storefront?.variants.map(v => v.image).filter(Boolean) || []), ...(p.storefront?.presentation.sections.map(s => s.image).filter(Boolean) || [])];
  for (const src of new Set(sources)) {
    const match = /^\/api\/product-images\/([a-f0-9-]{36})$/.exec(src);
    if (match) {
      const [image] = await (await getDb()).select({ id: productImages.id }).from(productImages).where(eq(productImages.id, match[1]));
      if (!image) throw new McpHttpError("A imagem enviada não está disponível.");
    } else if (/^\/(?!\/)[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(src)) {
      try {
        const root = await realpath(path.join(process.cwd(), "public"));
        const target = await realpath(path.join(root, src.slice(1)));
        if (!target.startsWith(root + path.sep)) throw new Error("Caminho inválido");
        const meta = await sharp(await readFile(target), { limitInputPixels: 40_000_000 }).metadata();
        if (!meta.width || !meta.height) throw new Error("Imagem inválida");
      } catch { throw new McpHttpError("Imagem da loja inexistente ou inválida. Envie o arquivo pelo upload."); }
    } else throw new McpHttpError("Envie o arquivo de imagem pelo upload da loja; links externos não são aceitos.");
  }
}
