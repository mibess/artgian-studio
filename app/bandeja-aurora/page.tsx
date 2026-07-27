import type { Metadata } from "next";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import ProductPurchase from "./ProductPurchase";

export const metadata: Metadata = {
  title: "Bandeja Aurora | Artgian Studio",
  description:
    "Bandeja decorativa impressa em 3D, produzida sob encomenda pela Artgian Studio.",
};

const features = [
  ["01", "Forma escultural", "Dobras orgânicas criam movimento em todos os ângulos."],
  ["02", "Produção consciente", "Fabricada sob encomenda, sem estoque ou desperdício excessivo."],
  ["03", "Acabamento autoral", "Textura acetinada que valoriza as camadas da impressão 3D."],
];

export default function BandejaAuroraPage() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#e8c8b2] text-[#152849]"
      id="topo"
    >
      <div className="absolute inset-x-0 top-0 h-[52rem] overflow-hidden">
        <div className="absolute -top-32 -left-24 size-[34rem] rounded-full border-[5rem] border-[#fff5e9]/30" />
        <div className="absolute top-24 right-[-12rem] size-[38rem] rounded-full bg-[#b66f56]/20 blur-3xl" />
      </div>

      <BrandHeader tone="clay" />

      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:px-14 lg:py-20">
        <div className="relative z-10 lg:py-10">
          <div className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#8b4e3e]">
            <span className="h-px w-10 bg-current" />
            Coleção Casa · 01
          </div>
          <h1 className="mt-8 max-w-2xl font-serif text-[clamp(4.8rem,9vw,9.4rem)] font-normal leading-[0.76] tracking-[-0.07em]">
            Bandeja
            <em className="mt-3 block pl-[13%] font-normal text-[#fff8ed] [text-shadow:0_1px_0_#fff]">
              Aurora.
            </em>
          </h1>
          <p className="mt-10 max-w-lg text-base leading-7 text-[#152849]/75">
            Organização que ganha presença. Uma peça decorativa de linhas
            facetadas, criada para reunir pequenos objetos e transformar o
            cotidiano em composição.
          </p>

          <div className="mt-8 flex items-end gap-5 border-t border-[#152849]/15 pt-7">
            <div>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#152849]/55">
                A partir de
              </span>
              <strong className="mt-1 block font-serif text-4xl font-normal">
                R$ 189
                <sup className="ml-1 text-base">,90</sup>
              </strong>
            </div>
            <span className="mb-1 rounded-full border border-[#152849]/15 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]">
              Sob encomenda
            </span>
          </div>

          <ProductPurchase />
        </div>

        <div className="relative min-h-[34rem] lg:min-h-[44rem]">
          <div className="absolute inset-0 rotate-3 rounded-[3rem] bg-[#fff5e9]/35" />
          <figure className="absolute inset-3 overflow-hidden rounded-[2.6rem] bg-[#fffaf4] shadow-[0_35px_90px_rgba(91,48,35,.22)] lg:inset-6">
            <img
              className="h-full w-full object-cover"
              src="/bandeja-decorativa.png"
              alt="Bandeja decorativa facetada na cor areia"
            />
          </figure>
          <div className="absolute -bottom-5 -left-3 flex size-28 rotate-[-8deg] flex-col items-center justify-center rounded-full border border-white/45 bg-[#152849] text-center text-[#fff8ed] shadow-xl lg:size-36">
            <span className="font-serif text-2xl">✦</span>
            <span className="mt-1 text-[0.55rem] font-bold uppercase leading-4 tracking-[0.16em]">
              Impressa
              <br />
              camada a camada
            </span>
          </div>
        </div>
      </section>

      <section className="relative mx-3 overflow-hidden rounded-[2.3rem] bg-[#fffaf4] px-5 py-20 sm:px-10 lg:px-[7vw] lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b17a2d]">
              Desenho que organiza
            </span>
            <h2 className="mt-5 font-serif text-[clamp(3rem,5vw,5.5rem)] font-normal leading-[.9] tracking-[-0.05em]">
              Uma pequena
              <br />
              <i className="font-normal text-[#b66f56]">escultura útil.</i>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map(([number, title, description]) => (
              <article
                className="border-t border-[#152849]/20 pt-5"
                key={number}
              >
                <span className="font-serif text-lg text-[#b17a2d]">{number}</span>
                <h3 className="mt-8 font-serif text-2xl font-normal">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#152849]/60">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#152849] text-[#fffaf4] lg:grid-cols-[1.05fr_.95fr]">
          <div className="min-h-[28rem] overflow-hidden bg-white">
            <img
              className="h-full w-full object-cover"
              src="/bandeja-decorativa.png"
              alt="Cores disponíveis para a Bandeja Aurora"
            />
          </div>
          <div className="flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-[6vw]">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.23em] text-[#dcad5b]">
              Seu espaço, sua paleta
            </span>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,5vw,5rem)] font-normal leading-[.9] tracking-[-0.04em]">
              Quatro cores.
              <br />
              <i className="font-normal text-[#e8c8b2]">Muitas composições.</i>
            </h2>
            <p className="mt-7 max-w-md text-sm leading-7 text-white/65">
              Escolha um tom neutro para integrar a peça ao ambiente ou use a
              cor como ponto de destaque sobre aparadores, mesas e penteadeiras.
            </p>
            <a
              className="mt-9 inline-flex w-fit items-center gap-5 border-b border-[#dcad5b] pb-2 text-sm font-semibold"
              href="#topo"
            >
              Voltar para escolher <span className="text-xl text-[#dcad5b]">↑</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-5 px-7 py-10 text-xs text-[#152849]/65 sm:flex-row sm:items-center">
        <span>Artgian Studio · Elegância impressa em cada detalhe.</span>
        <Link className="font-semibold text-[#152849]" href="/">
          Conheça o estúdio →
        </Link>
      </footer>
    </main>
  );
}
