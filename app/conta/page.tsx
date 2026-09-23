import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { count, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, ArrowRight, ChevronDown, Package, ShoppingBag } from "lucide-react";
import { getCustomerSession } from "../../lib/auth";
import { getDb } from "../../db";
import { orders, orderItems } from "../../db/schema";
import { formatBrl, type ProductCatalog } from "../../lib/catalog";
import { getProductCatalog } from "../../lib/products/repository";
import BrandHeader from "../components/BrandHeader";
import SignOutButton from "./SignOutButton";
import AddressBook from "./AddressBook";
import AccountTabs from "./AccountTabs";
import OrderThumbnail from "./OrderThumbnail";
import { listAddresses } from "../../lib/addresses/repository";
import { fulfillmentStep } from "../../lib/fulfillment-status";

export const metadata: Metadata = {
  title: "Minha conta | Artgian Studio",
  robots: { index: false, follow: false },
};
const statuses: Record<string, string> = {
  pending: "Aguardando pagamento", paid: "Pagamento aprovado", rejected: "Pagamento recusado",
  cancelled: "Cancelado", refunded: "Reembolsado", charged_back: "Pagamento contestado",
  payment_setup_failed: "Pagamento não iniciado",
};
const pageSize = 4;
type OrderItem = typeof orderItems.$inferSelect;

