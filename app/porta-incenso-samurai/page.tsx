import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import ProductPurchase from "./ProductPurchase";

export const metadata: Metadata = {
  title: "Porta-Incenso Samurai | Artgian Studio",
  description:
    "Porta-incenso escultural com samurai e bandeja coletora, produzido sob encomenda em impressão 3D.",
};

const features = [
  [
    "01",
    "Incenso em guarda",
    "O samurai sustenta a vareta em posição de combate e transforma o uso em cena.",
  ],
  [
    "02",
    "Cinzas no lugar",
    "A bandeja alongada acompanha a vareta e ajuda a manter a superfície organizada.",
  ],
  [
    "03",
    "Detalhe escultural",
    "Armadura, postura e textura da impressão 3D dão presença à peça mesmo fora de uso.",
  ],
];

const specifications = [
  ["Altura", "11 cm"],
  ["Largura", "24 cm"],
  ["Profundidade", "15 cm"],
  ["Peso", "150 g"],
];

export default function PortaIncensoSamuraiPage() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#caa77d] text-[#211a18]"
      id="topo"
    >
      <div className="absolute inset-x-0 top-0 h-[55rem] overflow-hidden">
        <div className="absolute -top-40 -left-40 size-[38rem] rounded-full border-[6rem] border-[#f4e6d2]/25" />
        <div className="absolute top-16 right-[-10rem] size-[40rem] rounded-full bg-[#173344]/18 blur-3xl" />
        <div className="absolute top-56 left-[45%] h-px w-[46%] bg-[#6f3e2a]/35" />
      </div>

      <BrandHeader tone="clay" />

      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:px-14 lg:py-20">
        <div className="relative z-10 lg:py-10">
          <div className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#703f2d]">
            <span className="h-px w-10 bg-current" />
            Coleção Bem-estar · 01
          </div>
          <h1 className="mt-8 max-w-2xl font-serif text-[clamp(4.2rem,8.2vw,8.5rem)] font-normal leading-[0.78] tracking-[-0.07em]">
            Porta-Incenso
            <em className="mt-3 block pl-[21%] font-normal text-[#fff8ed] [text-shadow:0_1px_0_#fff]">
              Samurai.
            </em>
          </h1>
          <p className="mt-10 max-w-lg text-base leading-7 text-[#211a18]/72">
            Um guardião para o seu momento de pausa. O samurai sustenta o
            incenso enquanto a bandeja recebe as cinzas e transforma o ritual
            em uma composição marcante.
          </p>

          <div className="mt-8 flex items-end gap-5 border-t border-[#211a18]/15 pt-7">
            <div>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#211a18]/55">
                A partir de
              </span>
              <strong className="mt-1 block font-serif text-4xl font-normal">
                R$ 17
                <sup className="ml-1 text-base">,90</sup>
              </strong>
            </div>
            <span className="mb-1 rounded-full border border-[#211a18]/20 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]">
              Sob encomenda
            </span>
          </div>

          <ProductPurchase />
        </div>

        <div className="relative min-h-[36rem] lg:min-h-[48rem]">
          <div className="absolute inset-0 rotate-2 rounded-[3rem] bg-[#f6ead9]/30" />
          <figure className="absolute inset-3 overflow-hidden rounded-[2.6rem] bg-[#dfc6a6] shadow-[0_35px_90px_rgba(47,31,23,.28)] lg:inset-6">
            <Image
              className="h-full w-full object-cover"
              src="/porta-incenso-samurai-capa.png"
              alt="Porta-Incenso Samurai preto com bandeja coletora"
              width={1122}
              height={1402}
              priority
            />
          </figure>
          <div className="absolute -bottom-5 -left-3 flex size-28 rotate-[-7deg] flex-col items-center justify-center rounded-full border border-white/35 bg-[#183443] text-center text-[#fff8ed] shadow-xl lg:size-36">
            <span className="font-serif text-2xl">静</span>
            <span className="mt-1 text-[0.55rem] font-bold uppercase leading-4 tracking-[0.16em]">
              Presença
              <br />
              em equilíbrio
            </span>
          </div>
        </div>
      </section>

      <section className="relative mx-3 overflow-hidden rounded-[2.3rem] bg-[#fffaf4] px-5 py-20 sm:px-10 lg:px-[7vw] lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#9a653f]">
              Ritual com presença
            </span>
            <h2 className="mt-5 font-serif text-[clamp(3rem,5vw,5.5rem)] font-normal leading-[.9] tracking-[-0.05em]">
              Serenidade
              <br />
              <i className="font-normal text-[#b77a4e]">em posição de combate.</i>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map(([number, title, description]) => (
              <article
                className="border-t border-[#211a18]/18 pt-5"
                key={number}
              >
                <span className="font-serif text-lg text-[#b77a4e]">
                  {number}
                </span>
                <h3 className="mt-8 font-serif text-2xl font-normal">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#211a18]/60">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#183443] text-[#fffaf4] lg:grid-cols-[1.02fr_.98fr]">
          <div className="min-h-[30rem] overflow-hidden bg-[#142832]">
            <Image
              className="h-full w-full object-cover object-center"
              src="/porta-incenso-samurai-ambiente.png"
              alt="Porta-Incenso Samurai em uso sobre aparador de madeira"
              width={1254}
              height={1254}
            />
          </div>
          <div className="flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-[6vw]">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.23em] text-[#d6aa72]">
              Medidas da peça
            </span>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,5vw,5rem)] font-normal leading-[.9] tracking-[-0.04em]">
              Alongado na forma.
              <br />
              <i className="font-normal text-[#d7b389]">Marcante no detalhe.</i>
            </h2>
            <dl className="mt-9 grid grid-cols-2 border-t border-white/18">
              {specifications.map(([label, value]) => (
                <div className="border-b border-white/18 py-4" key={label}>
                  <dt className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-white/48">
                    {label}
                  </dt>
                  <dd className="mt-1 font-serif text-2xl text-[#f4d7b3]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <a
              className="mt-9 inline-flex w-fit items-center gap-5 border-b border-[#d6aa72] pb-2 text-sm font-semibold"
              href="#topo"
            >
              Escolher o meu <span className="text-xl text-[#d6aa72]">↑</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-5 px-7 py-10 text-xs text-[#211a18]/65 sm:flex-row sm:items-center">
        <span>Artgian Studio · Elegância impressa em cada detalhe.</span>
        <Link className="font-semibold text-[#211a18]" href="/produtos">
          Ver todos os produtos →
        </Link>
      </footer>
    </main>
  );
}
