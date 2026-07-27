import type { Metadata } from "next";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";

export const metadata: Metadata = {
  title: "Produtos | Artgian Studio",
  description:
    "Conheça as criações em destaque da Artgian Studio, produzidas sob encomenda em impressão 3D.",
};

const products = [
  {
    number: "01",
    category: "Casa",
    name: "Bandeja Aurora",
    description:
      "Uma pequena escultura útil para organizar e compor aparadores, mesas e penteadeiras.",
    price: "R$ 189,90",
    image: "/bandeja-aurora-capa.png",
    alt: "Bandeja Aurora em tom areia",
    href: "/bandeja-aurora",
    accent: "#b66f56",
    feature: "4 cores",
  },
  {
    number: "02",
    category: "Organização",
    name: "Organizador Arco",
    description:
      "Quatro gavetas, dois nichos e uma silhueta delicada para deixar tudo em seu lugar.",
    price: "R$ 249,90",
    image: "/organizador-arco-capa.png",
    alt: "Organizador Arco rosa com gavetas em marfim",
    href: "/organizador-arco",
    accent: "#c55270",
    feature: "3 combinações",
  },
  {
    number: "03",
    category: "Música",
    name: "Porta-Palhetas Solo",
    description:
      "Sua seleção de palhetas organizada em uma peça escultural que leva seu nome.",
    price: "R$ 129,90",
    image: "/porta-palhetas-solo-capa.png",
    alt: "Porta-Palhetas Solo personalizado com o texto Seu Nome",
    href: "/porta-palhetas-solo",
    accent: "#c96f47",
    feature: "Personalizável",
  },
  {
    number: "04",
    category: "Mobilidade",
    name: "Suporte Pocket",
    description:
      "Um apoio articulado que abre para o uso e fecha para acompanhar você sem ocupar espaço.",
    price: "R$ 69,90",
    image: "/suporte-pocket-capa.png",
    alt: "Suporte Pocket preto nas posições aberta e fechada",
    href: "/suporte-pocket",
    accent: "#a87927",
    feature: "3 cores",
  },
];

export default function ProductsPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ea] text-[#0b2447]">
      <section className="relative overflow-hidden bg-[#0b2447] pb-28 text-[#f7f3ea]">
        <div className="absolute -top-52 right-[-8rem] size-[42rem] rounded-full border-[7rem] border-[#d8bc7b]/10" />
        <div className="absolute top-40 -left-24 size-72 rounded-full bg-[#b66f56]/15 blur-3xl" />
        <BrandHeader />

        <div className="relative mx-auto max-w-[1440px] px-5 pt-20 sm:px-8 lg:px-14 lg:pt-28">
          <div className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#d8bc7b]">
            <span className="grid size-9 place-items-center rounded-full border border-current font-serif text-sm font-normal tracking-normal">
              01
            </span>
            Coleção Artgian
          </div>
          <div className="mt-12 grid items-end gap-10 lg:grid-cols-[1.35fr_.65fr]">
            <h1 className="max-w-5xl font-serif text-[clamp(4.2rem,9vw,9rem)] font-normal leading-[0.8] tracking-[-0.065em]">
              Objetos com
              <br />
              <i className="font-normal text-[#d8bc7b]">algo a dizer.</i>
            </h1>
            <div className="border-t border-[#d8bc7b]/30 pt-6">
              <p className="max-w-sm text-sm leading-7 text-white/62">
                Criações funcionais e decorativas produzidas camada por camada,
                sempre sob encomenda e com espaço para a sua personalidade.
              </p>
              <div className="mt-7 flex gap-6 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#d8bc7b]">
                <span>Produção artesanal</span>
                <span>Envio nacional</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-14 lg:py-28">
        <header className="flex flex-col justify-between gap-8 border-b border-[#0b2447]/15 pb-8 sm:flex-row sm:items-end">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b88a3b]">
              Criações disponíveis
            </span>
            <h2 className="mt-3 font-serif text-[clamp(3rem,5vw,5rem)] font-normal leading-none tracking-[-0.05em]">
              Escolha a sua.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#647087]">
            Cada produto tem sua própria página, opções e detalhes de
            personalização.
          </p>
        </header>

        <div className="mt-14 grid gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article className="group flex flex-col" key={product.name}>
              <Link
                className="relative aspect-[4/5] overflow-hidden rounded-[1.8rem] bg-[#e9dfcf] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b]"
                href={product.href}
              >
                <img
                  className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
                  src={product.image}
                  alt={product.alt}
                />
                <span className="absolute top-4 left-4 rounded-full border border-white/45 bg-white/65 px-3 py-2 text-[0.58rem] font-bold uppercase tracking-[0.16em] shadow-sm backdrop-blur-xl">
                  {product.feature}
                </span>
                <span className="absolute right-4 bottom-4 grid size-12 translate-y-2 place-items-center rounded-full bg-[#0b2447] text-xl text-white opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  ↗
                </span>
              </Link>

              <div className="mt-6 flex items-center justify-between gap-4">
                <span
                  className="text-[0.62rem] font-bold uppercase tracking-[0.18em]"
                  style={{ color: product.accent }}
                >
                  {product.number} / {product.category}
                </span>
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#647087]">
                  Sob encomenda
                </span>
              </div>
              <h2 className="mt-3 font-serif text-3xl font-normal tracking-[-0.03em]">
                <Link href={product.href}>{product.name}</Link>
              </h2>
              <p className="mt-3 min-h-18 text-sm leading-6 text-[#647087]">
                {product.description}
              </p>
              <div className="mt-6 flex items-end justify-between border-t border-[#0b2447]/12 pt-5">
                <div>
                  <span className="text-[0.55rem] font-bold uppercase tracking-[0.18em] text-[#647087]">
                    A partir de
                  </span>
                  <strong className="mt-1 block font-serif text-2xl font-normal">
                    {product.price}
                  </strong>
                </div>
                <Link
                  className="inline-flex items-center gap-3 border-b border-[#b88a3b] pb-1 text-xs font-semibold"
                  href={product.href}
                >
                  Ver produto <span className="text-lg text-[#b88a3b]">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-3 mb-3 overflow-hidden rounded-[2.2rem] bg-[#d8bc7b] px-6 py-16 sm:px-12 lg:px-[7vw] lg:py-24">
        <div className="grid items-end gap-10 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em]">
              Não encontrou o que imaginou?
            </span>
            <h2 className="mt-5 font-serif text-[clamp(3.2rem,6vw,6.5rem)] font-normal leading-[.88] tracking-[-0.055em]">
              Então criamos
              <br />
              <i className="font-normal text-[#fffaf4]">algo só seu.</i>
            </h2>
          </div>
          <div className="rounded-[1.5rem] border border-white/45 bg-white/35 p-6 backdrop-blur-xl sm:p-8">
            <p className="text-sm leading-6">
              Conte a sua ideia, escolha as dimensões e participe das decisões
              até a peça ficar do seu jeito.
            </p>
            <Link
              className="mt-7 flex items-center justify-between rounded-full bg-[#0b2447] py-2 pr-2 pl-5 text-sm font-semibold text-white"
              href="/#orcamento"
            >
              Pedir um projeto personalizado
              <span className="grid size-10 place-items-center rounded-full bg-[#d8bc7b] text-xl text-[#0b2447]">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-5 px-7 py-10 text-xs text-[#0b2447]/60 sm:flex-row sm:items-center">
        <span>Artgian Studio · Elegância impressa em cada detalhe.</span>
        <Link className="font-semibold text-[#0b2447]" href="/">
          Voltar ao início →
        </Link>
      </footer>
    </main>
  );
}
