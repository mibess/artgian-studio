import { handleIntegrationOrdersList } from "../../../../../lib/orders-integration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleIntegrationOrdersList(request);
}
