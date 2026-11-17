import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Layers, PenLine, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { getPublicProductCatalog } from "../lib/products/repository";
import { formatBrl, type Product } from "../lib/catalog";
import BrandHeader from "./components/BrandHeader";
import { organizationStructuredData, serializeStructuredData } from "../lib/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const WHATSAPP_URL = "https://wa.me/5516997432741";

const sectionLabel =
  "flex items-center gap-3 text-[0.68rem] font-bold uppercase tracking-[0.2em]";
const sectionNumber =
  "grid size-10 place-items-center rounded-full border border-current font-serif text-sm font-normal tracking-normal";
const serifTitle =
  "font-serif font-normal leading-[0.92] tracking-[-0.055em]";

const assurances = [
  [Layers, "Feito sob encomenda", "Impresso camada por camada"],
  [PenLine, "Peças personalizadas", "Projetos sob medida"],
  [Truck, "Envio para todo o Brasil", "Frete calculado ao finalizar"],
  [ShieldCheck, "Pagamento seguro", "Pix, cartão ou boleto"],
] as const;

const customSteps = [
  ["Conte a sua ideia", "Envie uma referência, um desenho ou explique o que imaginou."],
  ["Ajustamos o projeto", "Definimos medidas, cores e acabamento antes de produzir."],
  ["Produzimos e enviamos", "Sua peça é impressa, revisada e embalada com cuidado."],
] as const;

const values = [
  ["◇", "Criação próxima", "Você participa das escolhas para que o resultado tenha a sua identidade."],
  ["✦", "Detalhe visível", "Cada camada faz parte da estética e recebe atenção até o acabamento."],
  ["○", "Feito para durar", "Materiais selecionados e produção consciente, sem excessos."],
] as const;

function productPrice(product: Product) {
  if (product.pricingType === "quote") return { value: "Sob orçamento", cents: null };
  if (product.pricingType === "from") {
    const cents = product.priceFromCents || 0;
    return { prefix: "A partir de", value: formatBrl(cents), cents };
  }
  const prices = product.variants.map((v) => v.priceCents ?? product.basePriceCents ?? 0);
  const cents = prices.length ? Math.min(...prices) : (product.basePriceCents ?? 0);
  return {
    prefix: new Set(prices).size > 1 ? "A partir de" : undefined,
    value: formatBrl(cents),
    cents,
  };
}

// The shelf fills whole rows: on phones an odd count widens the first card, and on
// the four-column desktop grid the first cards grow so the last row is never short.
function cardLayout(index: number, count: number) {
  const mobileWide = index === 0 && count % 2 === 1;
  const remainder = count % 4;
  const desktop =
    index === 0 && remainder === 1 && count > 1
      ? "feature"
      : (index === 0 && remainder === 3) || (index < 2 && remainder === 2)
        ? "wide"
        : "regular";
  const span = [
    mobileWide && "col-span-2",
    desktop === "feature" && "lg:col-span-2 lg:row-span-2",
    desktop === "wide" && "lg:col-span-2",
  ];
  // Wide and featured tiles stretch to the row height set by the regular cards.
  const frame = [
    mobileWide ? "aspect-[5/4] sm:aspect-[16/10]" : "aspect-[4/5]",
    desktop === "feature" && "lg:aspect-auto lg:min-h-[30rem] lg:flex-1",
    desktop === "wide" && "lg:aspect-auto lg:min-h-[22rem] lg:flex-1",
    desktop === "regular" && mobileWide && "lg:aspect-[4/5]",
  ];
  return {
    span: span.filter(Boolean).join(" "),
    frame: frame.filter(Boolean).join(" "),
    // Stretched tiles give the spare height to the photo, not to the caption.
    caption: desktop === "regular" ? "flex-1" : "flex-1 lg:flex-none",
    feature: desktop === "feature",
  };
}

