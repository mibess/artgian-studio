import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { orders, user } from "../db/schema";
import { hasFullName } from "./brazil";

export const customerPhoneSchema = z.string().trim().max(20)
  .regex(/^[\d()\s-]+$/, "Informe um telefone válido com DDD.")
  .transform(value => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^[1-9]\d{9,10}$/, "Informe um telefone válido com DDD."));
export const customerContactSchema = z.object({
  name: z.string().trim().min(3).max(120).refine(hasFullName, "Informe nome e sobrenome."),
  phone: customerPhoneSchema,
});

export async function getCustomerContact(userId: string) {
  const db = await getDb();
  const [customer] = await db.select({ name: user.name, phone: user.phone }).from(user).where(eq(user.id, userId));
  if (!customer) throw new Error("Cliente não encontrado.");
  if (customer.phone) return customer;
  const [lastOrder] = await db.select({ phone: orders.customerPhone }).from(orders)
    .where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt), desc(orders.id)).limit(1);
  const parsed = customerPhoneSchema.safeParse(lastOrder?.phone);
  return { name: customer.name, phone: parsed.success ? parsed.data : null };
}

export async function saveCustomerContact(userId: string, input: unknown) {
  const contact = customerContactSchema.parse(input);
  const db = await getDb();
  await db.update(user).set({ ...contact, updatedAt: new Date() }).where(eq(user.id, userId));
  return contact;
}
