import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  couponIssuances,
  couponRateLimits,
  coupons,
  orders,
  user,
} from "../db/schema";
import {
  adminCouponSchema,
  calculateDiscount,
  cleanupExpiredGameCoupons,
  drawGameDiscount,
  quoteCoupon,
  reserveCoupon,
} from "../lib/coupons";
import { POST as game } from "../app/api/coupons/game/route";
import { POST as checkout } from "../app/api/checkout/route";
import { POST as validate } from "../app/api/coupons/validate/route";
import { POST as webhook } from "../app/api/mercado-pago/webhook/route";
import { POST as manage } from "../app/api/admin/coupons/route";
const mock = vi.hoisted(() => ({ fetch: vi.fn(), session: vi.fn() }));
vi.mock("../lib/auth", () => ({ getCustomerSession: mock.session }));
const key = "isolated-game-key-012345678901234567890123456789";
const root = "https://store.example";
let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
const items = [
  { productId: "organizador-arco", color: "rosa-marfim", quantity: 3 },
  { productId: "porta-incenso-samurai", color: "preto", quantity: 1 },
];
const checkoutBody = {
  items,
  customerName: "Cliente",
  customerPhone: "11999999999",
  customerDocument: "52998224725",
  postalCode: "01001000",
  streetAddress: "Praça da Sé",
  addressNumber: "1",
  neighborhood: "Sé",
  city: "São Paulo",
  state: "SP",
  shippingServiceId: "1",
  shippingPriceCents: 1500,
};
function request(
  route: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`${root}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
const rewardRequest = (
  completionId = "level-1",
  playerId = "player-1",
  idempotencyKey = "request-0001",
) =>
  request(
    "/api/coupons/game",
    { playerId, completionId },
    { Authorization: `Bearer ${key}`, "Idempotency-Key": idempotencyKey },
  );
async function seed(overrides: Partial<typeof coupons.$inferInsert> = {}) {
  const now = new Date().toISOString();
  const [coupon] = await db
    .insert(coupons)
    .values({
      id: crypto.randomUUID(),
      code: "TEST10",
      source: "admin",
      kind: "percent",
      value: 10,
      maxUses: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  return coupon;
}
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-coupons-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/store.db`);
  vi.stubEnv("TURSO_DATABASE_URL", "");
  vi.stubEnv("TURSO_AUTH_TOKEN", "");
  db = await getDb();
  await db.insert(user).values({
    id: "customer-1",
    name: "Cliente",
    email: "customer@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});
beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(orders);
  await db.delete(coupons);
  await db.delete(couponIssuances);
  await db.delete(couponRateLimits);
  vi.stubEnv("COUPON_GAME_API_KEY", key);
  vi.stubEnv("COUPON_GAME_HOURLY_LIMIT", "100");
  vi.stubEnv("COUPON_GAME_PLAYER_HOURLY_LIMIT", "3");
  vi.stubEnv("APP_URL", root);
  vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "test-token");
  vi.stubEnv("MERCADO_PAGO_ENVIRONMENT", "test");
  vi.stubEnv("MERCADO_PAGO_WEBHOOK_SECRET", "test-secret");
  vi.stubEnv("MELHOR_ENVIO_ENVIRONMENT", "sandbox");
  vi.stubEnv("MELHOR_ENVIO_ACCESS_TOKEN", "test-token");
  vi.stubEnv("MELHOR_ENVIO_ORIGIN_POSTAL_CODE", "01001000");
  vi.stubEnv("MELHOR_ENVIO_USER_AGENT", "Test (test@example.com)");
  mock.session.mockResolvedValue({
    user: { id: "customer-1", email: "customer@example.com" },
  });
  mock.fetch.mockImplementation(async (url: string) =>
    url.includes("shipment/calculate")
      ? Response.json([
          {
            id: 1,
            name: "PAC",
            price: "15.00",
            delivery_time: 5,
            company: { id: 1, name: "Correios" },
            packages: [
              {
                weight: 0.85,
                dimensions: { width: 24, height: 31, length: 20 },
              },
            ],
          },
        ])
      : Response.json({
          id: "preference-1",
          init_point: "https://www.mercadopago.com/pay",
        }),
  );
  vi.stubGlobal("fetch", mock.fetch);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("game reward rarity", () => {
  it("maps the 100 equally likely buckets to descending discount rarity", () => {
    const results = Array.from({ length: 100 }, (_, bucket) =>
      drawGameDiscount(bucket),
    );

    expect(results.filter((discount) => discount === 5)).toHaveLength(40);
    expect(results.filter((discount) => discount === 10)).toHaveLength(30);
    expect(results.filter((discount) => discount === 20)).toHaveLength(20);
    expect(results.filter((discount) => discount === 30)).toHaveLength(10);
  });
});

describe("game rewards API using a real migrated database", () => {
  it("requires a secret, server-to-server calls and valid payload", async () => {
    expect((await game(request("/api/coupons/game", {}))).status).toBe(401);
    expect(
      (
        await game(
          request(
            "/api/coupons/game",
            {},
            { Authorization: `Bearer ${key}`, Origin: root },
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await game(
          request("/api/coupons/game", {}, { Authorization: `Bearer ${key}` }),
        )
      ).status,
    ).toBe(400);
    vi.stubEnv("COUPON_GAME_API_KEY", "");
    expect((await game(rewardRequest())).status).toBe(503);
    expect(await db.select().from(coupons)).toHaveLength(0);
  });
  it("issues exactly one random reward per completion, with 30 minute expiry", async () => {
    const before = Date.now();
    const response = await game(rewardRequest());
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect([5, 10, 20, 30]).toContain(body.discountPercent);
    expect(body.code).toMatch(/^GAME-[A-F0-9]{20}$/);
    expect(body.reusable).toBe(false);
    expect(Date.parse(body.expiresAt) - before).toBeGreaterThanOrEqual(
      1_800_000,
    );
    expect(body.expiresInSeconds).toBeGreaterThanOrEqual(1799);
    const [storedCoupon] = await db.select().from(coupons);
    expect(storedCoupon.minSubtotalCents).toBe(10_000);
    await expect(quoteCoupon(db, body.code, 9_999)).rejects.toThrow(
      /pelo menos R\$ 100,00/,
    );
    await expect(quoteCoupon(db, body.code, 10_000)).resolves.toMatchObject({
      coupon: { code: body.code },
    });
    const replay = await game(rewardRequest());
    expect(replay.status).toBe(200);
    expect((await replay.json()).code).toBe(body.code);
    const changedKey = await game(
      rewardRequest("level-1", "player-1", "other-request"),
    );
    expect(changedKey.status).toBe(409);
    expect((await game(rewardRequest("level-2"))).status).toBe(409);
    expect(await db.select().from(coupons)).toHaveLength(1);
    expect(await db.select().from(couponIssuances)).toHaveLength(1);
  });
  it("never reissues an expired, deleted or reserved reward and removes expired coupons", async () => {
    const response = await game(rewardRequest());
    const { code } = await response.json();
    await db
      .update(coupons)
      .set({ expiresAt: new Date(Date.now() - 1).toISOString() })
      .where(eq(coupons.code, code));
    expect((await game(rewardRequest())).status).toBe(410);
    expect(await db.select().from(coupons)).toHaveLength(0);
    expect(await db.select().from(couponIssuances)).toHaveLength(1);
    expect(
      (await game(rewardRequest("level-1", "player-1", "new-key-1234"))).status,
    ).toBe(409);
  });
  it("enforces per-player and global quotas across distinct requests", async () => {
    vi.stubEnv("COUPON_GAME_PLAYER_HOURLY_LIMIT", "1");
    vi.stubEnv("COUPON_GAME_HOURLY_LIMIT", "2");
    expect((await game(rewardRequest())).status).toBe(201);
    const blocked = await game(
      rewardRequest("level-2", "player-1", "request-0002"),
    );
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(
      (await game(rewardRequest("level-1", "player-2", "request-0003"))).status,
    ).toBe(201);
    expect(
      (await game(rewardRequest("level-1", "player-3", "request-0004"))).status,
    ).toBe(429);
    expect(await db.select().from(coupons)).toHaveLength(2);
    expect((await game(rewardRequest())).status).toBe(200);
  });
});

describe("discount rules and atomic reservations", () => {
  it("uses integer cents, minimum purchase and fixed/percentage caps", () => {
    const base = {
      kind: "percent" as const,
      value: 30,
      minSubtotalCents: 0,
      maxDiscountCents: null,
    };
    expect(calculateDiscount(base, 1999)).toBe(599);
    expect(calculateDiscount(base, 50_000)).toBe(10_000);
    expect(calculateDiscount({ ...base, maxDiscountCents: 300 }, 1999)).toBe(
      300,
    );
    expect(
      calculateDiscount({ ...base, kind: "fixed", value: 5000 }, 1999),
    ).toBe(1999);
    expect(() =>
      calculateDiscount({ ...base, minSubtotalCents: 2000 }, 1999),
    ).toThrow(/pelo menos/);
    expect(adminCouponSchema.safeParse({ code: "X", value: -1 }).success).toBe(
      false,
    );
  });
  it("enforces the game minimum for coupons created before the rule", async () => {
    const coupon = await seed({ source: "game", minSubtotalCents: 0 });
    await expect(quoteCoupon(db, coupon.code, 9_999)).rejects.toThrow(
      /pelo menos R\$ 100,00/,
    );
    await expect(quoteCoupon(db, coupon.code, 10_000)).resolves.toMatchObject({
      coupon: { id: coupon.id },
    });
  });
  it("rejects future, expired, inactive and exhausted coupons", async () => {
    const coupon = await seed();
    for (const changes of [
      { startsAt: "2099-01-01T00:00:00.000Z" },
      { startsAt: null, expiresAt: "2000-01-01T00:00:00.000Z" },
      { expiresAt: null, active: false },
      { active: true, allocatedUses: 1 },
    ]) {
      await db.update(coupons).set(changes).where(eq(coupons.id, coupon.id));
      await expect(quoteCoupon(db, "test10", 10000)).rejects.toThrow();
    }
  });
  it("rolls a reservation back if persisting its order fails", async () => {
    await seed();
    await expect(
      db.transaction(
        async (tx) => {
          await reserveCoupon(tx, "test10", 10000);
          throw new Error("order failure");
        },
        { behavior: "immediate" },
      ),
    ).rejects.toThrow("order failure");
    expect((await quoteCoupon(db, "TEST10", 10000)).coupon.allocatedUses).toBe(
      0,
    );
  });
  it("allows only one winner when two database connections reserve concurrently", async () => {
    await seed();
    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");
    const schema = await import("../db/schema");
    const client = createClient({ url: `file:${directory}/store.db` });
    await client.execute("PRAGMA busy_timeout = 100");
    const other = drizzle(client, { schema });
    const results = await Promise.allSettled(
      [db, other].map((connection) =>
        connection.transaction((tx) => reserveCoupon(tx, "TEST10", 10000), {
          behavior: "immediate",
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect((await db.select().from(coupons))[0].allocatedUses).toBe(1);
    client.close();
  });
  it("preview recalculates the catalog and never reserves a use", async () => {
    await seed();
    const response = await validate(
      request("/api/coupons/validate", {
        items,
        code: "test10",
        subtotalCents: 1,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      code: "TEST10",
      subtotalCents: 18260,
      discountCents: 1826,
    });
    expect((await db.select().from(coupons))[0].allocatedUses).toBe(0);
    mock.session.mockResolvedValue(null);
    expect(
      (
        await validate(
          request("/api/coupons/validate", { items, code: "test10" }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("checkout and payment lifecycle", () => {
  it("rejects forged production webhooks before fetching or deleting a reward", async () => {
    const coupon = await seed({ source: "game" });
    await checkout(
      request("/api/checkout", { ...checkoutBody, couponCode: coupon.code }),
    );
    const [order] = await db.select().from(orders);
    mock.fetch.mockClear();
    vi.stubEnv("MERCADO_PAGO_ENVIRONMENT", "production");
    expect(
      (
        await webhook(
          request("/api/mercado-pago/webhook", {
            type: "payment",
            data: { id: 123 },
          }),
        )
      ).status,
    ).toBe(401);
    expect(mock.fetch).not.toHaveBeenCalled();
    expect(await db.select().from(coupons)).toHaveLength(1);
    const { createHmac } = await import("node:crypto");
    const ts = String(Date.now());
    const signature = createHmac("sha256", "test-secret")
      .update(`id:123;request-id:signed-123;ts:${ts};`)
      .digest("hex");
    mock.fetch.mockResolvedValue(
      Response.json({
        id: 123,
        status: "approved",
        external_reference: order.id,
        transaction_amount: order.totalCents / 100,
        currency_id: "BRL",
      }),
    );
    expect(
      (
        await webhook(
          request(
            "/api/mercado-pago/webhook",
            { type: "payment", data: { id: 123 } },
            {
              "x-request-id": "signed-123",
              "x-signature": `ts=${ts},v1=${signature}`,
            },
          ),
        )
      ).status,
    ).toBe(200);
    expect(await db.select().from(coupons)).toHaveLength(0);
  });
  it("allows reusable coupons up to their limit and keeps manual records after approval", async () => {
    await seed({ maxUses: 2 });
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        (
          await checkout(
            request("/api/checkout", { ...checkoutBody, couponCode: "TEST10" }),
          )
        ).status,
      ).toBe(201);
    expect(
      (
        await checkout(
          request("/api/checkout", { ...checkoutBody, couponCode: "TEST10" }),
        )
      ).status,
    ).toBe(409);
    const [order] = await db.select().from(orders);
    mock.fetch.mockResolvedValue(
      Response.json({
        id: 123,
        status: "approved",
        external_reference: order.id,
        transaction_amount: order.totalCents / 100,
        currency_id: "BRL",
      }),
    );
    expect(
      (
        await webhook(
          request("/api/mercado-pago/webhook", {
            type: "payment",
            data: { id: 123 },
          }),
        )
      ).status,
    ).toBe(200);
    expect((await db.select().from(coupons))[0].allocatedUses).toBe(2);
  });

  it("persists the discount, charges exact cents and blocks a second use", async () => {
    await seed({ kind: "fixed", value: 1001 });
    const response = await checkout(
      request("/api/checkout", {
        ...checkoutBody,
        couponCode: "test10",
        discountCents: 18000,
      }),
    );
    expect(response.status).toBe(201);
    const [order] = await db.select().from(orders);
    expect(order).toMatchObject({
      subtotalCents: 18260,
      discountCents: 1001,
      shippingCents: 1500,
      totalCents: 18759,
      couponCode: "TEST10",
      couponValue: 1001,
    });
    const payment = JSON.parse(
      mock.fetch.mock.calls.find(([url]) =>
        url.includes("checkout/preferences"),
      )![1].body,
    );
    expect(
      payment.items.reduce(
        (sum: number, item: { quantity: number; unit_price: number }) =>
          sum + Math.round(item.unit_price * 100) * item.quantity,
        0,
      ) + Math.round(payment.shipments.cost * 100),
    ).toBe(order.totalCents);
    expect(
      payment.items.every(
        (item: { unit_price: number }) => item.unit_price > 0,
      ),
    ).toBe(true);
    expect(
      (
        await checkout(
          request("/api/checkout", { ...checkoutBody, couponCode: "test10" }),
        )
      ).status,
    ).toBe(409);
    expect(await db.select().from(orders)).toHaveLength(1);
  });
  it("caps 100% coupons at R$ 100 while charging shipping", async () => {
    await seed({ value: 100 });
    expect(
      (
        await checkout(
          request("/api/checkout", { ...checkoutBody, couponCode: "TEST10" }),
        )
      ).status,
    ).toBe(201);
    const payment = JSON.parse(
      mock.fetch.mock.calls.find(([url]) =>
        url.includes("checkout/preferences"),
      )![1].body,
    );
    const [order] = await db.select().from(orders);
    expect(order).toMatchObject({
      subtotalCents: 18_260,
      discountCents: 10_000,
      shippingCents: 1_500,
      totalCents: 9_760,
    });
    expect(
      payment.items.reduce(
        (sum: number, item: { quantity: number; unit_price: number }) =>
          sum + Math.round(item.unit_price * 100) * item.quantity,
        0,
      ) + Math.round(payment.shipments.cost * 100),
    ).toBe(order.totalCents);
    expect(payment.shipments.cost).toBe(15);
  });
  it("releases only definitive preference creation failures; network uncertainty keeps the reservation", async () => {
    await seed();
    const original = mock.fetch.getMockImplementation()!;
    mock.fetch.mockImplementation(async (url: string, options: RequestInit) =>
      url.includes("checkout/preferences")
        ? Response.json({ error: "bad request" }, { status: 400 })
        : original(url, options),
    );
    expect(
      (
        await checkout(
          request("/api/checkout", { ...checkoutBody, couponCode: "TEST10" }),
        )
      ).status,
    ).toBe(500);
    expect((await db.select().from(coupons))[0].allocatedUses).toBe(0);
    mock.fetch.mockImplementation(async (url: string, options: RequestInit) => {
      if (url.includes("checkout/preferences"))
        throw new TypeError("network lost");
      return original(url, options);
    });
    expect(
      (
        await checkout(
          request("/api/checkout", { ...checkoutBody, couponCode: "TEST10" }),
        )
      ).status,
    ).toBe(500);
    expect((await db.select().from(coupons))[0].allocatedUses).toBe(1);
  });
  it("deletes a game coupon only on verified approval and preserves the order snapshot on replay", async () => {
    const coupon = await seed({
      source: "game",
      expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    });
    await checkout(
      request("/api/checkout", { ...checkoutBody, couponCode: coupon.code }),
    );
    const [order] = await db.select().from(orders);
    const notify = () =>
      webhook(
        request("/api/mercado-pago/webhook", {
          id: 999,
          type: "payment",
          data: { id: 123 },
        }),
      );
    mock.fetch.mockResolvedValue(
      Response.json({
        id: 123,
        status: "approved",
        external_reference: order.id,
        transaction_amount: 1,
        currency_id: "BRL",
      }),
    );
    expect((await notify()).status).toBe(200);
    expect(await db.select().from(coupons)).toHaveLength(1);
    for (const status of ["pending", "approved", "approved"]) {
      mock.fetch.mockImplementation(async () =>
        Response.json({
          id: 123,
          status,
          external_reference: order.id,
          transaction_amount: order.totalCents / 100,
          currency_id: "BRL",
        }),
      );
      expect((await notify()).status).toBe(200);
      expect(await db.select().from(coupons)).toHaveLength(
        status === "pending" ? 1 : 0,
      );
    }
    const [paid] = await db.select().from(orders);
    expect(paid).toMatchObject({
      status: "paid",
      discountCents: 1826,
      couponCode: coupon.code,
    });
    expect(paid.couponRedeemedAt).toBeTruthy();
    expect(await cleanupExpiredGameCoupons(db)).toBe(0);
  });
});

describe("admin management", () => {
  it("requires admin credentials and same origin; creates, edits and deletes a reusable coupon", async () => {
    vi.stubEnv("ADMIN_USERNAME", "artgian");
    vi.stubEnv("ADMIN_PASSWORD", "test-password");
    const headers = {
      authorization: `Basic ${Buffer.from("artgian:test-password").toString("base64")}`,
      origin: root,
    };
    const body = {
      action: "create",
      code: "MANUAL20",
      kind: "percent",
      value: "20",
      active: "on",
      reusable: "on",
      maxUses: "5",
      minSubtotal: "10.50",
      maxDiscount: "20.25",
      startsAt: "2026-01-01T10:00",
      expiresAt: "2099-01-01T10:00",
    };
    const submit = (
      values: Record<string, string>,
      suppliedHeaders = headers,
    ) =>
      manage(
        new Request(`${root}/api/admin/coupons`, {
          method: "POST",
          headers: suppliedHeaders,
          body: new URLSearchParams(values),
        }),
      );
    expect(
      (await submit(body, { authorization: "", origin: root })).status,
    ).toBe(401);
    expect(
      (await submit(body, { ...headers, origin: "https://evil.example" }))
        .status,
    ).toBe(403);
    expect((await submit(body)).headers.get("location")).toContain("message=");
    const [coupon] = await db.select().from(coupons);
    expect(coupon).toMatchObject({
      maxUses: 5,
      minSubtotalCents: 1050,
      maxDiscountCents: 2025,
      startsAt: "2026-01-01T13:00:00.000Z",
    });
    expect((await submit(body)).headers.get("location")).toContain("error=");
    expect(
      (
        await submit({ ...body, id: coupon.id, action: "update", value: "30" })
      ).headers.get("location"),
    ).toContain("message=");
    expect((await db.select().from(coupons))[0].value).toBe(30);
    await submit({ action: "delete", id: coupon.id });
    expect(await db.select().from(coupons)).toHaveLength(0);
  });
});
