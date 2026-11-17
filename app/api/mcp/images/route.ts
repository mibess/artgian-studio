import { authenticate, rateLimit, requireScope } from "../../../../lib/mcp/auth";
import { uploadIdentity } from "../../../../lib/mcp/uploads";
import { imageOwner } from "../../../../lib/mcp/products";
import { errorResponse, McpHttpError, mcpOrigin, readBody } from "../../../../lib/mcp/http";
import { MAX_IMAGE_BYTES, uploadProductImage } from "../../../../lib/products/images";
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== mcpOrigin()) throw new McpHttpError("Origem inválida.", 403);
    const ticket = request.headers.get("x-upload-token");
    const identity = ticket ? await uploadIdentity(ticket) : await authenticate(request);
    requireScope(identity, "images:write");
    await rateLimit(`image:${identity.connectionId}`, 30);
    return Response.json(await uploadProductImage(await readBody(request, MAX_IMAGE_BYTES), imageOwner(identity)), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
