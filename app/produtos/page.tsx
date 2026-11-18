import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { getPublicProductCatalog } from "../../lib/products/repository";
import {
  normalizeSearch,
  productSorts,
  searchProducts,
  sortProducts,
  storefrontProducts,
  type ProductSort,
} from "../../lib/product-listing";
import BrandHeader from "../components/BrandHeader";
import FloatingWhatsApp from "../components/FloatingWhatsApp";
import ProductCard from "../components/ProductCard";
import SortSelect from "./SortSelect";

export const metadata: Metadata = {
  title: "Produtos | Artgian Studio",
  alternates: { canonical: "/produtos" },
  description:
    "Conheça as criações em impressão 3D da Artgian Studio e consulte a disponibilidade e o prazo de envio de cada peça.",
  openGraph: {
    title: "Produtos | Artgian Studio",
    description: "Presentes, decoração e peças funcionais em impressão 3D. Consulte a disponibilidade e o prazo de envio de cada peça.",
    url: "/produtos",
    siteName: "Artgian Studio",
    locale: "pt_BR",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Produtos | Artgian Studio",
    description: "Presentes, decoração e peças funcionais em impressão 3D. Consulte a disponibilidade e o prazo de envio de cada peça.",
    images: ["/og.png"],
  },
};

type Filters = { busca: string; categoria: string; ordem: ProductSort };

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function listingHref({ busca, categoria, ordem }: Filters) {
  const query = new URLSearchParams();
  if (busca) query.set("busca", busca);
  if (categoria) query.set("categoria", categoria);
  if (ordem !== "destaques") query.set("ordem", ordem);
  const search = query.toString();
  return search ? `/produtos?${search}` : "/produtos";
}

