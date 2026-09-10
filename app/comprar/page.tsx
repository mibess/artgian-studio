import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import CheckoutContents from "./CheckoutContents";
import { getProductSelection } from "../../lib/catalog";
import { getCustomerSession } from "../../lib/auth";

export const metadata: Metadata = {
  title: "Finalizar compra | Artgian Studio",
  description: "Revise seu pedido e informe os dados para entrega.",
};

type CheckoutPageProps = {
  searchParams: Promise<{
    produto?: string;
    cor?: string;
    quantidade?: string;
    personalizacao?: string;
  }>;
};

function checkoutReturnTo(params: Awaited<CheckoutPageProps["searchParams"]>) {
  const query = new URLSearchParams();
  if (params.produto) query.set("produto", params.produto);
  if (params.cor) query.set("cor", params.cor);
  if (params.quantidade) query.set("quantidade", params.quantidade);
  if (params.personalizacao)
    query.set("personalizacao", params.personalizacao);
  const serialized = query.toString();
  return serialized ? `/comprar?${serialized}` : "/comprar";
}

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;
  const session = await getCustomerSession(await headers());
  if (!session) {
    const next = checkoutReturnTo(params);
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const selection = getProductSelection({
    productId: params.produto,
    color: params.cor,
    quantity: params.quantidade,
    personalization: params.personalizacao,
  });
  const product = selection?.product ?? null;

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />

      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-20">
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-[#0b2447]/15 pb-8 sm:flex-row sm:items-end">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">
              Checkout seguro
            </span>
            <h1 className="mt-3 font-serif text-[clamp(3rem,5vw,5rem)] font-normal leading-none tracking-[-0.045em]">
              Finalize seu pedido.
            </h1>
          </div>
          <Link
            className="text-xs font-semibold text-[#647087] hover:text-[#0b2447]"
            href={product?.href || "/produtos"}
          >
            ← Continuar comprando
          </Link>
        </div>

        <CheckoutContents
          customer={{ name: session.user.name, email: session.user.email }}
          initialItem={
            selection
              ? {
                  productId: selection.productId,
                  color: selection.colorKey,
                  quantity: selection.quantity,
                  personalization: selection.personalization,
                }
              : null
          }
          invalidSelection={Boolean(params.produto && !selection)}
        />
      </div>
    </main>
  );
}
