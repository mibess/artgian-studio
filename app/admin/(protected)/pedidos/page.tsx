import { desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";
import { maskCpf } from "../../../../lib/brazil";
import { formatBrl } from "../../../../lib/catalog";
import {
  getConfiguredShippingProvider,
  getShippingProviderEnvironment,
  resolveShippingProvider,
  shippingProviderName,
} from "../../../../lib/shipping";
import { hasFullName } from "../../../../lib/brazil";
import { NativeSubmitButton } from "../../../components/PendingButton";
import { fulfillmentDate, fulfillmentStep, fulfillmentSteps } from "../../../../lib/fulfillment-status";

export const dynamic = "force-dynamic";

type AdminOrdersPageProps = {
  searchParams: Promise<{ message?: string; error?: string; page?: string; updatedOrder?: string }>;
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
  const page = /^\d{1,6}$/.test(params.page ?? "") ? Math.max(1, Number(params.page)) : 1;
  const db = await getDb();
  const pageOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(51)
    .offset((page - 1) * 50);
  const recentOrders = pageOrders.slice(0, 50);
  const feedbackOrderId = recentOrders.some(order => order.id === params.updatedOrder) ? params.updatedOrder : undefined;
  const items = recentOrders.length
    ? await db
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            recentOrders.map((order) => order.id),
          ),
        )
    : [];
  const rows = recentOrders.map((order) => ({
    order,
    items: items.filter((item) => item.orderId === order.id),
  }));
  const configuredProvider = getConfiguredShippingProvider();
  const configuredEnvironment =
    getShippingProviderEnvironment(configuredProvider);
  const isSandbox = configuredEnvironment === "sandbox";

  return (
    <div className="text-[#193244]">
      <div className="mx-auto w-full">
        <div className="flex flex-col justify-between gap-4 border-b border-[#0b2447]/15 pb-7 sm:flex-row sm:items-end">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">
              Área administrativa
            </span>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Pedidos, entregas e etiquetas
            </h1>
          </div>
          <span
            className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${isSandbox ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-900"}`}
          >
            {shippingProviderName(configuredProvider)}: {isSandbox ? "SANDBOX" : "PRODUÇÃO"}
          </span>
        </div>

        {params.message && !feedbackOrderId && (
          <p className="mt-6 rounded-xl border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {params.message}
          </p>
        )}
        {params.error && !feedbackOrderId && (
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
          {rows.map(({ order, items }) => {
            const orderProvider = resolveShippingProvider(
              order.shippingProvider,
            );
            const orderProviderEnvironment =
              getShippingProviderEnvironment(orderProvider);
            const canCreateLabel =
              order.status === "paid" &&
              Boolean(order.customerDocument) &&
              !order.shippingLabelId;
            const canGenerateLabel =
              order.status === "paid" &&
              Boolean(order.shippingLabelId) &&
              !order.shippingLabelUrl;

            return (
              <article
                className="rounded-2xl border border-[#0b2447]/10 bg-white p-5 shadow-sm sm:p-6"
                key={order.id}
                id={`pedido-${order.id}`}
              >
                {feedbackOrderId === order.id && params.message && <p role="status" className="mb-5 rounded-xl border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{params.message}</p>}
                {feedbackOrderId === order.id && params.error && <p role="alert" className="mb-5 rounded-xl border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-900">{params.error}</p>}
                <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#647087]">
                      {formatDate(order.createdAt)} · {order.id.slice(0, 8)}
                    </p>
                    <h2 className="mt-2 font-serif text-2xl">
                      Pedido #{order.id.slice(0, 8)}
                    </h2>
                    <ul className="mt-2 space-y-1 text-xs text-[#647087]">
                      {items.map((item) => (
                        <li key={item.id}>
                          {item.quantity} × {item.productName} · {item.color}
                          {item.personalization
                            ? ` · “${item.personalization}”`
                            : ""}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs text-[#647087]">
                      {order.customerName} · {maskCpf(order.customerDocument)}
                    </p>
                  </div>
                  <div className="text-sm">
                    <strong className="block">
                      {formatBrl(order.totalCents)}
                    </strong>
                    {order.discountCents > 0 && (
                      <span className="mt-1 block text-xs text-emerald-800">
                        Cupom {order.couponCode}: −
                        {formatBrl(order.discountCents)}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-[#647087]">
                      {shippingProviderName(orderProvider)} · {order.shippingCompanyName} · {order.shippingServiceName}{" "}
                      · {formatBrl(order.shippingCents)}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="font-bold uppercase tracking-wide">
                      Pedido: {order.status}
                    </span>
                    <span className="mt-1 block text-[#647087]">
                      Etiqueta: {order.shippingLabelStatus || "não iniciada"}
                    </span>
                    {order.shippingLabelError && (
                      <span className="mt-2 block text-red-700">
                        {order.shippingLabelError}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {canCreateLabel && (
                      <form
                        action={`/api/admin/orders/${order.id}/label`}
                        className="flex max-w-64 flex-col gap-2"
                        method="post"
                      >
                        <input type="hidden" name="action" value="create" />
                        {!hasFullName(order.customerName) && (
                          <label className="text-[0.65rem] font-semibold text-[#647087]">
                            Nome e sobrenome do destinatário
                            <input
                              className="mt-1 h-9 w-full rounded-lg border border-[#0b2447]/20 bg-white px-3 text-xs text-[#0b2447] outline-none focus:border-[#b88a3b]"
                              defaultValue={order.customerName}
                              name="recipientName"
                              placeholder="Nome completo"
                              required
                            />
                          </label>
                        )}
                        <NativeSubmitButton
                          pendingLabel="Comprando…"
                          className="inline-flex items-center gap-2 rounded-full bg-[#0b2447] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Comprar etiqueta
                          {orderProviderEnvironment === "sandbox"
                            ? " sandbox"
                            : ""}
                        </NativeSubmitButton>
                      </form>
                    )}
                    {canGenerateLabel && (
                      <form
                        action={`/api/admin/orders/${order.id}/label`}
                        method="post"
                      >
                        <input type="hidden" name="action" value="generate" />
                        <NativeSubmitButton
                          pendingLabel="Gerando…"
                          className="inline-flex items-center gap-2 rounded-full border border-[#0b2447]/20 px-4 py-2 text-xs font-semibold disabled:opacity-60"
                        >
                          Gerar etiqueta
                        </NativeSubmitButton>
                      </form>
                    )}
                    {order.shippingLabelUrl && (
                      <a
                        className="rounded-full bg-[#b88a3b] px-4 py-2 text-xs font-semibold text-white"
                        href={order.shippingLabelUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
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
                {order.status === "paid" && <section aria-label={`Acompanhamento do pedido ${order.id.slice(0, 8)}`} className="mt-6 border-t border-[#0b2447]/10 pt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="text-sm font-semibold">Acompanhamento da entrega</h3><p className="text-xs text-[#647087]">{fulfillmentStep(order.fulfillmentStatus).label}{order.fulfillmentUpdatedAt ? ` · ${fulfillmentDate(order.fulfillmentUpdatedAt)}` : ""}</p></div>
                  <form action={`/api/admin/orders/${order.id}/fulfillment?page=${page}`} method="post" className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="revision" value={order.fulfillmentRevision} />
                    <label className="text-xs font-semibold">Etapa do pedido<select name="status" defaultValue={order.fulfillmentStatus} className="mt-2 h-11 w-full rounded-xl border border-[#0b2447]/20 bg-white px-3 text-sm" required>{fulfillmentSteps.map(step => <option key={step.id} value={step.id}>{step.label}</option>)}</select></label>
                    <label className="text-xs font-semibold">Código de rastreio (opcional)<input name="trackingCode" defaultValue={order.shippingTrackingCode ?? ""} maxLength={80} placeholder="Código informado pela transportadora" className="mt-2 h-11 w-full rounded-xl border border-[#0b2447]/20 bg-white px-3 text-sm" /></label>
                    <label className="text-xs font-semibold sm:col-span-2">Observação para o cliente (opcional)<textarea name="note" defaultValue={order.fulfillmentNote ?? ""} maxLength={500} rows={2} placeholder="Ex.: Sua peça ficou pronta e será enviada amanhã." className="mt-2 w-full rounded-xl border border-[#0b2447]/20 bg-white p-3 text-sm font-normal" /></label>
                    <div className="flex flex-wrap items-center gap-4 sm:col-span-2"><NativeSubmitButton pendingLabel="Atualizando…" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0b2447] px-5 py-2 text-xs font-semibold text-white disabled:opacity-60">Atualizar acompanhamento</NativeSubmitButton><p className="text-xs leading-5 text-[#647087]">A etapa e a observação ficam visíveis ao cliente. As alterações são guardadas no histórico.</p></div>
                  </form>
                </section>}
              </article>
            );
          })}
        </div>
        <nav aria-label="Páginas de pedidos" className="mt-7 flex flex-wrap items-center justify-between gap-4 text-sm">
          {page > 1 ? <Link href={`/admin/pedidos?page=${page - 1}`} className="rounded-full border border-[#0b2447]/20 px-5 py-3 font-semibold">Pedidos mais recentes</Link> : <span />}
          <span className="text-xs text-[#647087]">Página {page}</span>
          {pageOrders.length > 50 ? <Link href={`/admin/pedidos?page=${page + 1}`} className="rounded-full border border-[#0b2447]/20 px-5 py-3 font-semibold">Pedidos anteriores</Link> : <span />}
        </nav>
      </div>
    </div>
  );
}
