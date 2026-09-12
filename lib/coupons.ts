import "server-only";
import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import {
  couponIssuances,
  couponRateLimits,
  coupons,
  orders,
} from "../db/schema";

type Database = Awaited<ReturnType<typeof getDb>>;
export type CouponTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
export type Coupon = typeof coupons.$inferSelect;
export class CouponError extends Error {
  constructor(
    message: string,
    public status = 400,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
const MAX_DISCOUNT_CENTS = 10_000;
const GAME_MIN_SUBTOTAL_CENTS = 10_000;
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9_-]{2,39}$/,
    "Use 3 a 40 letras, números, hífen ou sublinhado no código.",
  );
const isoDate = z.iso.datetime().nullable();
export const adminCouponSchema = z
  .object({
    code: couponCodeSchema,
    kind: z.enum(["percent", "fixed"]),
    value: z.number().int().positive().max(100_000_000),
    active: z.boolean(),
    startsAt: isoDate,
    expiresAt: isoDate,
    maxUses: z.number().int().min(1).max(1_000_000).nullable(),
    minSubtotalCents: z.number().int().min(0).max(100_000_000),
    maxDiscountCents: z.number().int().positive().max(100_000_000).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "percent" && value.value > 100)
      ctx.addIssue({
        code: "custom",
        message: "O percentual deve estar entre 1 e 100%.",
      });
    if (value.startsAt && value.expiresAt && value.startsAt >= value.expiresAt)
      ctx.addIssue({
        code: "custom",
        message: "A expiração deve ser posterior ao início.",
      });
  });

export function calculateDiscount(
  coupon: Pick<
    Coupon,
    "kind" | "value" | "minSubtotalCents" | "maxDiscountCents"
  >,
  subtotalCents: number,
) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0)
    throw new CouponError("Carrinho inválido.");
  if (subtotalCents < coupon.minSubtotalCents)
    throw new CouponError(
      `Este cupom exige pelo menos R$ ${(coupon.minSubtotalCents / 100).toFixed(2).replace(".", ",")} em produtos.`,
    );
  const amount =
    coupon.kind === "percent"
      ? Math.floor((subtotalCents * coupon.value) / 100)
      : coupon.value;
  return Math.min(
    subtotalCents,
    amount,
    MAX_DISCOUNT_CENTS,
    coupon.maxDiscountCents ?? subtotalCents,
  );
}

export async function quoteCoupon(
  db: Database | CouponTransaction,
  rawCode: unknown,
  subtotalCents: number,
  now = new Date().toISOString(),
) {
  const parsed = couponCodeSchema.safeParse(rawCode);
  if (!parsed.success) throw new CouponError("Código de cupom inválido.");
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, parsed.data))
    .limit(1);
  if (
    !coupon ||
    !coupon.active ||
    (coupon.startsAt && coupon.startsAt > now) ||
    (coupon.expiresAt && coupon.expiresAt <= now)
  )
    throw new CouponError("Cupom inválido, inativo ou expirado.");
  if (coupon.maxUses !== null && coupon.allocatedUses >= coupon.maxUses)
    throw new CouponError(
      "Este cupom já foi usado ou está reservado em um pagamento.",
      409,
    );
  const discountCents = calculateDiscount(
    coupon.source === "game"
      ? {
          ...coupon,
          minSubtotalCents: Math.max(
            coupon.minSubtotalCents,
            GAME_MIN_SUBTOTAL_CENTS,
          ),
        }
      : coupon,
    subtotalCents,
  );
  if (discountCents <= 0)
    throw new CouponError("O cupom não gera desconto neste carrinho.");
  return { coupon, discountCents };
}

// Run within the same write transaction that inserts the order and its items.
export async function reserveCoupon(
  tx: CouponTransaction,
  code: unknown,
  subtotalCents: number,
) {
  const now = new Date().toISOString();
  const result = await quoteCoupon(tx, code, subtotalCents, now);
  const claimed = await tx
    .update(coupons)
    .set({ allocatedUses: sql`${coupons.allocatedUses} + 1`, updatedAt: now })
    .where(
      and(
        eq(coupons.id, result.coupon.id),
        eq(coupons.active, true),
        or(
          isNull(coupons.maxUses),
          sql`${coupons.allocatedUses} < ${coupons.maxUses}`,
        ),
        or(isNull(coupons.startsAt), lte(coupons.startsAt, now)),
        or(isNull(coupons.expiresAt), gt(coupons.expiresAt, now)),
      ),
    )
    .returning({ id: coupons.id });
  if (!claimed.length)
    throw new CouponError(
      "Cupom indisponível. Confira o código novamente.",
      409,
    );
  return result;
}

export async function releaseCouponAfterSetupFailure(orderId: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (
      !order?.couponId ||
      order.mercadoPagoPreferenceId ||
      order.couponRedeemedAt
    )
      return;
    await tx
      .update(coupons)
      .set({ allocatedUses: sql`max(0, ${coupons.allocatedUses} - 1)` })
      .where(eq(coupons.id, order.couponId));
    await tx
      .update(orders)
      .set({ couponId: null })
      .where(eq(orders.id, orderId));
  });
}

