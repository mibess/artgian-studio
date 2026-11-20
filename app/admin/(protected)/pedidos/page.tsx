import Link from "next/link";
import { MessageCircleMore } from "lucide-react";
import { parseOrderQueue } from "../../../../lib/admin-order-view";
import { ADMIN_ORDERS_PAGE_SIZE, getAdminOrder, listAdminOrders } from "../../../../lib/admin-orders";
import { expireUnpaidOrdersQuietly } from "../../../../lib/order-expiration";
import { getConfiguredShippingProvider, getShippingProviderEnvironment, shippingProviderName } from "../../../../lib/shipping";
import { PageHeader } from "../_components";
import { OrdersWorkspace } from "./OrdersWorkspace";

export const dynamic = "force-dynamic";

type AdminOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const single = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const params = await searchParams;
  const queue = parseOrderQueue(single(params.fila));
  const query = (single(params.busca) ?? "").trim().slice(0, 80);
  const requestedPage = single(params.pagina) ?? "";
  const page = /^[1-9]\d{0,5}$/.test(requestedPage) ? Number(requestedPage) : 1;
  const focusId = single(params.pedido) ?? null;
  // Messages from the form fallback routes (used when JavaScript is unavailable).
  const notice = single(params.error)
    ? { ok: false, text: single(params.error)! }
    : single(params.message) ? { ok: true, text: single(params.message)! } : null;

  await expireUnpaidOrdersQuietly();
  const data = await listAdminOrders({ queue, query, page });
  const focusOrder = focusId && !data.orders.some(order => order.id === focusId) ? await getAdminOrder(focusId) : null;
  const provider = getConfiguredShippingProvider();
  const sandbox = getShippingProviderEnvironment(provider) === "sandbox";
  const toShip = data.totals["a-enviar"];

  return (
    <div className="text-[#193244]">
      <PageHeader
        eyebrow="Loja"
        title="Pedidos e entregas"
        description={toShip
          ? `${toShip} ${toShip === 1 ? "pedido pago aguarda" : "pedidos pagos aguardam"} produção ou envio.`
          : "Nenhum pedido pago aguardando envio. Tudo em dia."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/mensagens" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#193244]/15 bg-white px-3.5 text-xs font-semibold transition hover:border-[#193244]/35 sm:min-h-11 sm:px-4">
              <MessageCircleMore size={16} aria-hidden="true" /> <span>Mensagens<span className="hidden sm:inline"> de compras</span></span>
            </Link>
            <span
              title={`Etiquetas compradas pela ${shippingProviderName(provider)} em ambiente de ${sandbox ? "teste" : "produção"}`}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-xs font-semibold sm:min-h-11 sm:px-4 ${sandbox ? "bg-[#fbecc9] text-[#7a560f]" : "bg-white text-[#415967] ring-1 ring-[#193244]/10"}`}
            >
              <span aria-hidden="true" className={`size-2 rounded-full ${sandbox ? "bg-[#c8901f]" : "bg-[#2f8a66]"}`} />
              {shippingProviderName(provider)} · {sandbox ? "Sandbox" : "Produção"}
            </span>
          </div>
        }
      />

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`mb-5 rounded-xl px-4 py-3 text-sm ${notice.ok ? "bg-[#e6f3ec] text-[#1f5e46]" : "bg-[#fbe6e1] text-[#8c3727]"}`}>
          {notice.text}
        </p>
      )}

      <OrdersWorkspace
        orders={data.orders}
        focusOrder={focusOrder}
        queue={queue}
        query={query}
        counts={data.counts}
        page={data.page}
        pageCount={data.pageCount}
        pageSize={ADMIN_ORDERS_PAGE_SIZE}
        initialSelectedId={focusId && (focusOrder || data.orders.some(order => order.id === focusId)) ? focusId : null}
      />
    </div>
  );
}
