import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, MapPin, Package, RefreshCw, Truck } from "lucide-react";
import BrandHeader from "../../../components/BrandHeader";
import { getCustomerSession } from "../../../../lib/auth";
import { formatBrl } from "../../../../lib/catalog";
import { fulfillmentDate, fulfillmentStep, fulfillmentSteps } from "../../../../lib/fulfillment-status";
import { FulfillmentError, getCustomerFulfillment } from "../../../../lib/order-fulfillment";

export const metadata: Metadata = { title: "Acompanhar pedido | Artgian Studio", robots: { index: false, follow: false } };

export default async function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCustomerSession(await headers());
  if (!session) redirect(`/login?next=${encodeURIComponent(`/conta/pedidos/${id}`)}`);
  const { order, items, events } = await getCustomerFulfillment(id, session.user.id).catch(error => {
    if (error instanceof FulfillmentError && error.status === 404) notFound();
    throw error;
  });
  const paid = order.status === "paid";
  const current = fulfillmentStep(order.fulfillmentStatus);
  const currentIndex = fulfillmentSteps.findIndex(step => step.id === current.id);
  return <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
    <BrandHeader />
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
      <Link href="/conta" className="inline-flex items-center gap-2 text-xs font-semibold text-[#647087] hover:text-[#0b2447]"><ArrowLeft size={15} /> Meus pedidos</Link>
      <header className="mt-7 border-b border-[#0b2447]/15 pb-8">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">Da nossa criação até você</p>
        <h1 className="mt-3 font-serif text-[clamp(2.5rem,5vw,4rem)] leading-tight tracking-[-0.04em]">Acompanhe seu pedido.</h1>
        <p className="mt-3 text-sm text-[#647087]">Pedido <span className="font-mono font-semibold text-[#0b2447]">#{order.id.slice(0, 8)}</span></p>
      </header>
      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <div className="min-w-0 space-y-6">
          <section aria-label="Acompanhamento da entrega" className="rounded-[2rem] border border-white bg-white/80 p-6 shadow-[0_20px_60px_rgba(11,36,71,.06)] sm:p-9">
            {paid ? <>
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#b88a3b]">Etapa atual</p><h2 className="mt-3 font-serif text-3xl">{current.label}</h2></div>
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#d8bc7b]/20 text-[#9a722e]">{current.id === "delivered" ? <Check size={23} /> : <Package size={23} />}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#647087]">{current.description}</p>
              {order.fulfillmentNote && <div className="mt-5 rounded-2xl border border-[#d8bc7b]/40 bg-[#f7f3ea] p-4"><p className="text-xs font-semibold">Uma atualização da Artgian</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#647087]">{order.fulfillmentNote}</p></div>}
              <ol aria-label="Etapas do pedido" className="mt-8">
                {fulfillmentSteps.map((step, index) => <li key={step.id} aria-current={index === currentIndex ? "step" : undefined} className="relative flex gap-4 pb-7 last:pb-0">
                  {index < fulfillmentSteps.length - 1 && <span aria-hidden="true" className={`absolute top-9 bottom-0 left-[17px] w-px ${index < currentIndex ? "bg-[#b88a3b]" : "bg-[#0b2447]/15"}`} />}
                  <span aria-hidden="true" className={`relative grid size-9 shrink-0 place-items-center rounded-full border text-xs font-semibold ${index < currentIndex ? "border-[#0b2447] bg-[#0b2447] text-white" : index === currentIndex ? "border-[#b88a3b] bg-[#d8bc7b]/20 text-[#0b2447] ring-4 ring-[#d8bc7b]/10" : "border-[#0b2447]/15 text-[#647087]"}`}>{index < currentIndex ? <Check size={16} /> : index + 1}</span>
                  <div className="min-w-0 pt-1.5"><p className={`text-sm ${index <= currentIndex ? "font-semibold" : "text-[#647087]"}`}>{step.label}{index === currentIndex && <span className="ml-2 rounded-full bg-[#d8bc7b]/25 px-2 py-1 text-[0.6rem] font-bold text-[#846023]">Atual</span>}</p></div>
                </li>)}
              </ol>
              {order.shippingTrackingCode && <div className="mt-8 rounded-2xl bg-[#0b2447]/5 p-5"><p className="flex items-center gap-2 text-xs font-semibold"><Truck size={16} /> Código de rastreio</p><p className="mt-3 break-all font-mono text-sm font-semibold">{order.shippingTrackingCode}</p><p className="mt-2 text-xs text-[#647087]">{[order.shippingCompanyName, order.shippingServiceName].filter(Boolean).join(" · ")}</p></div>}
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#0b2447]/10 pt-5">
                <p className="text-xs leading-5 text-[#647087]">{order.fulfillmentUpdatedAt ? `Atualizado em ${fulfillmentDate(order.fulfillmentUpdatedAt)}` : "As próximas atualizações aparecerão aqui."}</p>
                <a href={`/conta/pedidos/${order.id}`} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold underline underline-offset-4"><RefreshCw size={14} /> Atualizar acompanhamento</a>
              </div>
            </> : <>
              <h2 className="font-serif text-3xl">{order.status === "pending" ? "Aguardando pagamento" : "Confira seu pagamento"}</h2>
              <p className="mt-4 text-sm leading-6 text-[#647087]">{order.status === "pending" ? "O acompanhamento da entrega começa assim que o pagamento for aprovado." : "O pagamento deste pedido foi cancelado, recusado, estornado ou está em contestação. Confira os detalhes na sua conta."}</p>
              <Link href="/conta" className="mt-6 inline-flex rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white">Ver meus pedidos</Link>
            </>}
          </section>
          {paid && events.length > 0 && <section className="rounded-[2rem] border border-white bg-white/65 p-6 sm:p-9" aria-label="Histórico de atualizações">
            <h2 className="font-serif text-2xl">Atualizações do pedido.</h2>
            <ol className="mt-5 divide-y divide-[#0b2447]/10">{events.map(event => <li key={event.id} className="py-4 first:pt-0 last:pb-0"><p className="text-sm font-semibold">{fulfillmentStep(event.status).label}</p><time dateTime={event.createdAt} className="mt-1 block text-xs text-[#647087]">{fulfillmentDate(event.createdAt)}</time>{event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#647087]">{event.note}</p>}</li>)}</ol>
          </section>}
        </div>
        <aside aria-label="Resumo do pedido" className="min-w-0 rounded-[2rem] bg-[#0b2447] p-6 text-white shadow-[0_24px_70px_rgba(11,36,71,.16)] sm:p-8">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#d8bc7b]">Preparado para você</p><h2 className="mt-3 font-serif text-3xl">Seu pedido.</h2>
          <ul className="mt-6 divide-y divide-white/10">{items.map(item => <li key={item.id} className="py-4 first:pt-0"><p className="text-sm font-semibold">{item.productName}</p><p className="mt-1 break-words text-xs leading-5 text-white/60">{item.quantity} un. · {item.color}{item.personalization ? ` · “${item.personalization}”` : ""}</p></li>)}</ul>
          <div className="mt-4 flex justify-between gap-4 border-t border-white/15 pt-5"><span className="text-sm text-white/60">Total com frete</span><strong className="font-serif text-2xl font-normal text-[#d8bc7b]">{formatBrl(order.totalCents)}</strong></div>
          <div className="mt-7 flex items-start gap-3 rounded-2xl bg-white/5 p-4"><MapPin size={17} className="mt-0.5 shrink-0 text-[#d8bc7b]" /><div className="min-w-0 break-words text-xs leading-5"><p className="font-semibold">Entrega para {order.customerName}</p><p className="mt-1 text-white/60">{order.streetAddress}, {order.addressNumber}{order.addressComplement ? ` · ${order.addressComplement}` : ""}<br />{order.neighborhood} · {order.city}/{order.state}<br />CEP {order.postalCode.replace(/(\d{5})(\d{3})/, "$1-$2")}</p></div></div>
          <Link href="/produtos" className="mt-6 inline-flex text-xs text-white/65 underline underline-offset-4">Continuar comprando</Link>
        </aside>
      </div>
    </div>
  </main>;
}
