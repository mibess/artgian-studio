import Link from "next/link";
import { eq } from "drizzle-orm";
import BrandHeader from "../components/BrandHeader";
import { getDb } from "../../db";
import { orderItems, orders } from "../../db/schema";
import { formatBrl } from "../../lib/catalog";

type PaymentResultProps = {
  orderId?: string;
  returnState: "success" | "pending" | "failure";
};

const content = {
  success: {
    symbol: "✓",
    eyebrow: "Retorno do Mercado Pago",
    title: "Recebemos seu pagamento.",
    description:
      "Estamos confirmando o pagamento com o Mercado Pago. O estado abaixo é atualizado pelo webhook seguro.",
  },
  pending: {
    symbol: "…",
    eyebrow: "Pagamento em processamento",
    title: "Seu pedido está pendente.",
    description:
      "Alguns meios de pagamento levam um pouco mais de tempo. Assim que o Mercado Pago confirmar, o pedido será atualizado.",
  },
  failure: {
    symbol: "×",
    eyebrow: "Pagamento não concluído",
    title: "Não foi possível concluir.",
    description:
      "Nenhuma confirmação de pagamento foi recebida. Você pode voltar ao produto e tentar novamente.",
  },
} as const;

const statusLabels: Record<string, string> = {
  pending: "Aguardando confirmação",
  paid: "Pagamento aprovado",
  rejected: "Pagamento recusado",
  cancelled: "Pagamento cancelado",
  refunded: "Pagamento estornado",
  charged_back: "Pagamento contestado",
  payment_setup_failed: "Falha ao iniciar pagamento",
};

export default async function PaymentResult({
  orderId,
  returnState,
}: PaymentResultProps) {
  const pageContent = content[returnState];
  let order: typeof orders.$inferSelect | null = null;
  let item: typeof orderItems.$inferSelect | null = null;

  if (orderId) {
    try {
      const db = await getDb();
      [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      [item] = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .limit(1);
    } catch {
      // Keep the return page useful even if persistence is temporarily unavailable.
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-24">
        <section className="rounded-[2rem] border border-white bg-white/75 p-7 text-center shadow-[0_20px_60px_rgba(11,36,71,.07)] sm:p-12">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#0b2447] font-serif text-3xl text-[#d8bc7b]">
            {pageContent.symbol}
          </span>
          <p className="mt-7 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">
            {pageContent.eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-normal sm:text-5xl">
            {pageContent.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#647087]">
            {pageContent.description}
          </p>

          {order && item ? (
            <dl className="mx-auto mt-9 max-w-lg divide-y divide-[#0b2447]/10 rounded-2xl bg-[#f7f3ea] px-5 text-left text-sm">
              <div className="flex justify-between gap-5 py-4">
                <dt className="text-[#647087]">Estado</dt>
                <dd className="font-semibold">
                  {statusLabels[order.status] ?? order.status}
                </dd>
              </div>
              <div className="flex justify-between gap-5 py-4">
                <dt className="text-[#647087]">Pedido</dt>
                <dd className="font-mono text-xs">{order.id.slice(0, 8)}</dd>
              </div>
              <div className="flex justify-between gap-5 py-4">
                <dt className="text-[#647087]">Item</dt>
                <dd className="text-right">
                  {item.productName} · {item.color}
                </dd>
              </div>
              <div className="flex justify-between gap-5 py-4">
                <dt className="text-[#647087]">Total</dt>
                <dd className="font-semibold">{formatBrl(order.totalCents)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-8 rounded-2xl bg-[#f7f3ea] px-5 py-4 text-sm text-[#647087]">
              Não encontramos os detalhes desse pedido nesta visualização.
            </p>
          )}

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {order?.status === "pending" && (
              <Link
                className="rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white"
                href={`/comprar/pendente?pedido=${order.id}`}
              >
                Atualizar estado
              </Link>
            )}
            <Link
              className="rounded-full border border-[#0b2447]/20 px-6 py-3 text-sm font-semibold"
              href="/produtos"
            >
              Voltar aos produtos
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
