import type { Metadata } from "next";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import CheckoutForm from "./CheckoutForm";
import { getProductSelection } from "../../lib/catalog";

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

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;
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

        {!selection ? (
          <div className="rounded-[2rem] border border-[#0b2447]/10 bg-white p-8 text-center sm:p-14">
            <span className="font-serif text-5xl text-[#b88a3b]">◇</span>
            <h2 className="mt-5 font-serif text-3xl font-normal">
              Seu carrinho está vazio.
            </h2>
            <p className="mt-3 text-sm text-[#647087]">
              Escolha uma criação para começar o pedido.
            </p>
            <Link
              className="mt-7 inline-flex rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white"
              href="/produtos"
            >
              Ver criações
            </Link>
          </div>
        ) : (
          <CheckoutForm
            productId={selection.productId}
            productName={selection.product.name}
            productImage={selection.product.image}
            productAlt={selection.product.alt}
            subtotalCents={selection.subtotalCents}
            color={selection.colorKey}
            colorName={selection.color}
            quantity={selection.quantity}
            personalization={selection.personalization}
          />
        )}
      </div>
    </main>
  );
}
