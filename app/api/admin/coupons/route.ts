import { requestOrigin } from "../../../../lib/request-origin";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { coupons } from "../../../../db/schema";
import { hasAdminAccess } from "../../../../lib/admin-access";
import {
  adminCouponSchema,
  cleanupExpiredGameCoupons,
  CouponError,
} from "../../../../lib/coupons";

function optionalInteger(value: FormDataEntryValue | null) {
  return value ? Number(value) : null;
}
function cents(value: FormDataEntryValue | null) {
  const text = String(value || "0").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(text) ? Math.round(Number(text) * 100) : NaN;
}
function date(value: FormDataEntryValue | null) {
  if (!value) return null;
  const raw = String(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw))
    throw new CouponError("Data inválida.");
  const parsed = new Date(`${raw}:00-03:00`);
  if (!Number.isFinite(parsed.getTime()))
    throw new CouponError("Data inválida.");
  return parsed.toISOString();
}
export async function POST(request: Request) {
  if (!hasAdminAccess(request.headers))
    return Response.json(
      { error: "Autenticação necessária." },
      { status: 401 },
    );
  if (request.headers.get("origin") !== requestOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  const target = new URL("/admin/descontos", requestOrigin(request));
  try {
    const form = await request.formData();
    const action = form.get("action");
    const db = await getDb();
    if (action === "cleanup") {
      const count = await cleanupExpiredGameCoupons(db);
      target.searchParams.set(
        "message",
        `${count} cupom(ns) expirado(s) do jogo excluído(s).`,
      );
    } else if (action === "delete") {
      const deleted = await db
        .delete(coupons)
        .where(eq(coupons.id, String(form.get("id"))))
        .returning();
      if (!deleted.length) throw new CouponError("Cupom não encontrado.");
      target.searchParams.set(
        "message",
        "Cupom excluído. Pedidos existentes mantêm o desconto contratado.",
      );
    } else if (action === "create" || action === "update") {
      const parsed = adminCouponSchema.safeParse({
        code: form.get("code"),
        kind: form.get("kind"),
        value:
          form.get("kind") === "percent"
            ? Number(form.get("value"))
            : cents(form.get("value")),
        active: form.get("active") === "on",
        startsAt: date(form.get("startsAt")),
        expiresAt: date(form.get("expiresAt")),
        maxUses:
          form.get("reusable") === "on"
            ? optionalInteger(form.get("maxUses"))
            : 1,
        minSubtotalCents: cents(form.get("minSubtotal")),
        maxDiscountCents: form.get("maxDiscount")
          ? cents(form.get("maxDiscount"))
          : null,
      });
      if (!parsed.success)
        throw new CouponError(
          parsed.error.issues.map((issue) => issue.message).join(" "),
        );
      const now = new Date().toISOString();
      if (action === "create") {
        await db.insert(coupons).values({
          ...parsed.data,
          id: crypto.randomUUID(),
          source: "admin",
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const id = String(form.get("id"));
        await db.transaction(
          async (tx) => {
            const [existing] = await tx
              .select()
              .from(coupons)
              .where(eq(coupons.id, id))
              .limit(1);
            if (!existing || existing.source !== "admin")
              throw new CouponError(
                "Somente cupons manuais podem ser editados.",
              );
            if (
              parsed.data.maxUses !== null &&
              parsed.data.maxUses < existing.allocatedUses
            )
              throw new CouponError(
                "O limite não pode ser menor que os usos e reservas existentes.",
              );
            if (
              existing.allocatedUses > 0 &&
              parsed.data.code !== existing.code
            )
              throw new CouponError(
                "O código não pode mudar depois de usado ou reservado.",
              );
            await tx
              .update(coupons)
              .set({ ...parsed.data, updatedAt: now })
              .where(and(eq(coupons.id, id), eq(coupons.source, "admin")));
          },
          { behavior: "immediate" },
        );
      }
      target.searchParams.set("message", "Cupom salvo.");
    } else {
      throw new CouponError("Ação inválida.");
    }
  } catch (error) {
    const message =
      error instanceof CouponError
        ? error.message
        : String(error).includes("UNIQUE") || String(error).includes("unique")
          ? "Já existe um cupom com este código."
          : "Não foi possível salvar o cupom. Confira os campos e tente novamente.";
    target.searchParams.set("error", message);
  }
  return Response.redirect(target, 303);
}