function ItemPreview({ item, catalog }: { item: OrderItem; catalog: ProductCatalog }) {
  const product = Object.hasOwn(catalog, item.productId) ? catalog[item.productId] : undefined;
  const image = product?.variants.find(variant => variant.name === item.color || variant.key === item.color)?.image || product?.image;
  return <div className="flex min-w-0 items-center gap-3.5">
    <OrderThumbnail src={image} alt={`${item.productName} — ${item.color}`} />
    <div className="min-w-0">
      <p className="break-words font-serif text-xl leading-tight">{item.productName}</p>
      <p className="mt-1.5 break-words text-xs leading-5 text-[#647087]">{item.quantity} {item.quantity === 1 ? "unidade" : "unidades"} · {item.color}</p>
      {item.personalization && <p className="mt-1 break-words text-xs leading-5 text-[#647087]">“{item.personalization}”</p>}
    </div>
  </div>;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ pagina?: string; aba?: string }> }) {
  const params = await searchParams;
  const session = await getCustomerSession(await headers());
  if (!session) redirect(`/login?next=${encodeURIComponent(params.aba === "enderecos" ? "/conta?aba=enderecos" : "/conta")}`);
  const db = await getDb();
  const owned = eq(orders.userId, session.user.id);
  const [totals, addresses, catalog] = await Promise.all([
    db.select({ value: count() }).from(orders).where(owned),
    listAddresses(session.user.id), getProductCatalog(),
  ]);
  const total = totals[0].value;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = /^\d{1,6}$/.test(params.pagina ?? "") ? Number(params.pagina) : 1;
  const page = Math.min(pageCount, Math.max(1, requestedPage));
  const purchases = await db.select().from(orders).where(owned)
    .orderBy(desc(orders.createdAt), desc(orders.id)).limit(pageSize).offset((page - 1) * pageSize);
  const items = purchases.length ? await db.select().from(orderItems)
    .where(inArray(orderItems.orderId, purchases.map(order => order.id))).orderBy(orderItems.id) : [];
  const firstName = session.user.name.trim().split(/\s+/)[0];

  return <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
    <BrandHeader />
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:py-10">
      <header className="flex items-center justify-between gap-3 border-b border-[#0b2447]/10 pb-5">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-bold uppercase tracking-[.24em] text-[#b88a3b]">Seu espaço na Artgian</p>
          <h1 className="mt-2 break-words font-serif text-3xl tracking-tight sm:text-5xl">Olá, {firstName}.</h1>
          <p className="mt-2 break-all text-xs text-[#647087]">{session.user.email}</p>
        </div>
        <SignOutButton />
      </header>
      <AccountTabs orderCount={total} addressCount={addresses.length} addresses={<AddressBook initialAddresses={addresses} />} orders={
        <section aria-labelledby="orders-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="orders-title" className="font-serif text-3xl">Seus pedidos</h2>
            {total > 0 && <p className="text-[0.65rem] text-[#647087]">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total} {total === 1 ? "pedido" : "pedidos"}</p>}
          </div>
          <p className="mt-1 text-sm leading-6 text-[#647087]">Cada criação, do preparo até chegar a você.</p>
          {!purchases.length ? <div className="mt-5 rounded-[1.75rem] border border-white bg-white/75 px-6 py-10 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#d8bc7b]/15 text-[#b88a3b]"><ShoppingBag size={25} strokeWidth={1.4} /></span>
            <h3 className="mt-4 font-serif text-2xl">Sua primeira criação espera por você.</h3>
            <p className="mt-2 text-sm text-[#647087]">Você ainda não tem pedidos nesta conta.</p>
            <Link href="/produtos" className="mt-6 inline-flex items-center gap-3 rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white">Conhecer as criações <ArrowRight size={16} /></Link>
          </div> : <div className="mt-5 grid items-start gap-4 md:grid-cols-2">
            {purchases.map(order => {
              const orderProducts = items.filter(item => item.orderId === order.id);
              const paid = order.status === "paid";
              const status = paid ? fulfillmentStep(order.fulfillmentStatus).label : statuses[order.status] || "Em atualização";
              const statusClass = paid ? order.fulfillmentStatus === "delivered" ? "bg-emerald-50 text-emerald-800" : "bg-[#d8bc7b]/20 text-[#846023]" : order.status === "pending" ? "bg-amber-50 text-amber-900" : "bg-[#0b2447]/5 text-[#647087]";
              const paymentHref = order.checkoutMode === "embedded" ? `/comprar/pagamento?pedido=${order.id}` : order.checkoutUrl && ["pending", "rejected"].includes(order.status) ? order.checkoutUrl : `/comprar/sucesso?pedido=${order.id}`;
              const date = new Date(order.createdAt.includes("T") ? order.createdAt : `${order.createdAt.replace(" ", "T")}Z`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" });
              return <article key={order.id} aria-labelledby={`order-${order.id}`} className="min-w-0 rounded-[1.5rem] border border-white bg-white/85 p-5 shadow-[0_6px_24px_rgba(11,36,71,.035)]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`order-${order.id}`} className="text-xs font-semibold">Pedido <span className="font-mono text-[#647087]">#{order.id.slice(0, 8)}</span></h3>
                  <time className="text-[0.65rem] text-[#647087]">{date}</time>
                </div>
                {orderProducts[0] ? <ItemPreview item={orderProducts[0]} catalog={catalog} /> : <p className="flex items-center gap-2 text-sm"><Package size={18} /> Sua compra na Artgian</p>}
                {orderProducts.length > 1 && <details className="group mt-3">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[#647087] hover:text-[#0b2447] [&::-webkit-details-marker]:hidden"><ChevronDown size={14} className="transition group-open:rotate-180" /> Ver mais {orderProducts.length - 1} {orderProducts.length === 2 ? "item" : "itens"}</summary>
                  <ul className="mt-3 space-y-4 border-t border-[#0b2447]/10 pt-4">{orderProducts.slice(1).map(item => <li key={item.id}><ItemPreview item={item} catalog={catalog} /></li>)}</ul>
                </details>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.65rem] font-semibold ${statusClass}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{status}</span>
                  {paid && <Link href={paymentHref} className="inline-flex min-h-8 items-center text-xs text-[#647087] underline decoration-[#0b2447]/20 underline-offset-4 hover:text-[#0b2447]">Ver pagamento</Link>}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#0b2447]/10 pt-4">
                  <div><p className="text-[0.6rem] text-[#647087]">Total com frete</p><strong className="font-serif text-2xl font-normal">{formatBrl(order.totalCents)}</strong></div>
                  <Link href={paid ? `/conta/pedidos/${order.id}` : paymentHref} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#0b2447] px-3 py-2.5 text-[0.7rem] font-semibold text-white transition hover:bg-[#19385e]">{paid ? "Acompanhar pedido" : order.status === "pending" || order.status === "rejected" ? "Continuar pagamento" : "Ver pagamento"}<ArrowRight size={15} /></Link>
                </div>
                {order.discountCents > 0 && <p className="mt-2 text-[0.65rem] text-emerald-800">Cupom {order.couponCode}: −{formatBrl(order.discountCents)}</p>}
              </article>;
            })}
          </div>}
          {pageCount > 1 && <nav aria-label="Páginas dos pedidos" className="mt-6 flex items-center justify-between gap-2 border-t border-[#0b2447]/10 pt-5 text-xs">
            {page > 1 ? <Link href={`/conta?pagina=${page - 1}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0b2447]/15 px-4 font-semibold"><ArrowLeft size={14} /> Anteriores</Link> : <span className="px-4 text-[#647087]/50">Anteriores</span>}
            <span className="text-[#647087]">{page} de {pageCount}</span>
            {page < pageCount ? <Link href={`/conta?pagina=${page + 1}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0b2447]/15 px-4 font-semibold">Próximos <ArrowRight size={14} /></Link> : <span className="px-4 text-[#647087]/50">Próximos</span>}
          </nav>}
        </section>
      } />
    </div>
  </main>;
}
