import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orders, user } from "../db/schema";
import { getCustomerContact } from "../lib/customer-contact";
import { POST } from "../app/api/customer/contact/route";
const mock = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("../lib/auth", () => ({ getCustomerSession: mock.session }));
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp("/tmp/artgian-contact-");
  vi.stubEnv("DATABASE_URL", `file:${directory}/test.db`);
  const db = await getDb();
  await db.insert(user).values(["customer-a", "customer-b"].map(id => ({ id, name: "Cliente Teste", email: `${id}@example.com`, createdAt: new Date(), updatedAt: new Date() })));
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });
const request = (body: unknown, headers: Record<string, string> = {}) => new Request("https://store.test/api/customer/contact", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
describe("customer contact", () => {
  it("requires a session and rejects foreign origins", async () => {
    mock.session.mockResolvedValue(null);
    expect((await POST(request({ name: "Cliente Teste", phone: "11999999999" }))).status).toBe(401);
    expect((await POST(request({}, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await POST(request({}, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
  it("does not truncate malformed phone numbers or persist CPF/email from input", async () => {
    mock.session.mockResolvedValue({ user: { id: "customer-a" } });
    for (const phone of ["123", "119999999999", "11999999999abc", null])
      expect((await POST(request({ name: "Cliente Teste", phone }))).status).toBe(400);
    expect((await POST(request({ name: "Cliente", phone: "11999999999" }))).status).toBe(400);
    expect((await getCustomerContact("customer-a")).phone).toBeNull();
    const response = await POST(request({ name: "Cliente Atualizado", phone: "(11) 99999-9999", userId: "customer-b", email: "forged@example.com", customerDocument: "52998224725" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await getCustomerContact("customer-a")).toEqual({ name: "Cliente Atualizado", phone: "11999999999" });
    expect((await getCustomerContact("customer-b")).phone).toBeNull();
    const [customer] = await (await getDb()).select().from(user).where(eq(user.id, "customer-a"));
    expect(customer.email).toBe("customer-a@example.com");
  });
  it("only reuses the owner's previous order and preserves historical orders when edited", async () => {
    const db = await getDb();
    await db.insert(orders).values({ id: "historical-contact", userId: "customer-b", customerName: "Cliente Teste", customerEmail: "customer-a@example.com", customerPhone: "1633334444", postalCode: "01001000", streetAddress: "Praça da Sé", addressNumber: "1", neighborhood: "Sé", city: "São Paulo", state: "SP", subtotalCents: 1000, shippingCents: 500, totalCents: 1500 });
    expect((await getCustomerContact("customer-b")).phone).toBe("1633334444");
    expect((await getCustomerContact("customer-a")).phone).toBe("11999999999");
    mock.session.mockResolvedValue({ user: { id: "customer-b" } });
    expect((await POST(request({ name: "Cliente Teste", phone: "16988887777" }))).status).toBe(200);
    expect((await getCustomerContact("customer-b")).phone).toBe("16988887777");
    const [order] = await db.select().from(orders).where(eq(orders.id, "historical-contact"));
    expect(order.customerPhone).toBe("1633334444");
  });
});
