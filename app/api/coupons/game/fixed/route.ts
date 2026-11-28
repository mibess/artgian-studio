import { issueGameCoupon } from "../issue";

export const runtime = "nodejs";

export function POST(request: Request) {
  return issueGameCoupon(request, "fixed");
}