const chip =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b]";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ordemParam = first(params.ordem);
  const busca = first(params.busca).trim().slice(0, 100);
  const ordem: ProductSort = ordemParam in productSorts ? (ordemParam as ProductSort) : "destaques";

  const catalog = storefrontProducts(Object.values(await getPublicProductCatalog()));
  const found = busca ? searchProducts(catalog, busca) : catalog;
  const categoryNames = [...new Set(catalog.map((p) => p.category).filter(Boolean))];
  const categoria =
    categoryNames.find((c) => normalizeSearch(c) === normalizeSearch(first(params.categoria))) ?? "";
  // Chips refine the current search, so they only offer categories that still have results.
  const chips = categoryNames.filter((c) => c === categoria || found.some((p) => p.category === c));
  const products = sortProducts(
    categoria ? found.filter((p) => p.category === categoria) : found,
    ordem,
  );
  const filters = { busca, categoria, ordem };

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader fixed />

      <section className="mx-auto max-w-[1600px] px-5 pt-28 pb-20 sm:px-8 sm:pt-36 lg:px-16 lg:pt-40 lg:pb-28">
        <nav aria-label="Trilha de navegação" className="text-xs text-[#647087]">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link className="hover:text-[#0b2447]" href="/">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              {busca || categoria ? (
                <Link className="hover:text-[#0b2447]" href="/produtos">
                  Produtos
                </Link>
              ) : (
                <span aria-current="page" className="font-semibold text-[#0b2447]">
                  Produtos
                </span>
              )}
            </li>
            {(busca || categoria) && (
              <>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="font-semibold text-[#0b2447]">
                  {busca ? "Busca" : categoria}
                </li>
              </>
            )}
          </ol>
        </nav>

        <header className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-serif text-[clamp(2.5rem,5vw,4.4rem)] leading-[0.95] font-normal tracking-[-0.05em] break-words">
              {busca ? (
                <>
                  Resultados para{" "}
                  <i className="font-normal text-[#b88a3b]">“{busca}”</i>
                </>
              ) : categoria ? (
                <>
                  {categoria}
                  <i className="font-normal text-[#b88a3b]">.</i>
                </>
              ) : (
                <>
                  Todas as <i className="font-normal text-[#b88a3b]">peças.</i>
                </>
              )}
            </h1>
            <p className="mt-3 text-sm text-[#647087]">
              {products.length} {products.length === 1 ? "peça" : "peças"} · Confira o prazo de envio em cada peça
              {busca && (
                <>
                  {" · "}
                  <Link
                    className="inline-flex items-center gap-1 font-semibold text-[#0b2447] underline decoration-[#b88a3b] underline-offset-4"
                    href={listingHref({ ...filters, busca: "", categoria: "" })}
                  >
                    Limpar busca <X size={13} aria-hidden="true" />
                  </Link>
                </>
              )}
            </p>
          </div>
          {products.length > 1 && (
            <SortSelect
              options={Object.entries(productSorts).map(([value, label]) => ({
                value,
                label,
                href: listingHref({ ...filters, ordem: value as ProductSort }),
              }))}
              value={ordem}
            />
          )}
        </header>

        {chips.length > 1 && (
          <nav
            aria-label="Filtrar por categoria"
            className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            <Link
              aria-current={!categoria ? "page" : undefined}
              className={`${chip} ${
                !categoria
                  ? "border-[#0b2447] bg-[#0b2447] text-[#fffdf8]"
                  : "border-[#0b2447]/15 bg-white/50 hover:border-[#0b2447]/35 hover:bg-white"
              }`}
              href={listingHref({ ...filters, categoria: "" })}
              scroll={false}
            >
              Todas
            </Link>
            {chips.map((name) => {
              const selected = name === categoria;
              return (
                <Link
                  aria-current={selected ? "page" : undefined}
                  className={`${chip} ${
                    selected
                      ? "border-[#0b2447] bg-[#0b2447] text-[#fffdf8]"
                      : "border-[#0b2447]/15 bg-white/50 hover:border-[#0b2447]/35 hover:bg-white"
                  }`}
                  href={listingHref({ ...filters, categoria: selected ? "" : name })}
                  key={name}
                  scroll={false}
                >
                  {name}
                  {selected && <X size={14} aria-hidden="true" />}
                </Link>
              );
            })}
          </nav>
        )}

        {products.length ? (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:mt-10 lg:gap-y-12 xl:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard eager={index < 4} key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-[1.75rem] border border-dashed border-[#0b2447]/20 bg-white/40 px-6 py-16 text-center">
            <p className="font-serif text-3xl leading-tight">Nenhuma peça encontrada.</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#647087]">
              Tente outro termo ou outra categoria. Se a peça ainda não existe,
              podemos criá-la sob medida para você.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[#0b2447]/20 bg-white/60 px-5 text-sm font-semibold hover:bg-white"
                href="/produtos"
              >
                Ver todas as peças
              </Link>
              <Link
                className="inline-flex h-11 items-center gap-3 rounded-full bg-[#0b2447] pr-2 pl-5 text-sm font-semibold text-white hover:bg-[#143866]"
                href={busca ? `/personalizados?ideia=${encodeURIComponent(busca)}#orcamento` : "/personalizados"}
              >
                Pedir peça personalizada
                <span className="grid size-7 place-items-center rounded-full bg-[#d8bc7b] text-[#0b2447]" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="mx-3 sm:mx-5">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 rounded-[2rem] bg-[#ebe4d8] px-6 py-10 sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:px-16">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#b88a3b]">
              Sob medida
            </span>
            <h2 className="mt-3 font-serif text-[clamp(1.9rem,3vw,2.8rem)] leading-[1.02] font-normal tracking-[-0.04em]">
              Não encontrou o que imaginou?{" "}
              <i className="font-normal text-[#b88a3b]">Criamos algo só seu.</i>
            </h2>
          </div>
          <Link
            className="inline-flex w-fit shrink-0 items-center gap-4 rounded-full bg-[#0b2447] py-2 pr-2 pl-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#143866]"
            href="/personalizados"
          >
            Pedir peça personalizada
            <span className="grid size-9 place-items-center rounded-full bg-[#d8bc7b] text-lg text-[#0b2447]" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-5 px-7 py-10 text-xs text-[#0b2447]/60 sm:flex-row sm:items-center">
        <span>Artgian Studio · Elegância impressa em cada detalhe.</span>
        <Link className="font-semibold text-[#0b2447]" href="/">
          Voltar ao início →
        </Link>
      </footer>
      <FloatingWhatsApp />
    </main>
  );
}
