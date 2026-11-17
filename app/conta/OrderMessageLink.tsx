import Link from "next/link";
import { MessageCircle } from "lucide-react";

export default function OrderMessageLink({ orderId, itemId, productName, unread = 0, dark = false }: {
  orderId: string;
  itemId: number;
  productName: string;
  unread?: number;
  dark?: boolean;
}) {
  return <Link href={`/conta/pedidos/${orderId}/itens/${itemId}/mensagens`}
    aria-label={`Falar com o vendedor sobre ${productName}${unread ? `, ${unread} ${unread === 1 ? "nova mensagem" : "novas mensagens"}` : ""}`}
    className={`mt-2 inline-flex min-h-11 flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#0b2447]/5 text-[#0b2447] hover:bg-[#0b2447]/10"}`}>
    <MessageCircle size={15} aria-hidden="true" />Falar com o vendedor
    {unread > 0 && <span className="rounded-full bg-[#d8bc7b] px-2 py-0.5 text-[0.6rem] text-[#0b2447]">{unread} {unread === 1 ? "nova" : "novas"}</span>}
  </Link>;
}
