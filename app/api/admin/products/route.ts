import { revalidatePath } from "next/cache";
import { hasAdminAccess } from "../../../../lib/admin-access";
import { requestOrigin } from "../../../../lib/request-origin";
import { saveProduct } from "../../../../lib/products/save";
import { McpHttpError, readBody } from "../../../../lib/mcp/http";
export async function POST(request: Request) {
  if (!hasAdminAccess(request.headers)) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (request.headers.get("origin") !== requestOrigin(request)) return Response.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const response = await saveProduct((await readBody(request, 150_000)).toString("utf8"));
    if (response.ok) revalidatePath("/", "layout");
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof McpHttpError ? error.message : "Cadastro inválido." }, { status: error instanceof McpHttpError ? error.status : 400 });
  }
}