export async function cleanupExpiredGameCoupons(
  db: Database | CouponTransaction,
  now = new Date().toISOString(),
) {
  const removed = await db
    .delete(coupons)
    .where(and(eq(coupons.source, "game"), lte(coupons.expiresAt, now)))
    .returning({ id: coupons.id });
  await db.delete(couponRateLimits).where(lte(couponRateLimits.resetsAt, now));
  return removed.length;
}

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function authenticateGameApi(request: Request) {
  const secret = process.env.COUPON_GAME_API_KEY?.trim();
  if (!secret || secret.length < 32)
    throw new CouponError("API de cupons não configurada.", 503);
  const received = request.headers.get("authorization") ?? "";
  if (
    !timingSafeEqual(
      Buffer.from(hash(received)),
      Buffer.from(hash(`Bearer ${secret}`)),
    )
  )
    throw new CouponError("Credencial inválida.", 401);
}
const rewardSchema = z
  .object({
    playerId: z.string().trim().min(1).max(128),
    completionId: z.string().trim().min(1).max(128),
  })
  .strict();
function configuredLimit(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 1_000_000)
    throw new CouponError(
      "Limite da API de cupons inválido na configuração.",
      503,
    );
  return parsed;
}
async function takeQuota(
  tx: CouponTransaction,
  key: string,
  max: number,
  now: Date,
) {
  const resetsAt = new Date(
    Math.floor(now.getTime() / 3_600_000) * 3_600_000 + 3_600_000,
  ).toISOString();
  const result = await tx
    .insert(couponRateLimits)
    .values({ key, count: 1, resetsAt })
    .onConflictDoUpdate({
      target: couponRateLimits.key,
      set: { count: sql`${couponRateLimits.count} + 1` },
      setWhere: sql`${couponRateLimits.count} < ${max}`,
    })
    .returning({ count: couponRateLimits.count });
  if (!result.length)
    throw new CouponError(
      "Limite de recompensas atingido. Tente mais tarde.",
      429,
      Math.max(1, Math.ceil((Date.parse(resetsAt) - now.getTime()) / 1000)),
    );
}
export async function generateGameCoupon(rawBody: unknown, rawKey: unknown) {
  const body = rewardSchema.safeParse(rawBody);
  const key = z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,128}$/)
    .safeParse(rawKey);
  if (!body.success || !key.success)
    throw new CouponError(
      "Envie playerId, completionId e o cabeçalho Idempotency-Key (8 a 128 letras, números, hífen ou sublinhado).",
    );
  const playerHash = hash(body.data.playerId);
  const completionHash = hash(
    JSON.stringify([body.data.playerId, body.data.completionId]),
  );
  const requestKey = hash(key.data);
  const globalLimit = configuredLimit("COUPON_GAME_HOURLY_LIMIT", 100);
  const playerLimit = configuredLimit("COUPON_GAME_PLAYER_HOURLY_LIMIT", 3);
  const db = await getDb();
  // Clean outside issuance transaction so a 410/429 does not roll cleanup back.
  await cleanupExpiredGameCoupons(db);
  return db.transaction(
    async (tx) => {
      const now = new Date();
      const [previous] = await tx
        .select()
        .from(couponIssuances)
        .where(
          or(
            eq(couponIssuances.requestKey, requestKey),
            eq(couponIssuances.completionHash, completionHash),
          ),
        )
        .orderBy(
          sql`case when ${couponIssuances.requestKey} = ${requestKey} then 0 else 1 end`,
        )
        .limit(1);
      if (previous) {
        if (
          previous.requestKey !== requestKey ||
          previous.completionHash !== completionHash ||
          previous.playerHash !== playerHash
        )
          throw new CouponError(
            "Chave ou conclusão já registrada. Repita a conclusão com a Idempotency-Key original.",
            409,
          );
        const [coupon] = await tx
          .select()
          .from(coupons)
          .where(eq(coupons.id, previous.couponId))
          .limit(1);
        if (
          !coupon ||
          !coupon.active ||
          !coupon.expiresAt ||
          coupon.expiresAt <= now.toISOString() ||
          coupon.allocatedUses > 0
        )
          throw new CouponError(
            "A recompensa desta conclusão já expirou, foi usada ou está reservada.",
            410,
          );
        return { coupon, replayed: true };
      }
      const bucket = Math.floor(now.getTime() / 3_600_000);
      await takeQuota(tx, `game:${bucket}`, globalLimit, now);
      await takeQuota(tx, `player:${playerHash}:${bucket}`, playerLimit, now);
      const [coupon] = await tx
        .insert(coupons)
        .values({
          id: crypto.randomUUID(),
          code: `GAME-${randomBytes(10).toString("hex").toUpperCase()}`,
          source: "game",
          kind: "percent",
          value: [5, 10, 20, 30][randomInt(4)],
          maxUses: 1,
          minSubtotalCents: GAME_MIN_SUBTOTAL_CENTS,
          expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
        .returning();
      await tx
        .insert(couponIssuances)
        .values({
          requestKey,
          playerHash,
          completionHash,
          couponId: coupon.id,
          createdAt: now.toISOString(),
        });
      return { coupon, replayed: false };
    },
    { behavior: "immediate" },
  );
}

export function couponErrorResponse(error: unknown) {
  if (error instanceof CouponError)
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        headers: {
          "Cache-Control": "no-store",
          ...(error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : {}),
        },
      },
    );
  if (error instanceof SyntaxError)
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  console.error(
    "Coupon operation failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "Não foi possível processar o cupom. Tente novamente." },
    { status: 500 },
  );
}
