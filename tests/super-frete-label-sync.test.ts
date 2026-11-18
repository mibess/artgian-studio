import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { orders } from "../db/schema";
import { POST } from "../app/api/webhooks/super-frete/route";

let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
const secret = "test-super-frete-secret";
const body = JSON.stringify({ event: "order.cancelled", data: { id: "label-1", status: "canceled" } });
const signature = createHmac("sha256", secret).update(body).digest("base64");

function notify(signed = signature) {
  return POST(new Request("https://store.example/api/webhooks/super-frete", {
    method: "POST",
    body,
    headers: { "x-me-signature": signed },
  }));
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artgian-label-sync-"));
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  vi.stubEnv("SUPER_FRETE_WEBHOOK_SECRET", secret);
  vi.stubEnv("SUPER_FRETE_API_KEY", "test-key");
  vi.stubEnv("SUPER_FRETE_USER_AGENT", "artgian-test");
  db = await getDb();
});

beforeEach(async () => {
  await db.delete(orders);
  await db.insert(orders).values({
    id: "order-1", status: "paid", shippingProvider: "super_frete",
    shippingLabelId: "label-1", shippingLabelUrl: "https://example.com/old.pdf",
    shippingLabelStatus: "generated", shippingTrackingCode: "OLD",
    customerName: "Cliente Teste", customerEmail: "test@example.com",
    customerPhone: "11999999999", postalCode: "38130000", streetAddress: "Rua Teste",
    addressNumber: "10", neighborhood: "Centro", city: "Campo Florido", state: "MG",
    subtotalCents: 5500, shippingCents: 1500, totalCents: 7000,
  });
});

afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

it("confirms the cancellation, detaches the old label and ignores a replay after replacement", async () => {
  const fetchMock = vi.fn(async () => Response.json({ id: "label-1", status: "canceled" }));
  vi.stubGlobal("fetch", fetchMock);

  expect((await notify()).status).toBe(204);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v0\/order\/info\/label-1$/), expect.objectContaining({ cache: "no-store" }));
  expect((await db.select().from(orders))[0]).toMatchObject({
    shippingLabelId: null, shippingLabelUrl: null, shippingTrackingCode: null,
    shippingLabelStatus: "canceled", status: "paid", city: "Campo Florido",
  });

  await db.update(orders).set({ shippingLabelId: "label-2", shippingLabelStatus: "generated" });
  expect((await notify()).status).toBe(204);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((await db.select().from(orders))[0].shippingLabelId).toBe("label-2");
});

it.each([
  { id: "label-1", status: "released" },
  { id: "another-label", status: "canceled" },
])("preserves the link when the cancellation is unconfirmed: %j", async (label) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(label)));
  expect((await notify()).status).toBe(503);
  expect((await db.select().from(orders))[0]).toMatchObject({
    shippingLabelId: "label-1", shippingLabelStatus: "generated",
  });
});

it("rejects unauthenticated notifications before contacting the provider", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  expect((await notify("invalid")).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});
