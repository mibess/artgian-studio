import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, MessageCircle, Package, PenLine } from "lucide-react";
import { getPublicProductCatalog } from "../../lib/products/repository";
import { customizationChoices, CUSTOM_IDEA_MAX, WHATSAPP_URL } from "../../lib/custom-order";
import { productPrice, storefrontProducts } from "../../lib/product-listing";
import BrandHeader from "../components/BrandHeader";
import ScrollToHash from "../components/ScrollToHash";
import CustomQuoteForm from "./CustomQuoteForm";
import IdeaCard from "./IdeaCard";

const description =
  "Presentes com nome, lembrancinhas, miniaturas e peças para o seu negócio, criados sob medida em impressão 3D pela Artgian Studio.";

export const metadata: Metadata = {
  title: "Personalizados | Artgian Studio",
  description,
  alternates: { canonical: "/personalizados" },
  openGraph: {
    title: "Personalizados | Artgian Studio",
    description,
    url: "/personalizados",
    siteName: "Artgian Studio",
    locale: "pt_BR",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Personalizados | Artgian Studio",
    description,
    images: ["/og.png"],
  },
};

const sectionLabel =
  "flex items-center gap-3 text-[0.68rem] font-bold uppercase tracking-[0.2em]";
const sectionNumber =
  "grid size-10 place-items-center rounded-full border border-current font-serif text-sm font-normal tracking-normal";
const serifTitle = "font-serif font-normal leading-[0.95] tracking-[-0.05em]";

const promises = [
  [PenLine, "Do seu jeito", "Nome, cores, tamanho e formato"],
  [CheckCircle2, "Aprovação antes", "Você vê o orçamento primeiro"],
  [MessageCircle, "Conversa direta", "Atendimento pelo WhatsApp"],
] as const;

// Copy follows config/business.json and the custom product records: no prices,
// lead times or guarantees are promised here, because none are registered.
const ideas = [
  {
    type: "presente",
    title: "Presentes com nome",
    text: "Nomes, frases e símbolos que transformam uma peça em lembrança.",
    image: "/porta-palhetas-solo-capa.png",
    alt: "Porta-palhetas impresso em 3D com um nome gravado",
  },
  {
    type: "festa",
    title: "Festas e datas especiais",
    text: "Lembrancinhas pensadas para o tema, a data e a quantidade do seu evento.",
    image: "/kit-natalino-trico-capa.png",
    alt: "Enfeites natalinos impressos em 3D sobre uma bandeja",
  },
  {
    type: "miniatura",
    title: "Miniaturas e colecionáveis",
    text: "Desenvolvidas a partir das suas referências e dos detalhes que importam.",
    image: "/hero-gallery.png",
    alt: "Miniatura de guerreiro e outras peças impressas em 3D",
    position: "object-[88%_50%]",
  },
  {
    type: "negocio",
    title: "Para o seu negócio",
    text: "Displays, brindes e pequenas séries com a identidade da sua marca.",
    image: "/process-printing.png",
    alt: "Bico de uma impressora 3D produzindo uma peça dourada",
  },
] as const;

const steps = [
  [
    "Você conta a ideia",
    "Envie uma referência, uma foto ou explique o que imaginou. Não precisa ter desenho nem arquivo 3D.",
  ],
  [
    "Preparamos o orçamento",
    "Entendemos a personalização e definimos medidas, cores e acabamento com você.",
  ],
  [
    "Produzimos e entregamos",
    "Depois da sua aprovação, a peça é impressa, revisada e segue para entrega ou retirada.",
  ],
] as const;

