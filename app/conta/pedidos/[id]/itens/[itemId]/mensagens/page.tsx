import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import BrandHeader from "../../../../../../components/BrandHeader";
import OrderChat from "../../../../../../components/OrderChat";
import { getCustomerSession } from "../../../../../../../lib/auth";
import { getOrderMessageThread, OrderMessageError } from "../../../../../../../lib/order-messages";

export const metadata: Metadata = {
  title: "Conversa com o vendedor | Artgian Studio",
  robots: { index: false, follow: false },
};

export default async function CustomerOrderMessages({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  if (!/^[1-9]\d*$/.test(itemId) || !Number.isSafeInteger(Number(itemId))) notFound();
  const session = await getCustomerSession(await headers());
  if (!session) redirect(`/login?next=${encodeURIComponent(`/conta/pedidos/${id}/itens/${itemId}/mensagens`)}`);
  const thread = await getOrderMessageThread(id, Number(itemId), { role: "customer", userId: session.user.id }).catch(error => {
    if (error instanceof OrderMessageError && [400, 404].includes(error.status)) notFound();
    throw error;
  });
  return <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
    <BrandHeader />
    <div className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-10">
      <Link href="/conta" className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#647087] hover:text-[#0b2447]"><ArrowLeft size={15} /> Meus pedidos</Link>
      <header className="mt-4 mb-6">
        <p className="text-[0.6rem] font-bold uppercase tracking-[.22em] text-[#b88a3b]">Cuidado em cada detalhe</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">Conversa com o vendedor</h1>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#0b2447]/10 bg-white/65 p-4">
          <Package size={22} strokeWidth={1.5} className="mt-1 shrink-0 text-[#b88a3b]" />
          <div className="min-w-0"><h2 className="break-words text-sm font-semibold">{thread.item.productName}</h2>
            <p className="mt-1 break-words text-xs leading-5 text-[#647087]">{thread.item.quantity} {thread.item.quantity === 1 ? "unidade" : "unidades"} · {thread.item.color}{thread.item.personalization ? ` · “${thread.item.personalization}”` : ""}</p>
            <Link href={`/conta/pedidos/${id}`} className="mt-2 inline-flex min-h-8 items-center text-xs text-[#647087] underline underline-offset-4">Pedido #{id.slice(0, 8)}</Link>
          </div>
        </div>
      </header>
      <OrderChat key={itemId} initialThread={thread} endpoint={`/api/orders/${id}/items/${itemId}/messages`} viewer="customer" />
      <p className="mt-4 text-center text-xs leading-5 text-[#647087]">Esta conversa é exclusiva sobre este item do seu pedido.</p>
    </div>
  </main>;
}
