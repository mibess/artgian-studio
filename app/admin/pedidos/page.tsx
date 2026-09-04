import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders } from "../../../db/schema";
import { maskCpf } from "../../../lib/brazil";
import { formatBrl } from "../../../lib/catalog";
import { NativeSubmitButton } from "../../components/PendingButton";

export const dynamic = "force-dynamic";

type AdminOrdersPageProps = {
  searchParams: Promise<{ message?: string; error?: string }>;
};

function formatDate(value: string) {
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString(
    "pt-BR",
    { timeZone: "America/Sao_Paulo" },
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  const params = await searchParams;
  const db = await getDb();
  const rows = await db
    .select({ order: orders, item: orderItems })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  const isSandbox = process.env.MELHOR_ENVIO_ENVIRONMENT === "sandbox";

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-10 text-[#0b2447] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 border-b border-[#0b2447]/15 pb-7 sm:flex-row sm:items-end">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">
              Área administrativa
            </span>
            <h1 className="mt-2 font-serif text-4xl font-normal sm:text-5xl">
              Pedidos e etiquetas
            </h1>
          </div>
          <span className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${isSandbox ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-900"}`}>
            Melhor Envio: {isSandbox ? "SANDBOX" : "PRODUÇÃO BLOQUEADA"}
          </span>
        </div>

        {params.message && (
          <p className="mt-6 rounded-xl border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {params.message}
          </p>
        )}
        {params.error && (
          <p className="mt-6 rounded-xl border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-900">
            {params.error}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {rows.length === 0 && (
            <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#647087]">
              Nenhum pedido encontrado.
            </p>
          )}
          {rows.map(({ order, item }) => {
            const canCreateLabel =
              order.status === "paid" &&
              Boolean(order.customerDocument) &&
              !order.shippingLabelId;
            const canGenerateLabel =
              order.status === "paid" && Boolean(order.shippingLabelId) && !order.shippingLabelUrl;

            return (
              <article className="rounded-2xl border border-[#0b2447]/10 bg-white p-5 shadow-sm sm:p-6" key={`${order.id}:${item?.id ?? 0}`}>
                <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#647087]">
                      {formatDate(order.createdAt)} · {order.id.slice(0, 8)}
                    </p>
                    <h2 className="mt-2 font-serif text-2xl">{item?.productName ?? "Pedido"}</h2>
                    <p className="mt-1 text-xs text-[#647087]">
                      {order.customerName} · {maskCpf(order.customerDocument)}
                    </p>
                  </div>
                  <div className="text-sm">
                    <strong className="block">{formatBrl(order.totalCents)}</strong>
                    <span className="mt-1 block text-xs text-[#647087]">
                      {order.shippingCompanyName} · {order.shippingServiceName} · {formatBrl(order.shippingCents)}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="font-bold uppercase tracking-wide">Pedido: {order.status}</span>
                    <span className="mt-1 block text-[#647087]">
                      Etiqueta: {order.shippingLabelStatus || "não iniciada"}
                    </span>
                    {order.shippingLabelError && (
                      <span className="mt-2 block text-red-700">{order.shippingLabelError}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {canCreateLabel && (
                      <form action={`/api/admin/orders/${order.id}/label`} method="post">
                        <input type="hidden" name="action" value="create" />
                        <NativeSubmitButton pendingLabel="Comprando…" className="inline-flex items-center gap-2 rounded-full bg-[#0b2447] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                          Comprar etiqueta sandbox
                        </NativeSubmitButton>
                      </form>
                    )}
                    {canGenerateLabel && (
                      <form action={`/api/admin/orders/${order.id}/label`} method="post">
                        <input type="hidden" name="action" value="generate" />
                        <NativeSubmitButton pendingLabel="Gerando…" className="inline-flex items-center gap-2 rounded-full border border-[#0b2447]/20 px-4 py-2 text-xs font-semibold disabled:opacity-60">
                          Gerar etiqueta
                        </NativeSubmitButton>
                      </form>
                    )}
                    {order.shippingLabelUrl && (
                      <a className="rounded-full bg-[#b88a3b] px-4 py-2 text-xs font-semibold text-white" href={order.shippingLabelUrl} rel="noreferrer" target="_blank">
                        Abrir etiqueta
                      </a>
                    )}
                    {!order.customerDocument && order.status === "paid" && (
                      <span className="rounded-full bg-[#f7f3ea] px-4 py-2 text-xs text-[#647087]">
                        Pedido antigo sem CPF
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
