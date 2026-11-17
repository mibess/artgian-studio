import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { z } from "zod";
import { hasAdminAccess } from "../../../../../../lib/admin-access";
import { getOrderMessageThread, OrderMessageError } from "../../../../../../lib/order-messages";
import type { OrderMessageThread } from "../../../../../../lib/order-message-types";
import OrderChat from "../../../../../components/OrderChat";
import { PageHeader } from "../../../_components";

export const dynamic = "force-dynamic";

export default async function SellerOrderMessagePage({
  params,
}: {
  params: Promise<{ orderId: string; itemId: string }>;
}) {
  if (!hasAdminAccess(await headers())) redirect("/admin/login");
  const { orderId, itemId } = await params;
  if (!z.uuid().safeParse(orderId).success || !/^[1-9]\d*$/.test(itemId) || !Number.isSafeInteger(Number(itemId))) notFound();
  let thread: OrderMessageThread;
  try {
    thread = await getOrderMessageThread(orderId, Number(itemId), { role: "seller" });
  } catch (error) {
    if (error instanceof OrderMessageError && error.status === 404) notFound();
    throw error;
  }

  return <>
    <Link href="/admin/mensagens" className="mb-6 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#74838a] hover:text-[#193244]"><ArrowLeft size={15} /> Mensagens de compras</Link>
    <PageHeader
      eyebrow={`Pedido #${thread.order.id.slice(0, 8)}`}
      title={`Conversa com ${thread.order.customerName}`}
      description="Envie orientações e acompanhe as dúvidas do cliente sobre este item."
      action={<Link href={`/admin/pedidos#pedido-${thread.order.id}`} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[#193244]/15 bg-white px-5 py-2.5 text-xs font-semibold"><PackageCheck size={16} /> Ver pedidos</Link>}
    />
    <section aria-label="Produto da conversa" className="mb-5 rounded-[20px] border border-[#e1e1db] bg-white px-5 py-4">
      <h2 className="break-words text-sm font-semibold text-[#294653]">{thread.item.productName}</h2>
      <p className="mt-1 break-words text-xs leading-5 text-[#74838a]">{thread.item.quantity} un. · {thread.item.color}{thread.item.personalization ? ` · “${thread.item.personalization}”` : ""}</p>
    </section>
    <OrderChat key={itemId} initialThread={thread} endpoint={`/api/admin/orders/${orderId}/items/${itemId}/messages`} viewer="seller" />
  </>;
}
