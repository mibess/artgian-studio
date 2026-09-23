import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Check, MapPin, Package } from "lucide-react";
import { getDb } from "../../../db";
import { orderItems } from "../../../db/schema";
import { getCustomerSession } from "../../../lib/auth";
import { formatBrl } from "../../../lib/catalog";
import { getOwnedPaymentOrder, getPaymentState, PaymentError } from "../../../lib/embedded-payments";
import BrandHeader from "../../components/BrandHeader";
import PaymentPanel from "./PaymentPanel";

export const metadata: Metadata = { title: "Pagamento | Artgian Studio" };

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const { pedido } = await searchParams;
  if (!pedido) redirect("/comprar");
  const session = await getCustomerSession(await headers());
  if (!session) redirect(`/login?next=${encodeURIComponent(`/comprar/pagamento?pedido=${pedido}`)}`);
  const order = await getOwnedPaymentOrder(pedido, session.user.id).catch(error => {
    if (error instanceof PaymentError && error.status === 404) notFound();
    throw error;
  });
  const state = await getPaymentState(order.id, session.user.id);
  const items = await (await getDb()).select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY?.trim() ?? "";
  return <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
    <BrandHeader />
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
      <div className="mb-8 flex flex-col justify-between gap-5 border-b border-[#0b2447]/15 pb-8 sm:flex-row sm:items-end">
        <div><span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">Checkout seguro</span><h1 className="mt-3 font-serif text-[clamp(2.7rem,5vw,4.5rem)] font-normal leading-none tracking-[-0.045em]">Seu pagamento.</h1></div>
        <div className="flex items-center gap-3 text-xs text-[#647087]"><span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#b88a3b]" /> Dados e entrega</span><span className="h-px w-6 bg-[#b88a3b]/40" /><span className="font-semibold text-[#0b2447]">Pagamento</span></div>
      </div>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
        {publicKey || state.attemptId ? <PaymentPanel initialState={state} publicKey={publicKey} payer={{ name: order.customerName, email: order.customerEmail, document: order.customerDocument ?? "" }} /> : <section className="rounded-[2rem] bg-white/80 p-8"><h2 className="font-serif text-2xl">Pagamento temporariamente indisponível.</h2><p className="mt-3 text-sm leading-6 text-[#647087]">Seu pedido está salvo. Tente novamente em instantes.</p></section>}
        <aside className="min-w-0 rounded-[2rem] bg-[#0b2447] p-6 text-white shadow-[0_24px_70px_rgba(11,36,71,.16)] sm:p-8 lg:sticky lg:top-6" aria-label="Resumo do pedido">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#d8bc7b]">Preparado para você</p>
          <h2 className="mt-3 font-serif text-3xl">Seu pedido.</h2>
          <p className="mt-2 font-mono text-xs text-white/50">#{order.id.slice(0, 8)}</p>
          <div className="mt-7 divide-y divide-white/10">{items.map(item => <div key={item.id} className="flex gap-3 py-4 first:pt-0"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 text-[#d8bc7b]"><Package size={19} strokeWidth={1.5} /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.productName}</p><p className="mt-1 text-xs leading-5 text-white/55">{item.quantity} un. · {item.color}{item.personalization ? ` · “${item.personalization}”` : ""}</p></div><span className="text-xs font-semibold">{formatBrl(item.unitPriceCents * item.quantity)}</span></div>)}</div>
          <dl className="mt-5 space-y-3 border-t border-white/15 pt-5 text-sm"><div className="flex justify-between gap-4"><dt className="text-white/60">Produtos</dt><dd>{formatBrl(order.subtotalCents)}</dd></div>{order.discountCents > 0 && <div className="flex justify-between gap-4 text-[#d8bc7b]"><dt>Cupom {order.couponCode}</dt><dd>−{formatBrl(order.discountCents)}</dd></div>}<div className="flex justify-between gap-4"><dt className="text-white/60">Entrega</dt><dd>{order.shippingCents ? formatBrl(order.shippingCents) : "Grátis"}</dd></div><div className="flex items-baseline justify-between gap-4 border-t border-white/15 pt-5"><dt className="font-medium">Total do pedido</dt><dd className="font-serif text-3xl text-[#d8bc7b]">{formatBrl(order.totalCents)}</dd></div></dl>
          <p className="mt-2 text-right text-[0.6rem] text-white/50">Eventuais juros do cartão aparecem no parcelamento.</p>
          <div className="mt-7 flex items-start gap-3 rounded-2xl bg-white/5 p-4"><MapPin size={17} className="mt-0.5 shrink-0 text-[#d8bc7b]" /><div className="text-xs leading-5"><p className="font-semibold">Entrega para {order.customerName}</p><p className="mt-1 text-white/60">{order.streetAddress}, {order.addressNumber}{order.addressComplement ? ` · ${order.addressComplement}` : ""}<br />{order.neighborhood} · {order.city}/{order.state}<br />CEP {order.postalCode.replace(/(\d{5})(\d{3})/, "$1-$2")}</p><p className="mt-2 text-[#d8bc7b]">{order.shippingServiceName}</p></div></div>
          <Link href="/produtos" className="mt-6 inline-flex text-xs text-white/65 underline underline-offset-4 hover:text-white">Continuar comprando</Link>
        </aside>
      </div>
    </div>
  </main>;
}
