import { getPublicProductCatalog } from "../../../lib/products/repository";
export async function GET() {
  return Response.json(
    { products: await getPublicProductCatalog() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
