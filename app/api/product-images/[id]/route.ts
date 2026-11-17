import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { productImages } from "../../../../db/schema";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const [row] = await (await getDb()).select().from(productImages).where(eq(productImages.id, id));
  if (!row) return new Response(null, { status: 404 });
  return new Response(Buffer.from(row.data, "base64"), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", ETag: `"${row.contentHash}"` } });
}
