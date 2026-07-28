import type { Metadata } from "next";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import ProductPurchase from "./ProductPurchase";
import ProductColorImage from "../components/ProductColorImage";

export const metadata: Metadata = {
  title: "Suporte Pocket | Artgian Studio",
  description:
    "Suporte articulado para celular, compacto e produzido sob encomenda em impressão 3D.",
};

const features = [
  [
    "01",
    "Cabe no bolso",
    "Fecha sobre si mesmo para acompanhar sua rotina sem ocupar espaço na bolsa ou mochila.",
  ],
  [
    "02",
    "Ângulo ajustável",
    "A articulação permite encontrar uma posição confortável para vídeos, chamadas e leitura.",
  ],
  [
    "03",
    "Base estável",
    "Apoios frontais e estrutura articulada mantêm o celular firme sobre superfícies planas.",
  ],
];

export default function SuportePocketPage() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#d8bc7b] text-[#0b2447]"
      id="topo"
    >
      <div className="absolute inset-x-0 top-0 h-[55rem] overflow-hidden">
        <div className="absolute -top-40 -left-24 size-[36rem] rounded-full border-[5rem] border-white/18" />
        <div className="absolute top-12 right-[-10rem] size-[40rem] rounded-full bg-[#0b2447]/14 blur-3xl" />
        <div className="absolute top-56 left-[43%] h-px w-[48%] rotate-[-6deg] bg-[#0b2447]/20" />
      </div>

      <BrandHeader tone="clay" />

      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-14 lg:py-20">
        <div className="relative z-10 lg:py-10">
          <div className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#6d501d]">
            <span className="h-px w-10 bg-current" />
            Coleção Mobilidade · 01
          </div>
          <h1 className="mt-8 max-w-2xl font-serif text-[clamp(4.7rem,8.8vw,9.2rem)] font-normal leading-[0.76] tracking-[-0.07em]">
            Suporte
            <em className="mt-3 block pl-[17%] font-normal text-[#fffaf2] [text-shadow:0_1px_0_#fff]">
              Pocket.
            </em>
          </h1>
          <p className="mt-10 max-w-lg text-base leading-7 text-[#0b2447]/72">
            Praticidade que abre, apoia e volta para o bolso. Um suporte
            articulado e compacto para manter seu celular no melhor ângulo onde
            você estiver.
          </p>

          <div className="mt-8 flex items-end gap-5 border-t border-[#0b2447]/15 pt-7">
            <div>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#0b2447]/55">
                A partir de
              </span>
              <strong className="mt-1 block font-serif text-4xl font-normal">
                R$ 5
                <sup className="ml-1 text-base">,99</sup>
              </strong>
            </div>
            <span className="mb-1 rounded-full border border-[#0b2447]/20 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]">
              Dobrável
            </span>
          </div>

          <ProductPurchase />
        </div>

        <div className="relative min-h-[36rem] lg:min-h-[47rem]">
          <div className="absolute inset-0 rotate-2 rounded-[3rem] bg-white/22" />
          <figure className="absolute inset-3 overflow-hidden rounded-[2.6rem] bg-[#f7f1e6] shadow-[0_35px_90px_rgba(58,42,16,.22)] lg:inset-6">
            <ProductColorImage
              className="h-full w-full object-cover"
              product="suporte-pocket"
              src="/suporte-pocket-capa.png"
              alt="Suporte Pocket preto nas posições aberta e fechada"
              initialColor="preto"
            />
          </figure>
          <div className="absolute -bottom-5 -left-3 flex size-28 rotate-[-7deg] flex-col items-center justify-center rounded-full border border-white/45 bg-[#0b2447] text-center text-[#fffaf2] shadow-xl lg:size-36">
            <span className="font-serif text-2xl">↗</span>
            <span className="mt-1 text-[0.55rem] font-bold uppercase leading-4 tracking-[0.16em]">
              Abra
              <br />
              apoie e leve
            </span>
          </div>
        </div>
      </section>

      <section className="relative mx-3 overflow-hidden rounded-[2.3rem] bg-[#fffaf4] px-5 py-20 sm:px-10 lg:px-[7vw] lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b17a2d]">
              Presença sem volume
            </span>
            <h2 className="mt-5 font-serif text-[clamp(3rem,5vw,5.5rem)] font-normal leading-[.9] tracking-[-0.05em]">
              Pronto para
              <br />
              <i className="font-normal text-[#b88a3b]">qualquer lugar.</i>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map(([number, title, description]) => (
              <article
                className="border-t border-[#0b2447]/18 pt-5"
                key={number}
              >
                <span className="font-serif text-lg text-[#b88a3b]">{number}</span>
                <h3 className="mt-8 font-serif text-2xl font-normal">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#0b2447]/60">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#0b2447] text-[#fffaf4] lg:grid-cols-[1.02fr_.98fr]">
          <div className="min-h-[30rem] overflow-hidden bg-white">
            <img
              className="h-full w-full object-cover object-center"
              src="/suporte-pocket-descricao.png"
              alt="Descrição do Suporte Pocket e opções nas cores preto, branco e rosa"
            />
          </div>
          <div className="flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-[6vw]">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.23em] text-[#d8bc7b]">
              Compacto por escolha
            </span>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,5vw,5rem)] font-normal leading-[.9] tracking-[-0.04em]">
              Fechado, desaparece.
              <br />
              <i className="font-normal text-[#e9b2b8]">Aberto, resolve.</i>
            </h2>
            <p className="mt-7 max-w-md text-sm leading-7 text-white/68">
              Escolha entre preto, branco ou rosa. Cada peça é impressa sob
              encomenda e montada para que o movimento de abrir e fechar seja
              parte natural do uso.
            </p>
            <a
              className="mt-9 inline-flex w-fit items-center gap-5 border-b border-[#d8bc7b] pb-2 text-sm font-semibold"
              href="#topo"
            >
              Escolher o seu <span className="text-xl text-[#d8bc7b]">↑</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-5 px-7 py-10 text-xs text-[#0b2447]/65 sm:flex-row sm:items-center">
        <span>Artgian Studio · Elegância impressa em cada detalhe.</span>
        <Link className="font-semibold text-[#0b2447]" href="/produtos">
          Ver todos os produtos →
        </Link>
      </footer>
    </main>
  );
}
