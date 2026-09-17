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
  const personalizationUrl = product.presentation.contactUrl || "/produtos";
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#d9c4a7] text-[#132746]"
      style={
        {
          backgroundColor: product.presentation.background,
          "--product-accent": product.presentation.accent,
        } as React.CSSProperties
      }
      id="topo"
    >
      <div className="absolute inset-x-0 top-0 h-[58rem] overflow-hidden">
        <div className="absolute -top-40 -left-28 size-[38rem] rounded-full border-[6rem] border-[#f6ead7]/32" />
        <div className="absolute top-20 right-[-10rem] size-[36rem] rounded-full bg-[var(--product-accent)]/20 blur-3xl" />
        <div className="absolute top-56 left-[46%] h-px w-[46%] bg-[#f5e5ca]/60" />
      </div>

      <BrandHeader />

      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-14 lg:py-20">
        <div className="relative z-10 lg:py-10">
          <div className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#8a4f3d]">
            <span className="h-px w-10 bg-current" />
            {product.presentation.copy.text001?.value}
          </div>
          <h1 className="mt-8 max-w-2xl font-serif text-[clamp(4.2rem,8.4vw,8.6rem)] font-normal leading-[0.78] tracking-[-0.07em]">
            {product.presentation.copy.text002?.value}
            <em className="mt-3 block pl-[14%] font-normal text-[#fff8eb] [text-shadow:0_1px_0_#fff]">
              {product.presentation.copy.text003?.value}
            </em>
          </h1>
          <p className="mt-10 max-w-lg text-base leading-7 text-[#132746]/72">
            {product.description}
          </p>

          <div className="mt-8 flex items-end gap-5 border-t border-[#132746]/15 pt-7">
            <div>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#132746]/55">
                {product.presentation.copy.text004?.value}
              </span>
              <strong className="mt-1 block font-serif text-4xl font-normal">
                <ProductPrice product={product} />
              </strong>
            </div>
            <span className="mb-1 rounded-full border border-[#132746]/20 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]">
              {product.presentation.copy.text005?.value}
            </span>
          </div>

          <ProductPurchase product={product} />
        </div>

        <div className="relative min-h-[34rem] lg:min-h-[42rem]">
          <div className="absolute inset-0 rotate-2 rounded-[3rem] bg-[#fff4e3]/35" />
          <figure className="absolute inset-3 overflow-hidden rounded-[2.6rem] bg-[#071120] shadow-[0_35px_90px_rgba(55,38,30,.24)] lg:inset-6">
            <img
              className="h-full w-full object-cover object-center"
              src={product.presentation.media[0]?.src || product.image}
              alt={product.presentation.media[0]?.alt || product.alt}
            />
          </figure>
          <div className="absolute -bottom-5 -left-3 flex size-28 rotate-[-7deg] flex-col items-center justify-center rounded-full border border-white/45 bg-[#132746] text-center text-[#fff8eb] shadow-xl lg:size-36">
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

      <section className="relative mx-3 overflow-hidden rounded-[2.3rem] bg-[#fffaf3] px-5 py-20 sm:px-10 lg:px-[7vw] lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#a45d46]">
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
                className="border-t border-[#132746]/18 pt-5"
                key={number}
              >
                <span className="font-serif text-lg text-[var(--product-accent)]">
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
              src={product.presentation.media[1]?.src || product.image}
              alt={product.presentation.media[1]?.alt || product.alt}
            />
          </div>
          <div className="flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-[6vw]">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.23em] text-[#d6a36d]">
              {product.presentation.copy.text012?.value}
            </span>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,5vw,5rem)] font-normal leading-[.9] tracking-[-0.04em]">
              {product.presentation.copy.text013?.value}
              <br />
              <i className="font-normal text-[#d9c4a7]">
                {product.presentation.copy.text014?.value}
              </i>
            </h2>
            <p className="mt-7 max-w-md text-sm leading-7 text-white/68">
              {product.presentation.copy.text015?.value}
            </p>
            <a
              className="mt-9 inline-flex w-fit items-center gap-5 border-b border-[#d6a36d] pb-2 text-sm font-semibold"
              href="#topo"
            >
              {product.presentation.copy.text016?.value}
              <span className="text-xl text-[#d6a36d]">
                {product.presentation.copy.text017?.value}
              </span>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pt-16 sm:px-8 lg:pt-20">
        <div className="grid items-center gap-7 rounded-[1.8rem] border border-[#132746]/12 bg-[#fffaf3]/65 p-6 shadow-[0_18px_55px_rgba(19,39,70,.08)] sm:p-8 lg:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--product-accent)] font-serif text-lg text-white">
              {product.presentation.copy.text018?.value}
            </span>
            <div>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#8a4f3d]">
                {product.presentation.copy.text019?.value}
              </span>
              <h2 className="mt-2 font-serif text-2xl font-normal tracking-[-0.025em] sm:text-3xl">
                {product.presentation.copy.text020?.value}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#132746]/62">
                {product.presentation.copy.text021?.value}
              </p>
            </div>
          </div>
          <a
            className="inline-flex items-center justify-between gap-5 rounded-full bg-[#132746] py-3 pr-3 pl-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203c67]"
            href={personalizationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {product.presentation.copy.text022?.value}
            <span className="grid size-9 place-items-center rounded-full bg-[#d8bc7b] text-lg text-[#132746]">
              {product.presentation.copy.text023?.value}
            </span>
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-20 text-center sm:px-8 lg:py-28">
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#8a4f3d]">
          {product.presentation.copy.text024?.value}
        </span>
        <h2 className="mx-auto mt-5 max-w-4xl font-serif text-[clamp(3rem,6vw,6rem)] font-normal leading-[.9] tracking-[-0.05em]">
          {product.presentation.copy.text025?.value}
        </h2>
        <p className="mx-auto mt-7 max-w-xl text-sm leading-7 text-[#132746]/65">
          {product.presentation.copy.text026?.value}
        </p>
        <a
          className="mt-8 inline-flex items-center gap-4 rounded-full bg-[#132746] py-3 pr-3 pl-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203c67]"
          href="#topo"
        >
          {product.presentation.copy.text027?.value}
          <span className="grid size-9 place-items-center rounded-full bg-[var(--product-accent)] text-lg">
            {product.presentation.copy.text028?.value}
          </span>
        </a>
      </section>

      {children}
      <footer className="flex flex-col justify-between gap-5 border-t border-[#132746]/12 px-7 py-10 text-xs text-[#132746]/65 sm:flex-row sm:items-center">
        <span>{product.presentation.copy.text029?.value}</span>
        <Link className="font-semibold text-[#132746]" href="/">
          {product.presentation.copy.text030?.value}
        </Link>
      </footer>
    </main>
  );
}