const questions = [
  [
    "Quanto custa uma peça personalizada?",
    "Depende do tamanho, da complexidade, das cores e da quantidade. Você recebe o orçamento e só aprova a produção depois de ver o valor.",
  ],
  [
    "Qual é o prazo de produção?",
    "O prazo é combinado no orçamento, conforme o projeto e a quantidade de peças.",
  ],
  [
    "Preciso ter um desenho ou arquivo 3D?",
    "Não. Uma foto, uma referência ou a descrição do que você imaginou já são suficientes para começarmos.",
  ],
  [
    "Vocês fazem em quantidade, para festas ou empresas?",
    "Sim. Lembrancinhas, brindes e displays são avaliados conforme o tema, a quantidade e a personalização.",
  ],
  [
    "Como recebo a peça?",
    "Depois de aprovada e produzida, a peça segue para entrega ou retirada, como combinarmos na conversa.",
  ],
] as const;

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function CustomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // A search with no results can hand its term over as the start of the idea.
  const initialIdea = first(params.ideia).trim().slice(0, CUSTOM_IDEA_MAX);
  const initialType = first(params.tipo);
  const customizable = storefrontProducts(Object.values(await getPublicProductCatalog())).filter(
    (p) => p.customizable,
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ea] text-[#0b2447]">
      <ScrollToHash />
      <BrandHeader fixed />

      <section className="mx-auto max-w-[1600px] px-5 pt-28 sm:px-8 sm:pt-36 lg:px-16 lg:pt-40">
        <nav aria-label="Trilha de navegação" className="text-xs text-[#647087]">
          <ol className="flex items-center gap-2">
            <li>
              <Link className="hover:text-[#0b2447]" href="/">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-[#0b2447]">
              Personalizados
            </li>
          </ol>
        </nav>

        <div className="mt-6 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-[#b88a3b]/70 bg-[#fffdf8]/60 px-4 py-2 text-xs font-semibold text-[#9b702a] sm:text-sm">
              Sob medida <i className="size-1 rounded-full bg-[#b88a3b]" /> Impressão 3D
            </div>
            <h1 className={`${serifTitle} mt-6 text-[clamp(2.8rem,5.4vw,5.4rem)]`}>
              Não é apenas um objeto.{" "}
              <i className="font-normal text-[#b88a3b]">É a sua ideia.</i>
            </h1>
            <p className="mt-6 max-w-lg text-[0.95rem] leading-7 text-[#647087]">
              Presentes com nome, lembrancinhas, miniaturas e peças para o seu
              negócio. Você conta o que imaginou, a gente desenvolve o projeto e
              produz em impressão 3D.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <a
                className="inline-flex items-center gap-5 rounded-full bg-[#0b2447] py-3 pr-3 pl-6 text-sm font-semibold text-[#fffdf8] shadow-lg shadow-[#0b2447]/15 transition hover:-translate-y-0.5 hover:bg-[#143866] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b]"
                href="#orcamento"
              >
                Pedir orçamento
                <span className="grid size-9 place-items-center rounded-full bg-[#d8bc7b] text-lg text-[#0b2447]" aria-hidden="true">
                  →
                </span>
              </a>
              <a
                className="inline-flex items-center gap-3 border-b border-[#b88a3b]/70 pb-1 text-sm font-semibold transition hover:text-[#9b702a]"
                href="#como-funciona"
              >
                Ver como funciona <b className="text-[#b88a3b]">→</b>
              </a>
            </div>
            <ul className="mt-10 grid gap-3 border-t border-[#b88a3b]/30 pt-6 text-sm sm:grid-cols-3">
              {promises.map(([Icon, title, text]) => (
                <li className="flex items-start gap-3" key={title}>
                  <Icon className="mt-0.5 shrink-0 text-[#b88a3b]" size={19} strokeWidth={1.6} aria-hidden="true" />
                  <span>
                    <strong className="block text-xs sm:text-sm">{title}</strong>
                    <span className="text-xs text-[#647087]">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative h-[20rem] overflow-hidden rounded-[2rem] bg-[#e9dfcf] shadow-[0_30px_80px_rgba(11,36,71,0.12)] sm:h-[30rem] lg:h-[38rem]">
            <Image
              alt="Presentes personalizados produzidos pela Artgian Studio"
              className="object-cover"
              fetchPriority="high"
              fill
              loading="eager"
              sizes="(max-width: 1023px) 100vw, 50vw"
              src="/personalized-gifts.png"
            />
            <span className="absolute right-5 bottom-5 rounded-2xl border border-white/50 bg-white/45 px-5 py-4 font-serif text-lg leading-snug shadow-lg backdrop-blur-xl">
              Feito especialmente
              <br />
              para alguém.
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] scroll-mt-28 px-5 pt-20 sm:px-8 lg:px-16 lg:pt-28" id="ideias">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className={sectionLabel}>
              <span className={sectionNumber}>01</span> O que criamos
            </div>
            <h2 className={`${serifTitle} mt-6 text-[clamp(2.6rem,4.6vw,4.6rem)]`}>
              Ideias que viram <i className="font-normal text-[#b88a3b]">peça.</i>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#647087]">
            Escolha um ponto de partida ou traga algo completamente novo. Toque
            em uma ideia para começar o pedido.
          </p>
        </header>

        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:mt-12 lg:grid-cols-4">
          {ideas.map((idea) => (
            <IdeaCard key={idea.type} {...idea} />
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-5 rounded-[1.75rem] border border-[#0b2447]/10 bg-white/45 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="font-serif text-xl leading-snug sm:text-2xl">
            Tem outra ideia?{" "}
            <i className="font-normal text-[#b88a3b]">Conte para a gente.</i>
          </p>
          {customizable.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[#647087]">Ou leve uma da loja com o seu nome:</span>
              {customizable.slice(0, 3).map((product) => (
                <Link
                  className="flex items-center gap-3 rounded-full border border-[#0b2447]/10 bg-white/70 py-1.5 pr-4 pl-1.5 transition hover:border-[#0b2447]/30 hover:bg-white"
                  href={product.href}
                  key={product.id}
                >
                  <img alt="" className="size-9 rounded-full object-cover" src={product.image} />
                  <span className="text-sm font-semibold">{product.name}</span>
                  <span className="text-xs text-[#647087]">{productPrice(product).value}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="mt-20 scroll-mt-24 bg-[#0b2447] px-5 py-20 text-[#f7f3ea] sm:px-10 lg:mt-28 lg:px-[8vw] lg:py-24"
        id="como-funciona"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className={`${sectionLabel} text-[#d8bc7b]`}>
            <span className={sectionNumber}>02</span> Como funciona
          </div>
          <h2 className={`${serifTitle} mt-8 max-w-4xl text-[clamp(2.6rem,5vw,5rem)]`}>
            Da primeira conversa à{" "}
            <i className="font-normal text-[#d8bc7b]">última camada.</i>
          </h2>
          <ol className="mt-12 grid gap-8 border-t border-[#d8bc7b]/25 pt-10 sm:grid-cols-3 sm:gap-10">
            {steps.map(([title, text], index) => (
              <li key={title}>
                <span className="font-serif text-4xl text-[#d8bc7b]">0{index + 1}</span>
                <h3 className="mt-4 font-serif text-2xl leading-tight">{title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[#b8c1cf]">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col gap-4 rounded-[1.5rem] border border-[#d8bc7b]/25 bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:p-6">
            <span className="flex shrink-0 items-center gap-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#d8bc7b]">
              <Package size={18} strokeWidth={1.6} aria-hidden="true" /> Dá para personalizar
            </span>
            <ul className="flex flex-wrap gap-2">
              {[...customizationChoices, "Quantidade"].map((choice) => (
                <li
                  className="rounded-full border border-[#d8bc7b]/35 px-4 py-2 text-sm text-[#f7f3ea]"
                  key={choice}
                >
                  {choice}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-3 mt-3 scroll-mt-24 sm:mx-5" id="orcamento">
        <div className="mx-auto grid max-w-[1600px] overflow-hidden rounded-[2rem] bg-[#ebe4d8] lg:grid-cols-[.8fr_1.2fr]">
          <div className="px-6 pt-14 pb-6 sm:px-12 lg:px-[4.5vw] lg:py-20">
            <div className={sectionLabel}>
              <span className={sectionNumber}>03</span> Orçamento
            </div>
            <h2 className={`${serifTitle} mt-8 text-[clamp(2.6rem,4.4vw,4.4rem)]`}>
              Conte a sua <i className="font-normal text-[#b88a3b]">ideia.</i>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-[#647087]">
              Preencha o que souber. O resto a gente conversa: você recebe o
              orçamento pelo WhatsApp e só aprova a produção quando estiver tudo
              do seu jeito.
            </p>
            <ul className="mt-8 grid gap-3 text-sm">
              {[
                "Não precisa de desenho nem arquivo 3D",
                "Fotos e referências são bem-vindas na conversa",
                "Valor e detalhes combinados antes de produzir",
              ].map((item) => (
                <li className="flex items-start gap-3" key={item}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#b88a3b]" size={18} strokeWidth={1.7} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs text-[#647087]">
              Prefere conversar direto?{" "}
              <a
                className="font-semibold text-[#0b2447] underline decoration-[#b88a3b] underline-offset-4"
                href={WHATSAPP_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                Chamar no WhatsApp
              </a>
            </p>
          </div>
          <div className="m-3 rounded-[1.5rem] border border-white/60 bg-[#fffdf8]/85 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] sm:p-8 lg:my-5 lg:mr-5 lg:ml-0">
            <CustomQuoteForm initialIdea={initialIdea} initialType={initialType} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1600px] scroll-mt-28 gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-16 lg:py-28" id="duvidas">
        <div>
          <div className={sectionLabel}>
            <span className={sectionNumber}>04</span> Dúvidas
          </div>
          <h2 className={`${serifTitle} mt-6 text-[clamp(2.4rem,4vw,4rem)]`}>
            Antes de <i className="font-normal text-[#b88a3b]">começar.</i>
          </h2>
        </div>
        <div className="divide-y divide-[#0b2447]/12 border-y border-[#0b2447]/12">
          {questions.map(([question, answer]) => (
            <details className="group py-5" key={question}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-xl leading-snug marker:hidden [&::-webkit-details-marker]:hidden">
                {question}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#0b2447]/15 text-[#b88a3b] transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#647087]">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-5 border-t border-[#0b2447]/10 px-7 py-10 text-xs text-[#0b2447]/60 sm:flex-row sm:items-center">
        <span>Artgian Studio · Elegância impressa em cada detalhe.</span>
        <div className="flex gap-6 font-semibold text-[#0b2447]">
          <Link href="/produtos">Ver produtos →</Link>
          <Link href="/">Voltar ao início →</Link>
        </div>
      </footer>
    </main>
  );
}
