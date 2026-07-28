import type { Metadata } from "next";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import CheckoutForm from "./CheckoutForm";
import ProductColorImage from "../components/ProductColorImage";

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

const colorNames: Record<string, string> = {
  areia: "Areia",
  preto: "Preto",
  branco: "Branco",
  rosa: "Rosa",
  terracota: "Terracota",
  "rosa-marfim": "Rosa & Marfim",
  "marrom-branco": "Marrom & Branco",
  "areia-branco": "Areia & Branco",
};

const products = {
  "bandeja-aurora": {
    name: "Bandeja Aurora",
    href: "/bandeja-aurora",
    image: "/bandeja-aurora-capa.png",
    alt: "Bandeja Aurora na cor areia",
    unitPrice: 189.9,
    shipping: 24.9,
    defaultColor: "Areia",
    customizable: false,
  },
  "organizador-arco": {
    name: "Organizador Arco",
    href: "/organizador-arco",
    image: "/organizador-arco-capa.png",
    alt: "Organizador Arco rosa com gavetas em marfim",
    unitPrice: 249.9,
    shipping: 29.9,
    defaultColor: "Rosa & Marfim",
    customizable: false,
  },
  "porta-palhetas-solo": {
    name: "Porta-Palhetas Solo",
    href: "/porta-palhetas-solo",
    image: "/porta-palhetas-solo-capa.png",
    alt: "Porta-Palhetas Solo terracota personalizado com o texto Seu Nome",
    unitPrice: 129.9,
    shipping: 19.9,
    defaultColor: "Terracota",
    customizable: true,
  },
  "suporte-pocket": {
    name: "Suporte Pocket",
    href: "/suporte-pocket",
    image: "/suporte-pocket-capa.png",
    alt: "Suporte Pocket preto nas posições aberta e fechada",
    unitPrice: 69.9,
    shipping: 16.9,
    defaultColor: "Preto",
    customizable: false,
  },
} as const;

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;
  const quantity = Math.min(9, Math.max(1, Number(params.quantidade) || 1));
  const product =
    params.produto && params.produto in products
      ? products[params.produto as keyof typeof products]
      : null;
  const unitPrice = product?.unitPrice ?? 0;
  const shipping = product?.shipping ?? 0;
  const total = unitPrice * quantity + shipping;
  const colorValue = params.cor || "";
  const color = colorNames[colorValue] || product?.defaultColor || "";
  const personalization = product?.customizable
    ? params.personalizacao?.trim().slice(0, 18) || "Seu Nome"
    : null;

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />

      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-20">
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-[#0b2447]/15 pb-8 sm:flex-row sm:items-end">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">
              Checkout seguro · demonstração
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

        {!product ? (
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
          <div className="grid items-start gap-8 lg:grid-cols-[1.08fr_.72fr]">
            <section className="rounded-[2rem] border border-white bg-white/70 p-6 shadow-[0_20px_60px_rgba(11,36,71,.07)] sm:p-9">
              <CheckoutForm />
            </section>

            <aside className="rounded-[2rem] bg-[#0b2447] p-5 text-white shadow-[0_24px_70px_rgba(11,36,71,.16)] lg:sticky lg:top-6">
              <div className="overflow-hidden rounded-[1.4rem] bg-white">
                <ProductColorImage
                  className="aspect-square w-full object-cover"
                  product={params.produto || ""}
                  src={product.image}
                  alt={product.alt}
                  initialColor={colorValue}
                />
              </div>
              <div className="px-2 pt-6 pb-3">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#d8bc7b]">
                  Resumo do pedido
                </span>
                <div className="mt-3 flex items-start justify-between gap-5">
                  <div>
                    <h2 className="font-serif text-2xl font-normal">
                      {product.name}
                    </h2>
                    <p className="mt-1 text-xs text-white/55">
                      Cor {color} · Quantidade {quantity}
                    </p>
                    {personalization && (
                      <p className="mt-1 text-xs text-[#d8bc7b]">
                        Personalização: “{personalization}”
                      </p>
                    )}
                  </div>
                  <strong className="shrink-0 text-sm">
                    {(unitPrice * quantity).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>
                </div>

                <dl className="mt-7 space-y-3 border-y border-white/15 py-5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-white/55">Subtotal</dt>
                    <dd>
                      {(unitPrice * quantity).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/55">Frete estimado</dt>
                    <dd>
                      {shipping.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 flex items-end justify-between">
                  <span className="text-xs text-white/55">Total</span>
                  <strong className="font-serif text-3xl font-normal text-[#d8bc7b]">
                    {total.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
