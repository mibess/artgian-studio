import {
  authenticateGameApi,
  couponErrorResponse,
  generateGameCoupon,
  CouponError,
} from "../../../../lib/coupons";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    authenticateGameApi(request);
    // This endpoint is intentionally server-to-server: never expose its secret to a browser.
    if (request.headers.has("origin"))
      throw new CouponError("Chame esta API pelo servidor do jogo.", 403);
    const body = await request.text();
    if (body.length > 4096)
      throw new CouponError("Corpo da requisição muito grande.", 413);
    const { coupon, replayed } = await generateGameCoupon(
      JSON.parse(body),
      request.headers.get("idempotency-key"),
    );
    return Response.json(
      {
        code: coupon.code,
        discountPercent: coupon.value,
        expiresAt: coupon.expiresAt,
        expiresInSeconds: Math.max(
          0,
          Math.floor((Date.parse(coupon.expiresAt!) - Date.now()) / 1000),
        ),
        reusable: false,
      },
      {
        status: replayed ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return couponErrorResponse(error);
  }
}
