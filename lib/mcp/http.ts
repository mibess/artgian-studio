import { z } from "zod";

export class McpHttpError extends Error {
  constructor(message: string, public status = 400, public code = "invalid_request") { super(message); }
}
export function mcpOrigin() {
  const url = new URL(process.env.MCP_PUBLIC_URL || "https://www.artgian.com.br/mcp");
  if (url.pathname !== "/mcp" || url.search || url.hash || url.username || url.password ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
    throw new Error("MCP_PUBLIC_URL deve ser a URL pública HTTPS terminada em /mcp.");
  return url.origin;
}
export const resourceUrl = () => `${mcpOrigin()}/mcp`;
export async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit) throw new McpHttpError("Arquivo ou pedido excede o limite.", 413);
  const reader = request.body?.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) { await reader.cancel(); throw new McpHttpError("Arquivo ou pedido excede o limite.", 413); }
        parts.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  return Buffer.concat(parts);
}
export function errorResponse(error: unknown) {
  if (error instanceof McpHttpError) return Response.json({ error: error.code, error_description: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "invalid_request", error_description: "Dados inválidos. Confira os campos obrigatórios." }, { status: 400 });
  console.error("Falha na integração de produtos", error instanceof Error ? error.message : "Erro interno");
  return Response.json({ error: "server_error", error_description: "Não foi possível concluir a operação." }, { status: 500 });
}
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Session-Id, MCP-Protocol-Version",
};
export function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}