function ProductCard({
  product,
  index,
  count,
}: {
  product: Product;
  index: number;
  count: number;
}) {
  const { span, frame, caption, feature: isFeature } = cardLayout(index, count);
  const price = productPrice(product);
  const buyable = product.purchasable && product.pricingType === "fixed";
  const multiTone = product.variants.some((v) => v.swatches.length > 1);

  return (
    <Link
      className={`group flex flex-col rounded-[1.6rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b] ${span}`}
      href={product.href}
    >
      <div
        className={`relative overflow-hidden rounded-[1.5rem] bg-[#e9dfcf] ${frame}`}
      >
        <img
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.04]"
          src={product.image}
          alt={product.alt}
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 sm:top-4 sm:left-4">
          {isFeature && (
            <span className="rounded-full bg-[#0b2447] px-3 py-1.5 text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[#f7f3ea] shadow-sm sm:text-[0.6rem]">
              Em destaque
            </span>
          )}
          {product.customizable && (
            <span className="rounded-full border border-white/50 bg-white/70 px-3 py-1.5 text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[#0b2447] shadow-sm backdrop-blur-xl sm:text-[0.6rem]">
              Personalizável
            </span>
          )}
        </div>
      </div>

      <div className={`mt-4 flex flex-col sm:mt-5 ${caption}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#b88a3b] sm:text-[0.65rem]">
            {product.category}
          </span>
          {product.variants.length > 1 && (
            <span className="flex shrink-0 items-center gap-2" title={product.variants.map((v) => v.name).join(", ")}>
              <span className="flex -space-x-1" aria-hidden="true">
                {product.variants.slice(0, 4).map((variant) => (
                  <i
                    className="flex size-3.5 overflow-hidden rounded-full border border-[#f7f3ea] ring-1 ring-[#0b2447]/15"
                    key={variant.key}
                  >
                    {variant.swatches.map((swatch, i) => (
                      <b className="h-full flex-1" key={i} style={{ backgroundColor: swatch }} />
                    ))}
                  </i>
                ))}
              </span>
              <span className="hidden text-[0.65rem] font-semibold text-[#647087] sm:inline lg:hidden xl:inline">
                {product.variants.length} {multiTone ? "combinações" : "cores"}
              </span>
            </span>
          )}
        </div>
        <h3
          className={`mt-2 font-serif leading-tight font-normal tracking-[-0.02em] ${
            isFeature ? "text-2xl sm:text-4xl" : "text-lg sm:text-2xl"
          }`}
        >
          {product.name}
        </h3>
        {isFeature && product.description && (
          <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-[#647087]">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <span className="leading-tight">
            {price.prefix && (
              <span className="block text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[#647087]">
                {price.prefix}
              </span>
            )}
            <strong className={`font-semibold ${isFeature ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>
              {price.value}
            </strong>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0b2447] p-2.5 text-xs font-semibold text-[#fffdf8] transition group-hover:bg-[#143866] sm:py-2.5 sm:pr-4 sm:pl-3.5">
            <ShoppingBag size={16} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{buyable ? "Comprar" : "Ver detalhes"}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function Home() {
  const listed = Object.values(await getPublicProductCatalog()).filter((p) => p.listed);
  // Featured pieces lead the shelf; the rest of the listed catalog follows.
  const products = [...listed.filter((p) => p.featured), ...listed.filter((p) => !p.featured)];
  const startingCents = products
    .map((p) => productPrice(p).cents)
    .filter((cents): cents is number => typeof cents === "number" && cents > 0);
  const startingPrice = startingCents.length ? formatBrl(Math.min(...startingCents)) : null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ea] text-[#0b2447]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(organizationStructuredData) }}
      />
      <BrandHeader fixed />

      <section
        className="mx-auto max-w-[1600px] px-5 pt-28 sm:px-8 sm:pt-36 lg:px-16 lg:pt-40"
        id="inicio"
      >
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] lg:gap-14">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-[#b88a3b]/70 bg-[#fffdf8]/60 px-4 py-2 text-xs font-semibold text-[#9b702a] sm:text-sm">
              Impressão 3D <i className="size-1 rounded-full bg-[#b88a3b]" /> Feito
              sob medida
            </div>
            <h1 className={`${serifTitle} mt-6 text-[clamp(2.9rem,5.6vw,5.6rem)]`}>
              Ideias ganham{" "}
              <span className="text-transparent [-webkit-text-stroke:1.2px_#0b2447]">
                forma.
              </span>
              <span className="block">
                Detalhes{" "}
                <i className="font-normal text-[#b88a3b]">viram memória.</i>
              </span>
            </h1>
            <p className="mt-6 max-w-md text-[0.95rem] leading-7 text-[#647087]">
              Decoração, organização e presentes impressos em 3D. Escolha uma
              peça da loja ou crie algo só seu.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <a
                className="inline-flex items-center gap-5 rounded-full bg-[#0b2447] py-3 pr-3 pl-6 text-sm font-semibold text-[#fffdf8] shadow-lg shadow-[#0b2447]/15 transition hover:-translate-y-0.5 hover:bg-[#143866] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b]"
                href="#produtos"
              >
                Comprar agora
                <span className="grid size-9 place-items-center rounded-full bg-[#d8bc7b] text-lg text-[#0b2447]" aria-hidden="true">
                  →
                </span>
              </a>
              <a
                className="inline-flex items-center gap-3 border-b border-[#b88a3b]/70 pb-1 text-sm font-semibold transition hover:text-[#9b702a]"
                href="#personalizados"
              >
                Criar peça personalizada <b className="text-[#b88a3b]">→</b>
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="relative h-[17rem] overflow-hidden rounded-[2rem] bg-[#e9dfcf] shadow-[0_30px_80px_rgba(11,36,71,0.12)] sm:h-[30rem] lg:h-[36rem]">
              <Image
                fill
                sizes="(max-width: 1023px) 100vw, 55vw"
                loading="eager"
                fetchPriority="high"
                className="object-cover object-center mix-blend-multiply"
                src="/hero-gallery.png"
                alt="Chaveiro de ursinho, escultura, luminária e miniatura impressos em 3D"
              />
            </div>
            <a
              className="absolute -bottom-5 left-5 grid size-28 place-content-center rounded-full border border-white/50 bg-[linear-gradient(145deg,rgba(216,188,123,.96),rgba(184,135,50,.92))] text-center font-serif text-base leading-tight shadow-[0_18px_50px_rgba(87,59,18,.25)] backdrop-blur-xl transition hover:-rotate-3 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0b2447] sm:left-8 sm:size-36 sm:text-lg"
              href="#produtos"
            >
              <span className="text-xl" aria-hidden="true">
                ◇
              </span>
              Ver
              <br />
              produtos
            </a>
            {startingPrice && (
              <span className="absolute top-4 right-4 rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-right shadow-lg backdrop-blur-xl sm:top-6 sm:right-6">
                <span className="block text-[0.55rem] font-bold uppercase tracking-[0.18em] text-[#647087]">
                  Peças a partir de
                </span>
                <b className="font-serif text-xl font-normal sm:text-2xl">{startingPrice}</b>
              </span>
            )}
          </div>
        </div>

        <ul
          className="mt-12 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-[#b88a3b]/30 py-5 sm:gap-x-5 sm:gap-y-6 sm:py-6 lg:mt-16 lg:grid-cols-4"
          aria-label="Por que comprar na Artgian"
        >
          {assurances.map(([Icon, title, description]) => (
            <li className="flex items-center gap-2.5 sm:items-start sm:gap-3" key={title}>
              <Icon className="shrink-0 text-[#b88a3b] sm:mt-0.5" size={20} strokeWidth={1.6} aria-hidden="true" />
              <span>
                <strong className="block text-xs leading-snug sm:text-sm">{title}</strong>
                <span className="mt-0.5 hidden text-xs text-[#647087] sm:block">
                  {description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="mx-auto max-w-[1600px] scroll-mt-28 px-5 pt-12 pb-20 sm:px-8 sm:pt-16 lg:px-16 lg:pt-20 lg:pb-28"
        id="produtos"
      >
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className={sectionLabel}>
              <span className={sectionNumber}>01</span> Loja Artgian
            </div>
            <h2 className={`${serifTitle} mt-6 text-[clamp(2.7rem,5vw,4.8rem)]`}>
              Escolha a <i className="font-normal text-[#b88a3b]">sua peça.</i>
            </h2>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-4 rounded-full border border-[#0b2447]/20 bg-white/45 py-2 pr-2 pl-5 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
            href="/produtos"
          >
            Ver todos os produtos
            <span className="grid size-8 place-items-center rounded-full bg-[#0b2447] text-white" aria-hidden="true">
              →
            </span>
          </Link>
        </header>

        {products.length ? (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:mt-12 lg:grid-cols-4 lg:gap-y-12">
            {products.map((product, index) => (
              <ProductCard count={products.length} index={index} key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-[1.5rem] border border-[#0b2447]/10 bg-white/50 p-8 text-sm text-[#647087]">
            Novas criações chegam em breve. Enquanto isso, conte para nós o que
            você imaginou.
          </p>
        )}
      </section>

      <section className="mx-3 scroll-mt-24 sm:mx-5" id="personalizados">
        <div className="mx-auto grid max-w-[1600px] overflow-hidden rounded-[2rem] bg-[#ebe4d8] lg:grid-cols-[.85fr_1.15fr]">
          <div className="relative min-h-[22rem] sm:min-h-[30rem] lg:min-h-full">
            <Image
              fill
              sizes="(max-width: 1023px) 100vw, 42vw"
              className="object-cover"
              src="/personalized-gifts.png"
              alt="Presentes personalizados produzidos pela Artgian Studio"
            />
            <span className="absolute right-5 bottom-5 rounded-2xl border border-white/50 bg-white/45 px-5 py-4 font-serif text-lg leading-snug shadow-lg backdrop-blur-xl">
              Feito especialmente
              <br />
              para alguém.
            </span>
          </div>

          <div className="px-6 py-14 sm:px-12 lg:px-[5vw] lg:py-20">
            <div className={sectionLabel}>
              <span className={sectionNumber}>02</span> Sob medida
            </div>
            <h2 className={`${serifTitle} mt-8 text-[clamp(2.7rem,4.6vw,4.8rem)]`}>
              Não encontrou?{" "}
              <i className="font-normal text-[#b88a3b]">Criamos algo só seu.</i>
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[#647087]">
              Lembranças para eventos, presentes com nomes e frases, protótipos
              e decoração sob medida. Cada projeto começa com uma conversa.
            </p>

            <ol
              className="mt-10 grid scroll-mt-32 gap-6 border-t border-[#0b2447]/15 pt-8 sm:grid-cols-3"
              id="como-funciona"
              aria-label="Como funciona"
            >
              {customSteps.map(([title, description], index) => (
                <li key={title}>
                  <span className="font-serif text-lg text-[#b88a3b]">0{index + 1}</span>
                  <h3 className="mt-2 font-serif text-xl leading-tight">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[#647087]">{description}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex scroll-mt-40 flex-col gap-4 sm:flex-row sm:items-center" id="orcamento">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-5 rounded-full bg-[#0b2447] py-3 pr-3 pl-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b]"
              >
                Pedir orçamento
                <span className="grid size-9 place-items-center rounded-full bg-[#d8bc7b] text-lg text-[#0b2447]" aria-hidden="true">
                  →
                </span>
              </a>
              <small className="text-[0.68rem] leading-5 text-[#0b2447]/65">
                Atendimento pelo WhatsApp · Envio para todo o Brasil
              </small>
            </div>
          </div>
        </div>
      </section>

      <section
        className="mt-20 bg-[#0b2447] px-5 py-20 text-[#f7f3ea] sm:px-10 lg:mt-28 lg:px-[8vw] lg:py-24"
        id="sobre"
      >
        <div className="mx-auto grid max-w-[1600px] items-end gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className={`${sectionLabel} text-[#d8bc7b]`}>
              <span className={sectionNumber}>03</span> Nossa essência
            </div>
            <h2 className={`${serifTitle} mt-8 text-[clamp(2.8rem,5.4vw,5.6rem)]`}>
              Transformamos o extraordinário em{" "}
              <em className="font-normal text-[#d8bc7b]">forma.</em>
            </h2>
            <p className="mt-6 max-w-md font-serif text-lg leading-7 text-[#d8bc7b]">
              Precisão no processo. Personalidade no resultado.
            </p>
          </div>
          <ul className="divide-y divide-[#d8bc7b]/25 border-y border-[#d8bc7b]/25">
            {values.map(([icon, title, description]) => (
              <li className="grid grid-cols-[2.5rem_1fr] gap-3 py-5" key={title}>
                <b className="font-serif text-2xl font-normal text-[#d8bc7b]" aria-hidden="true">
                  {icon}
                </b>
                <span>
                  <strong className="font-serif text-xl font-normal">{title}</strong>
                  <span className="mt-1 block text-sm leading-6 text-[#b8c1cf]">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="flex flex-col items-start justify-between gap-8 px-6 py-12 text-sm sm:px-10 lg:flex-row lg:items-end">
        <div>
          <a className="flex flex-col leading-none" href="#inicio">
            <b className="font-serif text-3xl font-normal tracking-[0.08em]">
              Artgian
            </b>
            <span className="mt-2 text-[0.55rem] font-bold uppercase tracking-[0.55em]">
              studio
            </span>
          </a>
          <p className="mt-5 text-[#647087]">
            Soluções criativas em impressão 3D.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 font-semibold">
          <Link className="hover:text-[#b88a3b]" href="/produtos">
            Produtos
          </Link>
          <a className="hover:text-[#b88a3b]" href="#personalizados">
            Personalizados
          </a>
          <a className="hover:text-[#b88a3b]" href="#como-funciona">
            Como funciona
          </a>
          <a className="hover:text-[#b88a3b]" href="#orcamento">
            Contato
          </a>
          <Link className="hover:text-[#b88a3b]" href="/politica-de-privacidade">
            Privacidade
          </Link>
          <Link className="hover:text-[#b88a3b]" href="/exclusao-de-dados">
            Exclusão de dados
          </Link>
        </nav>
        <small className="text-[#647087]">© 2026 Artgian Studio</small>
      </footer>
    </main>
  );
}
