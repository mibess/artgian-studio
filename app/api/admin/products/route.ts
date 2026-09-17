import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../db";
import { auditLogs, catalogProducts } from "../../../../db/schema";
import { hasAdminAccess } from "../../../../lib/admin-access";
import { requestOrigin } from "../../../../lib/request-origin";
import { productInputSchema } from "../../../../lib/products/schema";
import { parseStorefront } from "../../../../lib/products/repository";
export async function POST(request: Request) {
  if (!hasAdminAccess(request.headers))
    return Response.json(
      { error: "Autenticação necessária." },
      { status: 401 },
    );
  if (request.headers.get("origin") !== requestOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 150_000)
      return Response.json(
        { error: "O cadastro excede o tamanho permitido." },
        { status: 413 },
      );
    const parsed = productInputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    const p = parsed.data;
    const db = await getDb();
    const [existing] = p.id
      ? await db
          .select()
          .from(catalogProducts)
          .where(eq(catalogProducts.id, p.id))
          .limit(1)
      : [];
    if (p.id && !existing)
      return Response.json(
        { error: "Produto não encontrado." },
        { status: 404 },
      );
    const previous = parseStorefront(existing?.storefront || null);
    if (previous && p.storefront?.slug !== previous.slug)
      return Response.json(
        { error: "O endereço de produtos existentes deve ser preservado." },
        { status: 400 },
      );
    if (p.storefront && !previous) {
      const all = await db
        .select({ storefront: catalogProducts.storefront })
        .from(catalogProducts);
      if (
        all.some(
          (row) => parseStorefront(row.storefront)?.slug === p.storefront!.slug,
        )
      )
        return Response.json(
          { error: "Este endereço já pertence a outro produto." },
          { status: 409 },
        );
    }
    const id = existing?.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const values = {
      name: p.name,
      category: p.category || null,
      description: p.description || null,
      active: p.active,
      pricingType: p.pricingType,
      basePriceCents: p.pricingType === "fixed" ? p.basePriceCents : null,
      priceFromCents: p.pricingType === "from" ? p.priceFromCents : null,
      productionTime: p.productionTime || null,
      minimumQuantity: p.minimumQuantity,
      maximumQuantity: p.maximumQuantity,
      aliases: JSON.stringify(p.aliases),
      materials: JSON.stringify(p.materials),
      availableSizes: JSON.stringify(p.availableSizes),
      verifiedClaims: JSON.stringify(p.verifiedClaims),
      notes: p.notes || null,
      storeId: existing?.storeId || p.storefront?.slug || null,
      storefront: p.storefront ? JSON.stringify(p.storefront) : null,
      images: p.storefront
        ? JSON.stringify(p.storefront.presentation.media.map((m) => m.src))
        : existing?.images || "[]",
      availableColors: p.storefront
        ? JSON.stringify(p.storefront.variants.map((v) => v.name))
        : JSON.stringify(p.availableColors),
      customizationOptions: p.storefront
        ? JSON.stringify(
            p.storefront.personalization.enabled
              ? [
                  `${p.storefront.personalization.label}: até ${p.storefront.personalization.maxLength} caracteres`,
                ]
              : [],
          )
        : JSON.stringify(p.customizationOptions),
      updatedAt: now,
    };
    const saved = await db.transaction(async (tx) => {
      const rows = existing
        ? await tx
            .update(catalogProducts)
            .set({ ...values, version: sql`${catalogProducts.version}+1` })
            .where(
              and(
                eq(catalogProducts.id, id),
                eq(catalogProducts.version, p.version),
              ),
            )
            .returning({ version: catalogProducts.version })
        : await tx
            .insert(catalogProducts)
            .values({ id, ...values, version: 1, createdAt: now })
            .returning({ version: catalogProducts.version });
      if (!rows.length) return null;
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "admin",
        action: existing ? "product_updated" : "product_created",
        entityType: "product",
        entityId: id,
        metadata: JSON.stringify({
          version: rows[0].version,
          fields: Object.keys(values),
          previousPriceCents: existing?.basePriceCents ?? null,
          priceCents: values.basePriceCents,
          active: p.active,
        }),
        createdAt: now,
      });
      return rows[0];
    });
    if (!saved)
      return Response.json(
        {
          error:
            "Este produto foi alterado em outra aba. Recarregue antes de salvar.",
        },
        { status: 409 },
      );
    revalidatePath("/", "layout");
    return Response.json({
      id,
      version: saved.version,
      message:
        "Produto salvo. Loja e atendimento já usam o cadastro atualizado.",
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: "Cadastro inválido." }, { status: 400 });
    if (/unique|constraint/i.test(String(error)))
      return Response.json(
        { error: "Já existe um produto com esse nome ou endereço." },
        { status: 409 },
      );
    console.error("Falha ao salvar produto", error);
    return Response.json(
      { error: "Não foi possível salvar o produto." },
      { status: 500 },
    );
  }
}
