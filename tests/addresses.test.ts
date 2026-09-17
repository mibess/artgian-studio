import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { customerAddresses, orders, user } from "../db/schema";
import { changeAddress, getAddress, listAddresses, saveAddress } from "../lib/addresses/repository";
import { GET, POST } from "../app/api/addresses/route";
const mock = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("../lib/auth", () => ({ getCustomerSession: mock.session }));
let directory: string;
let db: Awaited<ReturnType<typeof getDb>>;
const address = { label: "Casa", postalCode: "01001-000", streetAddress: "Praça da Sé", addressNumber: "1", addressComplement: "", neighborhood: "Sé", city: "São Paulo", state: "SP" };
const request = (body: unknown, headers: Record<string, string> = {}) => new Request("https://store.test/api/addresses", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
beforeAll(async () => {
  directory = await mkdtemp("/tmp/artgian-addresses-");
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  db = await getDb();
  await db.insert(user).values(["customer-a", "customer-b"].map(id => ({ id, name: "Cliente Teste", email: `${id}@example.com`, createdAt: new Date(), updatedAt: new Date() })));
});
beforeEach(async () => {
  await db.delete(customerAddresses);
  await db.delete(orders);
  mock.session.mockResolvedValue({ user: { id: "customer-a" } });
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });
describe("customer address book", () => {
  it("serializes concurrent first-address writes without creating two defaults", async () => {
    await Promise.all([
      saveAddress("customer-a", address),
      saveAddress("customer-a", { ...address, addressNumber: "2" }),
    ]);
    const saved = await listAddresses("customer-a");
    expect(saved).toHaveLength(2);
    expect(saved.filter(row => row.isDefault)).toHaveLength(1);
  });
  it("persists addresses, automatically defaults only the first, and normalizes duplicates", async () => {
    const first = await saveAddress("customer-a", address);
    expect(first).toMatchObject({ isDefault: true, postalCode: "01001000" });
    const duplicate = await saveAddress("customer-a", { ...address, label: "", postalCode: "01001000", streetAddress: " PRAÇA  DA SÉ " });
    expect(duplicate.id).toBe(first.id);
    expect(duplicate.label).toBe("Casa");
    const second = await saveAddress("customer-a", { ...address, addressNumber: "2" });
    expect(second.isDefault).toBe(false);
    expect(await listAddresses("customer-a")).toHaveLength(2);
  });
  it("switches defaults, preserves the default when edited, and promotes the remaining address on deletion", async () => {
    const first = await saveAddress("customer-a", address);
    const second = await saveAddress("customer-a", { ...address, addressNumber: "2" });
    await changeAddress("customer-a", second.id, "default");
    await saveAddress("customer-a", { ...address, addressNumber: "3" }, { id: second.id, makeDefault: false });
    expect((await listAddresses("customer-a"))[0]).toMatchObject({ id: second.id, isDefault: true, addressNumber: "3" });
    await changeAddress("customer-a", second.id, "delete");
    expect(await getAddress("customer-a", first.id)).toMatchObject({ isDefault: true });
    await changeAddress("customer-a", first.id, "delete");
    expect(await listAddresses("customer-a")).toEqual([]);
    expect(await saveAddress("customer-a", address)).toMatchObject({ isDefault: true });
  });
  it("rejects editing into a duplicate without losing the default", async () => {
    await saveAddress("customer-a", address);
    const second = await saveAddress("customer-a", { ...address, addressNumber: "2" });
    await expect(saveAddress("customer-a", address, { id: second.id, makeDefault: true })).rejects.toMatchObject({ status: 409 });
    expect((await listAddresses("customer-a")).filter(row => row.isDefault)).toHaveLength(1);
  });
  it("does not expose or mutate another customer's address", async () => {
    const foreign = await saveAddress("customer-b", address);
    expect(await listAddresses("customer-a")).toEqual([]);
    await expect(getAddress("customer-a", foreign.id)).rejects.toMatchObject({ status: 404 });
    for (const action of ["default", "delete", "save"]) {
      const response = await POST(request({ action, id: foreign.id, address }));
      expect(response.status).toBe(404);
    }
    expect(await getAddress("customer-b", foreign.id)).toMatchObject({ isDefault: true });
  });
  it("requires login, blocks cross-site requests, and takes ownership only from the session", async () => {
    expect((await POST(request({ action: "save", address, userId: "customer-b" }, { origin: "https://evil.test" }))).status).toBe(403);
    mock.session.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://store.test/api/addresses"))).status).toBe(401);
    mock.session.mockResolvedValueOnce(null);
    expect((await POST(request({ action: "save", address }))).status).toBe(401);
    expect((await POST(request({ action: "save", address, userId: "customer-b" }))).status).toBe(200);
    expect(await listAddresses("customer-b")).toEqual([]);
    const response = await GET(new Request("https://store.test/api/addresses"));
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).addresses[0]).not.toHaveProperty("userId");
  });
  it("validates required fields, state, postal code, lengths and request shape", async () => {
    for (const invalid of [{ ...address, city: " " }, { ...address, state: "ZZ" }, { ...address, postalCode: "123456789" }, { ...address, label: "x".repeat(41) }]) {
      expect((await POST(request({ action: "save", address: invalid }))).status).toBe(400);
    }
    expect((await POST(request(null))).status).toBe(400);
    expect(await listAddresses("customer-a")).toEqual([]);
  });
  it("enforces one default in the database and keeps historic order snapshots", async () => {
    const first = await saveAddress("customer-a", address);
    const second = await saveAddress("customer-a", { ...address, addressNumber: "2" });
    await expect(db.update(customerAddresses).set({ isDefault: true }).where(and(eq(customerAddresses.userId, "customer-a"), eq(customerAddresses.id, second.id)))).rejects.toThrow();
    await db.insert(orders).values({ id: "historic", userId: "customer-a", customerName: "Cliente Teste", customerEmail: "a@example.com", customerPhone: "11999999999", ...address, subtotalCents: 1000, shippingCents: 500, totalCents: 1500 });
    await saveAddress("customer-a", { ...address, addressNumber: "99" }, { id: first.id });
    await changeAddress("customer-a", first.id, "delete");
    const [order] = await db.select().from(orders).where(eq(orders.id, "historic"));
    expect(order.addressNumber).toBe("1");
  });
});
