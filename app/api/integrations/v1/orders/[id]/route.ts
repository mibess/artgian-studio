import { handleIntegrationOrderDetail } from "../../../../../../lib/orders-integration";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleIntegrationOrderDetail(request, context);
}
