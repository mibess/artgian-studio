import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";
import FloatingWhatsApp from "../components/FloatingWhatsApp";
import { getProductCatalog } from "../../lib/products/repository";
import type { Product } from "../../lib/catalog";
import ProductPurchase from "./ProductPurchase";
import { ProductPrice } from "./ProductPrice";
import { productStructuredData, serializeStructuredData } from "../../lib/structured-data";
import { SITE_URL } from "../../lib/site-url";
import Aurora from "./templates/bandeja-aurora";
import Arco from "./templates/organizador-arco";
import Solo from "./templates/porta-palhetas-solo";
import Samurai from "./templates/porta-incenso-samurai";
import Pocket from "./templates/suporte-pocket";
import Pais from "./templates/kit-dia-dos-pais";
const templates: Record<
  string,
  React.ComponentType<{ product: Product; children?: React.ReactNode }>
> = {
  "bandeja-aurora": Aurora,
  "organizador-arco": Arco,
  "porta-palhetas-solo": Solo,
  "porta-incenso-samurai": Samurai,
  "suporte-pocket": Pocket,
  "kit-dia-dos-pais": Pais,
};
export async function productMetadata(id: string): Promise<Metadata> {
  const product = (await getProductCatalog())[id];
  if (!product?.active) return { title: "Produto indisponível" };
  const title = product.seoTitle || `${product.name} | Artgian Studio`;
  const description = product.seoDescription || product.description;
  return {
    title,
    description,
    alternates: { canonical: product.href },
    openGraph: {
      title,
      description,
      url: new URL(product.href, SITE_URL).href,
      siteName: "Artgian Studio",
      locale: "pt_BR",
      images: product.image ? [product.image] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: product.image ? [product.image] : [],
    },
  };
}
export async function ProductPage({ id }: { id: string }) {
  const product = (await getProductCatalog())[id];
  if (!product?.active) notFound();
  const Template = templates[product.presentation.template] ?? StandardProduct;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(productStructuredData(product)) }}
      />
      <Template product={product}>
        <ExtraSections product={product} />
        <ProductTechnicalDetails details={product.technicalDetails} />
      </Template>
      <FloatingWhatsApp />
    </>
  );
}
function ProductTechnicalDetails({
  details,
}: {
  details: Product["technicalDetails"];
}) {
  if (!details?.length) return null;

  return (
    <section className="site-container py-10 sm:py-12" aria-labelledby="ficha-tecnica">
      <div className="rounded-3xl border border-[#193244]/12 bg-[#fffdf8] p-6 text-[#193244] sm:p-10">
        <h2 id="ficha-tecnica" className="font-serif text-3xl sm:text-4xl">
          Ficha técnica
        </h2>
        <dl className="mt-5 divide-y divide-[#193244]/12 border-t border-[#193244]/12">
          {details.map(({ label, value }, index) => (
            <div
              key={index}
              className="grid gap-1.5 py-4 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-6"
            >
              <dt className="wrap-anywhere text-sm font-semibold">{label}</dt>
              <dd className="whitespace-pre-line wrap-anywhere text-sm leading-relaxed">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
function ExtraSections({ product }: { product: Product }) {
  return product.presentation.sections.length ? (
    <section
      style={{ backgroundColor: product.presentation.background }}
      className="py-16 text-[#193244]"
    >
      {product.presentation.sections.map((s, i) => (
        <article
          key={i}
          className="site-container mb-12 grid gap-8 md:grid-cols-2"
        >
          {s.image && (
            <img
              src={s.image}
              alt={s.title}
              className="w-full rounded-3xl object-cover"
            />
          )}
          <div>
            <h2 className="font-serif text-4xl">{s.title}</h2>
            <p className="mt-5 whitespace-pre-line text-sm leading-7">
              {s.text}
            </p>
          </div>
        </article>
      ))}
    </section>
  ) : null;
}
function StandardProduct({
  product: p,
  children,
}: {
  product: Product;
  children?: React.ReactNode;
}) {
  return (
    <main
      style={{ backgroundColor: p.presentation.background }}
      className="min-h-screen text-[#193244]"
    >
      <BrandHeader fixed />
      <section className="site-container grid gap-12 pt-38 pb-16 sm:pt-42 lg:grid-cols-2">
        <div>
          <p
            style={{ color: p.presentation.accent }}
            className="text-xs font-bold uppercase tracking-widest"
          >
            {p.category}
          </p>
          <h1 className="mt-6 font-serif text-6xl">{p.name}</h1>
          <p className="mt-6 whitespace-pre-line leading-7">{p.description}</p>
          <div className="mt-8 font-serif text-4xl">
            <ProductPrice product={p} />
          </div>
          <ProductPurchase product={p} />
        </div>
        <div className="space-y-5">
          {p.presentation.media.map((m, i) => (
            <img
              key={i}
              src={m.src}
              alt={m.alt || p.name}
              className="w-full rounded-3xl object-cover"
            />
          ))}
        </div>
      </section>
      {p.presentation.features.length > 0 && (
        <section className="site-container grid gap-6 pb-16 md:grid-cols-3">
          {p.presentation.features.map(([n, title, text], i) => (
            <article key={i} className="rounded-2xl bg-white/70 p-6">
              <span>{n}</span>
              <h2 className="mt-3 font-serif text-2xl">{title}</h2>
              <p className="mt-4 text-sm leading-6">{text}</p>
            </article>
          ))}
        </section>
      )}
      {p.presentation.specifications.length > 0 && (
        <dl className="site-container grid grid-cols-2 gap-5 pb-16">
          {p.presentation.specifications.map(([key, value], i) => (
            <div key={i}>
              <dt className="text-xs uppercase">{key}</dt>
              <dd className="mt-2 text-lg">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      <footer className="p-8 text-center text-xs">
        <Link href="/produtos">← Todos os produtos</Link>
      </footer>
    </main>
  );
}
