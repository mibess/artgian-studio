import { hasAdminAccess } from "../../../../../lib/admin-access";
import { requestOrigin } from "../../../../../lib/request-origin";
import { MAX_IMAGE_BYTES, uploadProductImage } from "../../../../../lib/products/images";
import { errorResponse, readBody } from "../../../../../lib/mcp/http";
export async function POST(request: Request) {
  if (!hasAdminAccess(request.headers)) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (request.headers.get("origin") !== requestOrigin(request)) return Response.json({ error: "Origem inválida." }, { status: 403 });
  try { return Response.json(await uploadProductImage(await readBody(request, MAX_IMAGE_BYTES), "admin"), { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
