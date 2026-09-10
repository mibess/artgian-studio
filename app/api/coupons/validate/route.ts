import { requestOrigin } from "../../../../lib/request-origin";
import { getDb } from "../../../../db";
import { getCustomerSession } from "../../../../lib/auth";
import { cartSelections, checkoutItems } from "../../../../lib/cart";
import {
  CouponError,
  couponErrorResponse,
  quoteCoupon,
} from "../../../../lib/coupons";
export async function POST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== requestOrigin(request)
    )
      throw new CouponError("Origem inválida.", 403);
    if (!(await getCustomerSession(request.headers)))
      throw new CouponError("Entre na sua conta para aplicar um cupom.", 401);
    const body = await request.json();
    if (!body || typeof body !== "object")
      throw new CouponError("Carrinho inválido.");
    const items = checkoutItems(body);
    if (!items?.length) throw new CouponError("Carrinho inválido.");
    const subtotalCents = cartSelections(items).reduce(
      (sum, item) => sum + item.subtotalCents,
      0,
    );
    const { coupon, discountCents } = await quoteCoupon(
      await getDb(),
      body.code,
      subtotalCents,
    );
    return Response.json(
      {
        code: coupon.code,
        discountCents,
        subtotalCents,
        expiresAt: coupon.expiresAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return couponErrorResponse(error);
  }
}
