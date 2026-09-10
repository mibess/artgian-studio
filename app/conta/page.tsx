import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getCustomerSession } from "../../lib/auth";
import { getDb } from "../../db";
import { orders, orderItems } from "../../db/schema";
import { formatBrl } from "../../lib/catalog";
import BrandHeader from "../components/BrandHeader";
import SignOutButton from "./SignOutButton";
export const metadata: Metadata = {
  title: "Minha conta | Artgian Studio",
  robots: { index: false, follow: false },
};
const statuses: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pagamento aprovado",
  rejected: "Pagamento recusado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Pagamento contestado",
  payment_setup_failed: "Pagamento não iniciado",
};
export default async function AccountPage() {
  const session = await getCustomerSession(await headers());
  if (!session) redirect("/login?next=/conta");
  const db = await getDb();
  const purchases = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  const items = purchases.length
    ? await db
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            purchases.map((order) => order.id),
          ),
        )
    : [];
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b88a3b]">
              Minha conta
            </p>
            <h1 className="mt-3 break-words font-serif text-4xl sm:text-5xl">
              Olá, {session.user.name.split(" ")[0]}.
            </h1>
            <p className="mt-3 break-all text-sm text-[#647087]">
              {session.user.email}
            </p>
          </div>
          <SignOutButton />
        </div>
        <section className="mt-12">
          <h2 className="font-serif text-3xl">Seus pedidos</h2>
          <p className="mt-2 text-sm text-[#647087]">
            Aqui aparecem as últimas 50 compras feitas enquanto você estava
            conectado.
          </p>
          {!purchases.length ? (
            <div className="mt-6 rounded-[2rem] border border-white bg-white/65 p-8">
              <p className="text-sm text-[#647087]">
                Você ainda não tem pedidos nesta conta.
              </p>
              <Link
                href="/produtos"
                className="mt-5 inline-flex rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white"
              >
                Conhecer as criações →
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {purchases.map((order) => (
                <article
                  key={order.id}
                  className="rounded-3xl border border-white bg-white/65 p-6"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <h3 className="font-semibold">
                      Pedido #{order.id.slice(0, 8)}
                    </h3>
                    <span className="rounded-full bg-[#0b2447]/5 px-3 py-1 text-xs">
                      {statuses[order.status] || "Em atualização"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#647087]">
                    {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <ul className="my-5 space-y-2 text-sm">
                    {items
                      .filter((item) => item.orderId === order.id)
                      .map((item) => (
                        <li key={item.id}>
                          {item.quantity} × {item.productName} · {item.color}
                          {item.personalization
                            ? ` · “${item.personalization}”`
                            : ""}
                        </li>
                      ))}
                  </ul>
                  <div className="flex flex-wrap justify-between gap-3 border-t border-[#0b2447]/10 pt-4">
                    <span className="text-sm text-[#647087]">
                      Total com frete
                    </span>
                    <strong>{formatBrl(order.totalCents)}</strong>
                  </div>
                  {order.shippingTrackingCode && (
                    <p className="mt-4 text-sm">
                      Rastreio: <strong>{order.shippingTrackingCode}</strong>
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
