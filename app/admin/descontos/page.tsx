import Link from "next/link";
import { desc, eq, like, and, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { coupons } from "../../../db/schema";
import { formatBrl } from "../../../lib/catalog";
import { NativeSubmitButton } from "../../components/PendingButton";

export const dynamic = "force-dynamic";
const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-[#0b2447]/20 bg-[#f7f3ea] px-3 text-sm focus:outline-2 focus:outline-[#b88a3b]";
const buttonClass =
  "rounded-full bg-[#0b2447] px-5 py-3 text-xs font-semibold text-white disabled:opacity-60";
type Coupon = typeof coupons.$inferSelect;
function localInput(iso: string | null) {
  return iso
    ? new Date(Date.parse(iso) - 3 * 60 * 60_000).toISOString().slice(0, 16)
    : "";
}
function dateLabel(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "Sem expiração";
}
function CouponForm({ coupon }: { coupon?: Coupon }) {
  return (
    <form
      action="/api/admin/coupons"
      method="post"
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="action" value={coupon ? "update" : "create"} />
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <label className="text-xs font-semibold">
        Código
        <input
          className={inputClass}
          name="code"
          required
          minLength={3}
          maxLength={40}
          pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,39}"
          defaultValue={coupon?.code}
          placeholder="BEMVINDO10"
          readOnly={Boolean(coupon?.allocatedUses)}
        />
      </label>
      <label className="text-xs font-semibold">
        Tipo de desconto
        <select
          className={inputClass}
          name="kind"
          defaultValue={coupon?.kind || "percent"}
        >
          <option value="percent">Percentual (%)</option>
          <option value="fixed">Valor fixo (R$)</option>
        </select>
      </label>
      <label className="text-xs font-semibold">
        Valor (% ou R$)
        <input
          className={inputClass}
          name="value"
          required
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={
            coupon
              ? coupon.kind === "percent"
                ? coupon.value
                : coupon.value / 100
              : 10
          }
        />
      </label>
      <label className="text-xs font-semibold">
        Compra mínima em produtos (R$)
        <input
          className={inputClass}
          name="minSubtotal"
          type="number"
          min="0"
          step="0.01"
          defaultValue={(coupon?.minSubtotalCents ?? 0) / 100}
        />
      </label>
      <label className="text-xs font-semibold">
        Desconto máximo (R$, opcional)
        <input
          className={inputClass}
          name="maxDiscount"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={
            coupon?.maxDiscountCents ? coupon.maxDiscountCents / 100 : ""
          }
        />
      </label>
      <label className="text-xs font-semibold">
        Limite total de usos, se reutilizável
        <input
          className={inputClass}
          name="maxUses"
          type="number"
          min={Math.max(1, coupon?.allocatedUses ?? 1)}
          step="1"
          placeholder="Vazio = ilimitado"
          defaultValue={
            coupon?.maxUses && coupon.maxUses > 1 ? coupon.maxUses : ""
          }
        />
      </label>
      <label className="text-xs font-semibold">
        Início (horário de Brasília)
        <input
          className={inputClass}
          name="startsAt"
          type="datetime-local"
          defaultValue={localInput(coupon?.startsAt ?? null)}
        />
      </label>
      <label className="text-xs font-semibold">
        Expiração (horário de Brasília)
        <input
          className={inputClass}
          name="expiresAt"
          type="datetime-local"
          defaultValue={localInput(coupon?.expiresAt ?? null)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={coupon?.active ?? true}
          className="accent-[#0b2447]"
        />
        Ativo
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="reusable"
          defaultChecked={coupon ? coupon.maxUses !== 1 : false}
          className="accent-[#0b2447]"
        />
        Reutilizável
      </label>
      <div className="sm:col-span-2">
        <NativeSubmitButton className={buttonClass} pendingLabel="Salvando…">
          {coupon ? "Salvar alterações" : "Criar cupom"}
        </NativeSubmitButton>
      </div>
    </form>
  );
}
export default async function DiscountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    source?: string;
    page?: string;
    message?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 40).toUpperCase();
  const source =
    params.source === "admin" || params.source === "game"
      ? params.source
      : undefined;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(params.page || "1", 10) || 1),
  );
  const db = await getDb();
  const filter = and(
    q ? like(coupons.code, `%${q.replace(/[%_\\]/g, "")}%`) : undefined,
    source ? eq(coupons.source, source) : undefined,
  );
  const rows = await db
    .select()
    .from(coupons)
    .where(filter)
    .orderBy(desc(coupons.createdAt))
    .limit(21)
    .offset((page - 1) * 20);
  const [stats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(coupons)
    .where(filter);
  const now = new Date().toISOString();
  const pageLink = (number: number) =>
    `/admin/descontos?${new URLSearchParams({ q, source: source || "", page: String(number) })}`;
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-10 text-[#0b2447] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-7 flex flex-wrap gap-5 text-sm">
          <Link href="/admin/pedidos">Pedidos e etiquetas</Link>
          <Link href="/comercial">Comercial</Link>
          <span className="font-bold" aria-current="page">
            Descontos
          </span>
        </nav>
        <div className="border-b border-[#0b2447]/15 pb-7">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">
            Área administrativa
          </p>
          <h1 className="mt-2 font-serif text-5xl">Descontos</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[#647087]">
            Crie cupons para a loja e acompanhe as recompensas do jogo. Um cupom
            por pedido; desconto somente nos produtos, sem alterar o frete.
          </p>
        </div>
        {params.message && (
          <p
            role="status"
            className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            {params.message}
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-900"
          >
            {params.error}
          </p>
        )}
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[.85fr_1.15fr]">
          <section className="rounded-2xl border border-[#0b2447]/10 bg-white p-6">
            <h2 className="mb-6 font-serif text-2xl">Novo cupom</h2>
            <CouponForm />
            <p className="mt-5 text-xs leading-5 text-[#647087]">
              Datas vazias não limitam a validade. Sem reutilização, o limite é
              um pedido. O desconto nunca ultrapassa o subtotal dos produtos.
              Percentuais aceitam números inteiros de 1 a 100.
            </p>
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#b88a3b]/25 bg-[#d8bc7b]/15 p-5">
              <h2 className="font-serif text-xl">Recompensas do jogo</h2>
              <p className="mt-2 text-xs leading-5">
                5%, 10%, 15% ou 30%, com chances de 40%, 30%, 20% e 10%,
                respectivamente, validade de 30 minutos e um único pedido.
                Reservamos o uso ao iniciar o pagamento e excluímos o cupom do
                jogo quando o pagamento é aprovado. Expirados são removidos na
                próxima geração ou pelo botão abaixo.
              </p>
              <form action="/api/admin/coupons" method="post" className="mt-3">
                <input type="hidden" name="action" value="cleanup" />
                <NativeSubmitButton
                  className="text-xs font-bold underline"
                  pendingLabel="Limpando…"
                >
                  Excluir expirados do jogo
                </NativeSubmitButton>
              </form>
            </div>
            <form className="flex flex-wrap items-end gap-3" method="get">
              <label className="min-w-0 flex-1 text-xs font-semibold">
                Buscar código
                <input className={inputClass} name="q" defaultValue={q} />
              </label>
              <label className="text-xs font-semibold">
                Origem
                <select
                  name="source"
                  defaultValue={source || ""}
                  className={inputClass}
                >
                  <option value="">Todas</option>
                  <option value="admin">Manual</option>
                  <option value="game">Jogo / API</option>
                </select>
              </label>
              <button className={buttonClass}>Filtrar</button>
            </form>
            <p className="text-xs text-[#647087]">
              {stats.count} cupom(ns) · Página {page}. Usos incluem reservas de
              pagamento. Excluir ou editar um cupom não altera pedidos já
              iniciados.
            </p>
            {rows.length === 0 && (
              <p className="rounded-2xl bg-white p-6 text-sm">
                Nenhum cupom encontrado.
              </p>
            )}
            {rows.slice(0, 20).map((coupon) => {
              const status = !coupon.active
                ? "Inativo"
                : coupon.expiresAt && coupon.expiresAt <= now
                  ? "Expirado"
                  : coupon.startsAt && coupon.startsAt > now
                    ? "Agendado"
                    : coupon.maxUses !== null &&
                        coupon.allocatedUses >= coupon.maxUses
                      ? "Esgotado / reservado"
                      : "Ativo";
              return (
                <article
                  key={coupon.id}
                  className="rounded-2xl border border-[#0b2447]/10 bg-white p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <h3 className="break-all font-mono text-sm font-bold">
                      {coupon.code}
                    </h3>
                    <strong className="text-[#936b25]">
                      {coupon.kind === "percent"
                        ? `${coupon.value}%`
                        : formatBrl(coupon.value)}
                    </strong>
                  </div>
                  <p className="mt-2 text-xs text-[#647087]">
                    {coupon.source === "game" ? "Jogo / API" : "Manual"} ·{" "}
                    {status} · {coupon.allocatedUses} / {coupon.maxUses ?? "∞"}{" "}
                    usos
                  </p>
                  <p className="mt-2 text-xs text-[#647087]">
                    Validade: {dateLabel(coupon.expiresAt)}
                  </p>
                  {coupon.source === "admin" && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-bold">
                        Editar cupom
                      </summary>
                      <div className="mt-5">
                        <CouponForm coupon={coupon} />
                      </div>
                    </details>
                  )}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs font-semibold text-red-700">
                      Excluir cupom
                    </summary>
                    <form
                      action="/api/admin/coupons"
                      method="post"
                      className="mt-3"
                    >
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={coupon.id} />
                      <p className="mb-3 text-xs text-[#647087]">
                        Esta exclusão impede novas compras com o código. O
                        histórico dos pedidos é preservado.
                      </p>
                      <NativeSubmitButton
                        className="rounded-full bg-red-700 px-4 py-2 text-xs font-bold text-white"
                        pendingLabel="Excluindo…"
                      >
                        Confirmar exclusão de {coupon.code}
                      </NativeSubmitButton>
                    </form>
                  </details>
                </article>
              );
            })}
            <nav
              className="flex justify-between text-sm"
              aria-label="Paginação de cupons"
            >
              {page > 1 ? (
                <Link href={pageLink(page - 1)}>← Anterior</Link>
              ) : (
                <span />
              )}
              {rows.length > 20 && (
                <Link href={pageLink(page + 1)}>Próxima →</Link>
              )}
            </nav>
          </section>
        </div>
      </div>
    </main>
  );
}
