import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, MessageCircleMore, PackageCheck } from "lucide-react";
import { hasAdminAccess } from "../../../../lib/admin-access";
import { listOrderMessageInbox } from "../../../../lib/order-messages";
import { Avatar, EmptyState, PageHeader, formatDateTime } from "../_components";
import InboxRefresh from "./InboxRefresh";

export const dynamic = "force-dynamic";

export default async function OrderMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  if (!hasAdminAccess(await headers())) redirect("/admin/login");
  const params = await searchParams;
  const requestedPage = typeof params.page === "string" && /^[1-9]\d{0,5}$/.test(params.page) ? Number(params.page) : 1;
  const { threads, total, page, pageCount } = await listOrderMessageInbox(requestedPage);

  return <>
    <InboxRefresh />
    <PageHeader
      eyebrow="Atendimento da loja"
      title="Mensagens de compras"
      description="Converse com seus clientes sobre cada produto comprado. O histórico fica vinculado ao item e ao pedido."
      action={<Link href="/admin/pedidos" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[#193244]/15 bg-white px-5 py-2.5 text-xs font-semibold"><PackageCheck size={16} /> Ver pedidos</Link>}
    />
    <section aria-label="Conversas sobre compras" className="overflow-hidden rounded-[22px] border border-[#e1e1db] bg-white shadow-[0_8px_28px_rgba(32,52,60,.04)]">
      <header className="flex items-center justify-between gap-3 border-b border-[#ecece7] px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b979d]">Caixa de entrada</p>
          <h2 className="mt-1 text-base font-semibold">Conversas recentes</h2>
        </div>
        <span className="text-xs text-[#74838a]">{total} {total === 1 ? "conversa" : "conversas"}</span>
      </header>
      {threads.length ? <ul className="divide-y divide-[#efefea]">
        {threads.map((thread, index) => <li key={`${thread.orderId}-${thread.itemId}`}>
          <Link href={`/admin/mensagens/${thread.orderId}/${thread.itemId}`} className="flex min-h-24 items-start gap-3 px-5 py-5 transition hover:bg-[#faf9f6] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#b88a3b] sm:items-center">
            <Avatar name={thread.customerName} username={thread.customerName} index={index} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold text-[#294653]">{thread.customerName}</h3>
                {thread.unreadCount > 0 && <span className="rounded-full bg-[#f8ded5] px-2.5 py-1 text-[10px] font-bold text-[#9e4934]">{thread.unreadCount} {thread.unreadCount === 1 ? "nova mensagem" : "novas mensagens"}</span>}
              </div>
              <p className="mt-1 break-words text-xs font-medium text-[#415967]">{thread.productName} · {thread.color}</p>
              <p className="mt-1 text-[11px] text-[#8a959b]">Pedido #{thread.orderId.slice(0, 8)} · {formatDateTime(thread.updatedAt)}</p>
              <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5 text-[#74838a]">{thread.lastSender === "seller" ? "Você: " : ""}{thread.lastBody}</p>
            </div>
            <MessageCircleMore size={19} className="mt-1 shrink-0 text-[#b88a3b] sm:mt-0" aria-hidden="true" />
          </Link>
        </li>)}
      </ul> : <div className="p-5"><EmptyState title="Nenhuma conversa ainda" description="As mensagens enviadas pelos clientes na área Minha conta aparecerão aqui. Você também pode abrir uma conversa a partir de um pedido." /></div>}
      {pageCount > 1 && <nav aria-label="Páginas das mensagens" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ecece7] px-5 py-4 text-xs">
        <span className="text-[#74838a]">Página {page} de {pageCount}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={`/admin/mensagens?page=${page - 1}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#193244]/15 px-4 py-2 font-semibold"><ArrowLeft size={14} /> Anteriores</Link>}
          {page < pageCount && <Link href={`/admin/mensagens?page=${page + 1}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#193244]/15 px-4 py-2 font-semibold">Próximas <ArrowRight size={14} /></Link>}
        </div>
      </nav>}
    </section>
  </>;
}
