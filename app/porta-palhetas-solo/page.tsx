import type { Metadata } from "next";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import ProductPurchase from "./ProductPurchase";
import ProductColorImage from "../components/ProductColorImage";

export const metadata: Metadata = {
  title: "Porta-Palhetas Solo | Artgian Studio",
  description:
    "Porta-palhetas personalizado com seu nome, produzido sob encomenda em impressão 3D.",
};

const features = [
  [
    "01",
    "Seis palhetas à mão",
    "Uma seleção completa organizada em encaixes individuais e de fácil acesso.",
  ],
  [
    "02",
    "Seu nome na peça",
    "Personalização incluída para transformar um acessório em algo realmente seu.",
  ],
  [
    "03",
    "Base firme",
    "O apoio independente mantém a coleção em destaque sobre mesa, estante ou amplificador.",
  ],
];

export default function PortaPalhetasSoloPage() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#e9b08e] text-[#182645]"
      id="topo"
    >
      <div className="absolute inset-x-0 top-0 h-[55rem] overflow-hidden">
        <div className="absolute top-32 -left-28 size-[28rem] rounded-full border-[4rem] border-[#c96f47]/22" />
        <div className="absolute -top-28 right-[-8rem] size-[36rem] rounded-full bg-[#182645]/12 blur-3xl" />
        <div className="absolute top-52 left-[48%] h-px w-[42%] bg-[#b88a3b]/55" />
      </div>

      <BrandHeader tone="clay" />

      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:px-14 lg:py-20">
        <div className="relative z-10 lg:py-10">
          <div className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#8d442d]">
            <span className="h-px w-10 bg-current" />
            Coleção Música · 01
          </div>
          <h1 className="mt-8 max-w-2xl font-serif text-[clamp(4.3rem,8.2vw,8.5rem)] font-normal leading-[0.78] tracking-[-0.07em]">
            Porta-Palhetas
            <em className="mt-3 block pl-[22%] font-normal text-[#fff8ed] [text-shadow:0_1px_0_#fff]">
              Solo.
            </em>
          </h1>
          <p className="mt-10 max-w-lg text-base leading-7 text-[#182645]/72">
            Sua seleção sempre pronta para o próximo acorde. Uma peça
            escultural que organiza seis palhetas e leva seu nome como parte do
            design.
          </p>

          <div className="mt-8 flex items-end gap-5 border-t border-[#182645]/15 pt-7">
            <div>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#182645]/55">
                A partir de
              </span>
              <strong className="mt-1 block font-serif text-4xl font-normal">
                R$ 29
                <sup className="ml-1 text-base">,90</sup>
              </strong>
            </div>
            <span className="mb-1 rounded-full border border-[#182645]/20 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]">
              Nome incluído
            </span>
          </div>

          <ProductPurchase />
        </div>

        <div className="relative min-h-[38rem] lg:min-h-[48rem]">
          <div className="absolute inset-0 rotate-2 rounded-[3rem] bg-[#fff7ed]/35" />
          <figure className="absolute inset-3 overflow-hidden rounded-[2.6rem] bg-[#fff7ed] shadow-[0_35px_90px_rgba(61,36,26,.22)] lg:inset-6">
            <ProductColorImage
              className="h-full w-full object-cover"
              product="porta-palhetas-solo"
              src="/porta-palhetas-solo-capa.png"
              alt="Porta-Palhetas Solo terracota personalizado com o texto Seu Nome"
              initialColor="terracota"
            />
          </figure>
          <div className="absolute -bottom-5 -left-3 flex size-28 rotate-[-7deg] flex-col items-center justify-center rounded-full border border-white/45 bg-[#182645] text-center text-[#fff8ed] shadow-xl lg:size-36">
            <span className="font-serif text-2xl">♪</span>
            <span className="mt-1 text-[0.55rem] font-bold uppercase leading-4 tracking-[0.16em]">
              Seu ritmo
              <br />
              seu nome
            </span>
          </div>
        </div>
      </section>

      <section className="relative mx-3 overflow-hidden rounded-[2.3rem] bg-[#fffaf4] px-5 py-20 sm:px-10 lg:px-[7vw] lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b17a2d]">
              Pronto para tocar
            </span>
            <h2 className="mt-5 font-serif text-[clamp(3rem,5vw,5.5rem)] font-normal leading-[.9] tracking-[-0.05em]">
              Sua coleção
              <br />
              <i className="font-normal text-[#c96f47]">entra no ritmo.</i>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map(([number, title, description]) => (
              <article
                className="border-t border-[#182645]/18 pt-5"
                key={number}
              >
                <span className="font-serif text-lg text-[#c96f47]">{number}</span>
                <h3 className="mt-8 font-serif text-2xl font-normal">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#182645]/60">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#182645] text-[#fffaf4] lg:grid-cols-[1.02fr_.98fr]">
          <div className="min-h-[30rem] overflow-hidden bg-[#f2d2bd]">
            <img
              className="h-full w-full object-cover object-center"
              src="/porta-palhetas-descricao.png"
              alt="Arte descritiva do Porta-Palhetas Solo com personalização Seu Nome e opções preta e branca"
            />
          </div>
          <div className="flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-[6vw]">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.23em] text-[#d9ad62]">
              Feito especialmente para você
            </span>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,5vw,5rem)] font-normal leading-[.9] tracking-[-0.04em]">
              Não é só suporte.
              <br />
              <i className="font-normal text-[#e9b08e]">É assinatura.</i>
            </h2>
            <p className="mt-7 max-w-md text-sm leading-7 text-white/68">
              Escolha a cor e escreva o nome exatamente como deseja vê-lo na
              peça. Nós cuidamos do encaixe tipográfico antes da produção.
            </p>
            <a
              className="mt-9 inline-flex w-fit items-center gap-5 border-b border-[#d9ad62] pb-2 text-sm font-semibold"
              href="#topo"
            >
              Personalizar agora{" "}
              <span className="text-xl text-[#d9ad62]">↑</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-5 px-7 py-10 text-xs text-[#182645]/65 sm:flex-row sm:items-center">
        <span>Artgian Studio · Elegância impressa em cada detalhe.</span>
        <Link className="font-semibold text-[#182645]" href="/">
          Conheça o estúdio →
        </Link>
      </footer>
    </main>
  );
}
