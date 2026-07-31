import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import ProductPurchase from "./ProductPurchase";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (host.includes("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/dia-dos-pais-og.png`;
  const title = "Kit Especial Dia dos Pais | Artgian Studio";
  const description =
    "Kit de Dia dos Pais com suporte para lata de 350 ml, chaveiro, cartão e embalagem premium.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: socialImage,
          width: 1536,
          height: 1024,
          alt: "Kit Especial Dia dos Pais — Artgian Studio",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

const features = [
  [
    "01",
    "Suporte para lata",
    "Mantém a lata de 350 ml protegida e transforma o momento de descanso em celebração.",
  ],
  [
    "02",
    "Chaveiro exclusivo",
    "Um detalhe para levar todos os dias, com a mesma identidade visual do presente.",
  ],
  [
    "03",
    "Pronto para presentear",
    "Cartão e embalagem premium completam o kit, preparado com carinho em cada detalhe.",
  ],
];

const personalizationUrl =
  "https://wa.me/5516997432741?text=Ol%C3%A1%2C%20gostaria%20de%20personalizar%20um%20presente%20de%20Dia%20dos%20Pais.";

export default function FathersDayPage() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#d9c4a7] text-[#132746]"
      id="topo"
    >
      <div className="absolute inset-x-0 top-0 h-[58rem] overflow-hidden">
        <div className="absolute -top-40 -left-28 size-[38rem] rounded-full border-[6rem] border-[#f6ead7]/32" />
        <div className="absolute top-20 right-[-10rem] size-[36rem] rounded-full bg-[#b57455]/20 blur-3xl" />
        <div className="absolute top-56 left-[46%] h-px w-[46%] bg-[#f5e5ca]/60" />
      </div>

      <BrandHeader />

      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-14 lg:py-20">
        <div className="relative z-10 lg:py-10">
          <div className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#8a4f3d]">
            <span className="h-px w-10 bg-current" />
            Edição especial · Dia dos Pais
          </div>
          <h1 className="mt-8 max-w-2xl font-serif text-[clamp(4.2rem,8.4vw,8.6rem)] font-normal leading-[0.78] tracking-[-0.07em]">
            Kit especial
            <em className="mt-3 block pl-[14%] font-normal text-[#fff8eb] [text-shadow:0_1px_0_#fff]">
              Dia dos Pais.
            </em>
          </h1>
          <p className="mt-10 max-w-lg text-base leading-7 text-[#132746]/72">
            Um presente completo para celebrar quem sempre esteve por perto.
            Suporte para lata, chaveiro, cartão e embalagem premium em uma
            composição feita com carinho.
          </p>

          <div className="mt-8 flex items-end gap-5 border-t border-[#132746]/15 pt-7">
            <div>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#132746]/55">
                Valor da edição
              </span>
              <strong className="mt-1 block font-serif text-4xl font-normal">
                R$ 39
                <sup className="ml-1 text-base">,90</sup>
              </strong>
            </div>
            <span className="mb-1 rounded-full border border-[#132746]/20 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]">
              Kit completo
            </span>
          </div>

          <ProductPurchase />
        </div>

        <div className="relative min-h-[34rem] lg:min-h-[42rem]">
          <div className="absolute inset-0 rotate-2 rounded-[3rem] bg-[#fff4e3]/35" />
          <figure className="absolute inset-3 overflow-hidden rounded-[2.6rem] bg-[#071120] shadow-[0_35px_90px_rgba(55,38,30,.24)] lg:inset-6">
            <img
              className="h-full w-full object-cover object-center"
              src="/dia-dos-pais-capa-uhd.jpg"
              alt="Kit de Dia dos Pais com suporte para lata, chaveiro, cartão e caixa presente"
            />
          </figure>
          <div className="absolute -bottom-5 -left-3 flex size-28 rotate-[-7deg] flex-col items-center justify-center rounded-full border border-white/45 bg-[#132746] text-center text-[#fff8eb] shadow-xl lg:size-36">
            <span className="font-serif text-2xl">♥</span>
            <span className="mt-1 text-[0.55rem] font-bold uppercase leading-4 tracking-[0.16em]">
              Feito
              <br />
              com carinho
            </span>
          </div>
        </div>
      </section>

      <section className="relative mx-3 overflow-hidden rounded-[2.3rem] bg-[#fffaf3] px-5 py-20 sm:px-10 lg:px-[7vw] lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#a45d46]">
              Um presente completo
            </span>
            <h2 className="mt-5 font-serif text-[clamp(3rem,5vw,5.5rem)] font-normal leading-[.9] tracking-[-0.05em]">
              Tudo pronto
              <br />
              <i className="font-normal text-[#b57455]">para surpreender.</i>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map(([number, title, description]) => (
              <article
                className="border-t border-[#132746]/18 pt-5"
                key={number}
              >
                <span className="font-serif text-lg text-[#b57455]">
                  {number}
                </span>
                <h3 className="mt-8 font-serif text-2xl font-normal">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#132746]/60">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#132746] text-[#fffaf3] lg:grid-cols-[1.08fr_.92fr]">
          <div className="min-h-[40rem] overflow-hidden bg-[#f5efe4]">
            <img
              className="h-full w-full object-contain object-center"
              src="/dia-dos-pais-ambiente-uhd.jpg"
              alt="Apresentação do Kit Especial Dia dos Pais com preço e itens inclusos"
            />
          </div>
          <div className="flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-[6vw]">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.23em] text-[#d6a36d]">
              Detalhes que fazem a diferença
            </span>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,5vw,5rem)] font-normal leading-[.9] tracking-[-0.04em]">
              Um kit.
              <br />
              <i className="font-normal text-[#d9c4a7]">Muitos significados.</i>
            </h2>
            <p className="mt-7 max-w-md text-sm leading-7 text-white/68">
              A identidade do suporte para lata se repete no chaveiro e encontra
              o cartão em uma caixa preparada para encantar desde o primeiro
              momento.
            </p>
            <a
              className="mt-9 inline-flex w-fit items-center gap-5 border-b border-[#d6a36d] pb-2 text-sm font-semibold"
              href="#topo"
            >
              Comprar o kit
              <span className="text-xl text-[#d6a36d]">↑</span>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pt-16 sm:px-8 lg:pt-20">
        <div className="grid items-center gap-7 rounded-[1.8rem] border border-[#132746]/12 bg-[#fffaf3]/65 p-6 shadow-[0_18px_55px_rgba(19,39,70,.08)] sm:p-8 lg:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#b57455] font-serif text-lg text-white">
              ✦
            </span>
            <div>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#8a4f3d]">
                Uma opção ainda mais pessoal
              </span>
              <h2 className="mt-2 font-serif text-2xl font-normal tracking-[-0.025em] sm:text-3xl">
                Quer personalizar o presente do seu pai?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#132746]/62">
                Conte a sua ideia para a Artgian. Podemos criar nomes, frases e
                outros detalhes sob medida para tornar o presente único.
              </p>
            </div>
          </div>
          <a
            className="inline-flex items-center justify-between gap-5 rounded-full bg-[#132746] py-3 pr-3 pl-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203c67]"
            href={personalizationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Conversar sobre personalização
            <span className="grid size-9 place-items-center rounded-full bg-[#d8bc7b] text-lg text-[#132746]">
              ↗
            </span>
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-20 text-center sm:px-8 lg:py-28">
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#8a4f3d]">
          Produção limitada da data
        </span>
        <h2 className="mx-auto mt-5 max-w-4xl font-serif text-[clamp(3rem,6vw,6rem)] font-normal leading-[.9] tracking-[-0.05em]">
          Para entregar afeto no tempo certo.
        </h2>
        <p className="mx-auto mt-7 max-w-xl text-sm leading-7 text-[#132746]/65">
          O kit é preparado sob encomenda. Antecipe seu pedido para garantir o
          tempo de produção, montagem da embalagem e envio.
        </p>
        <a
          className="mt-8 inline-flex items-center gap-4 rounded-full bg-[#132746] py-3 pr-3 pl-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203c67]"
          href="#topo"
        >
          Garantir o presente
          <span className="grid size-9 place-items-center rounded-full bg-[#b57455] text-lg">
            ↑
          </span>
        </a>
      </section>

      <footer className="flex flex-col justify-between gap-5 border-t border-[#132746]/12 px-7 py-10 text-xs text-[#132746]/65 sm:flex-row sm:items-center">
        <span>Artgian Studio · Elegância impressa em cada detalhe.</span>
        <Link className="font-semibold text-[#132746]" href="/">
          Conheça o estúdio →
        </Link>
      </footer>
    </main>
  );
}
