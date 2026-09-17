import Link from "next/link";
import BrandHeader from "../../components/BrandHeader";
import ProductColorImage from "../../components/ProductColorImage";
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
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#f1c7d1] text-[#321d2c]"
      style={
        {
          backgroundColor: product.presentation.background,
          "--product-accent": product.presentation.accent,
        } as React.CSSProperties
      }
      id="topo"
    >
      <div className="absolute inset-x-0 top-0 h-[55rem] overflow-hidden">
        <div className="absolute -top-40 left-[42%] h-[50rem] w-[34rem] rounded-t-full border-[6rem] border-[#fff7ed]/35" />
        <div className="absolute top-32 -left-40 size-[34rem] rounded-full bg-[#762638]/12 blur-3xl" />
      </div>

      <BrandHeader tone="clay" />

      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-14 lg:py-20">
        <div className="relative z-10 lg:py-10">
          <div className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#762638]">
            <span className="h-px w-10 bg-current" />
            {product.presentation.copy.text001?.value}
          </div>
          <h1 className="mt-8 max-w-2xl font-serif text-[clamp(4.4rem,8.5vw,8.8rem)] font-normal leading-[0.78] tracking-[-0.07em]">
            {product.presentation.copy.text002?.value}
            <em className="mt-3 block pl-[18%] font-normal text-[#fff8ed] [text-shadow:0_1px_0_#fff]">
              {product.presentation.copy.text003?.value}
            </em>
          </h1>
          <p className="mt-10 max-w-lg text-base leading-7 text-[#321d2c]/72">
            {product.description}
          </p>

          <div className="mt-8 flex items-end gap-5 border-t border-[#762638]/15 pt-7">
            <div>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#321d2c]/55">
                {product.presentation.copy.text004?.value}
              </span>
              <strong className="mt-1 block font-serif text-4xl font-normal">
                <ProductPrice product={product} />
              </strong>
            </div>
            <span className="mb-1 rounded-full border border-[#762638]/20 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]">
              {product.presentation.copy.text005?.value}
            </span>
          </div>

          <ProductPurchase product={product} />
        </div>

        <div className="relative min-h-[38rem] lg:min-h-[48rem]">
          <div className="absolute inset-0 -rotate-2 rounded-t-[16rem] rounded-b-[3rem] bg-[#fff7ed]/35" />
          <figure className="absolute inset-3 overflow-hidden rounded-t-[15rem] rounded-b-[2.6rem] bg-[#fff7ed] shadow-[0_35px_90px_rgba(118,38,56,.2)] lg:inset-6">
            <ProductColorImage
              className="h-full w-full object-cover"
              product={product.id}
              src={product.presentation.media[0]?.src || product.image}
              alt={product.presentation.media[0]?.alt || product.alt}
              initialColor="rosa-marfim"
            />
          </figure>
          <div className="absolute -bottom-5 -left-3 flex size-28 rotate-[-7deg] flex-col items-center justify-center rounded-full border border-white/45 bg-[#762638] text-center text-[#fff8ed] shadow-xl lg:size-36">
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
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#b17a2d]">
              {product.presentation.copy.text009?.value}
            </span>
            <h2 className="mt-5 font-serif text-[clamp(3rem,5vw,5.5rem)] font-normal leading-[.9] tracking-[-0.05em]">
              {product.presentation.copy.text010?.value}
              <br />
              <i className="font-normal text-[var(--product-accent)]">
                {product.presentation.copy.text011?.value}
              </i>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map(([number, title, description]) => (
              <article
                className="border-t border-[#321d2c]/18 pt-5"
                key={number}
              >
                <span className="font-serif text-lg text-[var(--product-accent)]">
                  {number}
                </span>
                <h3 className="mt-8 font-serif text-2xl font-normal">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#321d2c]/60">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 grid overflow-hidden rounded-[2rem] bg-[#762638] text-[#fffaf4] lg:grid-cols-[1.02fr_.98fr]">
          <div className="min-h-[28rem] overflow-hidden bg-white">
            <img
              className="h-full w-full object-cover"
              src={product.presentation.media[1]?.src || product.image}
              alt={product.presentation.media[1]?.alt || product.alt}
            />
          </div>
          <div className="flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-[6vw]">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.23em] text-[#f1c7d1]">
              {product.presentation.copy.text012?.value}
            </span>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,5vw,5rem)] font-normal leading-[.9] tracking-[-0.04em]">
              {product.presentation.copy.text013?.value}
              <br />
              <i className="font-normal text-[#f4c0cc]">
                {product.presentation.copy.text014?.value}
              </i>
            </h2>
            <p className="mt-7 max-w-md text-sm leading-7 text-white/68">
              {product.presentation.copy.text015?.value}
            </p>
            <a
              className="mt-9 inline-flex w-fit items-center gap-5 border-b border-[#f1c7d1] pb-2 text-sm font-semibold"
              href="#topo"
            >
              {product.presentation.copy.text016?.value}{" "}
              <span className="text-xl text-[#f1c7d1]">
                {product.presentation.copy.text017?.value}
              </span>
            </a>
          </div>
        </div>
      </section>

      {children}
      <footer className="flex flex-col justify-between gap-5 px-7 py-10 text-xs text-[#321d2c]/65 sm:flex-row sm:items-center">
        <span>{product.presentation.copy.text018?.value}</span>
        <Link className="font-semibold text-[#321d2c]" href="/">
          {product.presentation.copy.text019?.value}
        </Link>
      </footer>
    </main>
  );
}
