import Link from "next/link";
import BrandHeader from "../../components/BrandHeader";
import ProductPurchase from "../ProductPurchase";
import { ProductPrice } from "../ProductPrice";
import type { Product } from "../../../lib/catalog";
export default function ProductTemplate({
  product,
  children,
}: {
  product: Product;
  children?: React.ReactNode;
}) {
  const features = product.presentation.features;
  const specifications = product.presentation.specifications;
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#caa77d] text-[#211a18]"
      style={
        {
          backgroundColor: product.presentation.background,
          "--product-accent": product.presentation.accent,
        } as React.CSSProperties
      }
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
            {product.presentation.copy.text001?.value}
          </div>
          <h1 className="mt-8 max-w-2xl font-serif text-[clamp(4.2rem,8.2vw,8.5rem)] font-normal leading-[0.78] tracking-[-0.07em]">
            {product.presentation.copy.text002?.value}
            <em className="mt-3 block pl-[21%] font-normal text-[#fff8ed] [text-shadow:0_1px_0_#fff]">
              {product.presentation.copy.text003?.value}
            </em>
          </h1>
          <p className="mt-10 max-w-lg text-base leading-7 text-[#211a18]/72">
            {product.description}
          </p>

          <div className="mt-8 flex items-end gap-5 border-t border-[#211a18]/15 pt-7">
            <div>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#211a18]/55">
                {product.presentation.copy.text004?.value}
              </span>
              <strong className="mt-1 block font-serif text-4xl font-normal">
                <ProductPrice product={product} />
              </strong>
            </div>
            <span className="mb-1 rounded-full border border-[#211a18]/20 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]">
              {product.presentation.copy.text005?.value}
            </span>
          </div>

          <ProductPurchase product={product} />
        </div>

        <div className="relative min-h-[36rem] lg:min-h-[48rem]">
          <div className="absolute inset-0 rotate-2 rounded-[3rem] bg-[#f6ead9]/30" />
          <figure className="absolute inset-3 overflow-hidden rounded-[2.6rem] bg-[#dfc6a6] shadow-[0_35px_90px_rgba(47,31,23,.28)] lg:inset-6">
            <img
              className="h-full w-full object-cover"
              src={product.presentation.media[0]?.src || product.image}
              alt={product.presentation.media[0]?.alt || product.alt}
              width={1122}
              height={1402}
            />
          </figure>
          <div className="absolute -bottom-5 -left-3 flex size-28 rotate-[-7deg] flex-col items-center justify-center rounded-full border border-white/35 bg-[#183443] text-center text-[#fff8ed] shadow-xl lg:size-36">
            <span className="font-serif text-2xl">
              {product.presentation.copy.text006?.value}
            </span>
            <span className="mt-1 text-[0.55rem] font-bold uppercase leading-4 tracking-[0.16em]">
              {product.presentation.copy.text007?.value}
              <br />
              {product.presentation.copy.text008?.value}
            </span>
          </div>
        </div>
      </section>

      <section className="relative mx-3 overflow-hidden rounded-[2.3rem] bg-[#fffaf4] px-5 py-20 sm:px-10 lg:px-[7vw] lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[var(--product-accent)]">
              {product.presentation.copy.text009?.value}
            </span>
            <h2 className="mt-5 font-serif text-[clamp(3rem,5vw,5.5rem)] font-normal leading-[.9] tracking-[-0.05em]">
              {product.presentation.copy.text010?.value}
              <br />
              <i className="font-normal text-[#b77a4e]">
                {product.presentation.copy.text011?.value}
              </i>
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
                <h3 className="mt-8 font-serif text-2xl font-normal">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#211a18]/60">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#183443] text-[#fffaf4] lg:grid-cols-[1.02fr_.98fr]">
          <div className="min-h-[30rem] overflow-hidden bg-[#142832]">
            <img
              className="h-full w-full object-cover object-center"
              src={product.presentation.media[1]?.src || product.image}
              alt={product.presentation.media[1]?.alt || product.alt}
              width={1254}
              height={1254}
            />
          </div>
          <div className="flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-[6vw]">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.23em] text-[#d6aa72]">
              {product.presentation.copy.text012?.value}
            </span>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,5vw,5rem)] font-normal leading-[.9] tracking-[-0.04em]">
              {product.presentation.copy.text013?.value}
              <br />
              <i className="font-normal text-[#d7b389]">
                {product.presentation.copy.text014?.value}
              </i>
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
              {product.presentation.copy.text015?.value}
              <span className="text-xl text-[#d6aa72]">
                {product.presentation.copy.text016?.value}
              </span>
            </a>
          </div>
        </div>
      </section>

      {children}
      <footer className="flex flex-col justify-between gap-5 px-7 py-10 text-xs text-[#211a18]/65 sm:flex-row sm:items-center">
        <span>{product.presentation.copy.text017?.value}</span>
        <Link className="font-semibold text-[#211a18]" href="/produtos">
          {product.presentation.copy.text018?.value}
        </Link>
      </footer>
    </main>
  );
}
