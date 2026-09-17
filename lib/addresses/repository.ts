import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { customerAddresses } from "../../db/schema";
import { addressSchema, type AddressInput, type SavedAddress } from "./schema";

export class AddressError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const owned = (userId: string, id: string) => and(eq(customerAddresses.userId, userId), eq(customerAddresses.id, id));
async function retryWrite<T>(write: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await write(); }
    catch (error) {
      let cause: unknown = error;
      let busy = false;
      while (cause && typeof cause === "object") {
        if ("code" in cause && String(cause.code).startsWith("SQLITE_BUSY")) busy = true;
        cause = "cause" in cause ? cause.cause : undefined;
      }
      if (!busy) throw error;
      if (attempt >= 5) throw new AddressError("Outro endereço está sendo atualizado. Tente novamente em instantes.", 409);
      // Only retry rolled-back database writes; no external side effects run here.
      await new Promise(resolve => setTimeout(resolve, 30 * 2 ** attempt));
    }
  }
}
function publicAddress(row: typeof customerAddresses.$inferSelect): SavedAddress {
  return { ...addressSchema.parse(row), id: row.id, isDefault: row.isDefault };
}
function fingerprint(address: AddressInput) {
  const { postalCode, streetAddress, addressNumber, addressComplement, neighborhood, city, state } = address;
  const identity = [postalCode, streetAddress, addressNumber, addressComplement, neighborhood, city, state]
    .map(value => value.normalize("NFC").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim());
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}
export async function listAddresses(userId: string) {
  const db = await getDb();
  return (await db.select().from(customerAddresses).where(eq(customerAddresses.userId, userId))
    .orderBy(desc(customerAddresses.isDefault), asc(customerAddresses.createdAt), asc(customerAddresses.id))).map(publicAddress);
}
export async function getAddress(userId: string, id: string) {
  const db = await getDb();
  const [address] = await db.select().from(customerAddresses).where(owned(userId, id));
  if (!address) throw new AddressError("Endereço não encontrado. Selecione outro endereço ou cadastre um novo.", 404);
  return publicAddress(address);
}

/** The write transaction serializes first-address/default decisions, including concurrent checkouts. */
export async function saveAddress(userId: string, input: unknown, options: { id?: string; makeDefault?: boolean } = {}) {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) throw new AddressError(parsed.error.issues[0].message);
  const address = parsed.data;
  const identity = fingerprint(address);
  const db = await getDb();
  return retryWrite(() => db.transaction(async tx => {
    const existing = await tx.select().from(customerAddresses).where(eq(customerAddresses.userId, userId));
    const current = options.id ? existing.find(row => row.id === options.id) : undefined;
    if (options.id && !current) throw new AddressError("Endereço não encontrado.", 404);
    const duplicate = existing.find(row => row.fingerprint === identity && row.id !== options.id);
    if (duplicate && options.id) throw new AddressError("Este endereço já está cadastrado na sua conta.", 409);
    if (!current && !duplicate && existing.length >= 20) throw new AddressError("Você já tem 20 endereços. Exclua um para cadastrar outro.", 409);
    const id = current?.id ?? duplicate?.id ?? randomUUID();
    const isDefault = Boolean(options.makeDefault || current?.isDefault || duplicate?.isDefault || !existing.length);
    const now = new Date().toISOString();
    if (isDefault) await tx.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.userId, userId));
    if (duplicate) {
      // Repeated checkouts reuse the entry and preserve its user-assigned label.
      await tx.update(customerAddresses).set({ isDefault, updatedAt: now }).where(owned(userId, id));
    } else if (current) {
      await tx.update(customerAddresses).set({ ...address, fingerprint: identity, isDefault, updatedAt: now }).where(owned(userId, id));
    } else {
      await tx.insert(customerAddresses).values({ ...address, id, userId, fingerprint: identity, isDefault, createdAt: now, updatedAt: now });
    }
    const [saved] = await tx.select().from(customerAddresses).where(owned(userId, id));
    return publicAddress(saved);
  }, { behavior: "immediate" }));
}

export async function changeAddress(userId: string, id: string, action: "delete" | "default") {
  const db = await getDb();
  await retryWrite(() => db.transaction(async tx => {
    const [current] = await tx.select().from(customerAddresses).where(owned(userId, id));
    if (!current) throw new AddressError("Endereço não encontrado.", 404);
    const now = new Date().toISOString();
    if (action === "default") {
      await tx.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.userId, userId));
      await tx.update(customerAddresses).set({ isDefault: true, updatedAt: now }).where(owned(userId, id));
    } else {
      await tx.delete(customerAddresses).where(owned(userId, id));
      if (current.isDefault) {
        const [next] = await tx.select().from(customerAddresses).where(eq(customerAddresses.userId, userId))
          .orderBy(asc(customerAddresses.createdAt), asc(customerAddresses.id)).limit(1);
        if (next) await tx.update(customerAddresses).set({ isDefault: true, updatedAt: now }).where(owned(userId, next.id));
      }
    }
  }, { behavior: "immediate" }));
}
