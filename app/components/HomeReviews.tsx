"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Expand, Star, X } from "lucide-react";
import { exampleReviews, type HomeReview } from "../../lib/home-reviews";
import { storyProducts } from "../../lib/home-stories";
import { useProductCatalog } from "../../lib/products/context";

const total = exampleReviews.length;
const average = (exampleReviews.reduce((sum, review) => sum + review.stars, 0) / total).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const distribution = [5, 4, 3, 2, 1].map((stars) => {
  const count = exampleReviews.filter((review) => review.stars === stars).length;
  return { stars, count, percent: Math.round(100 * count / total) };
}).filter((row) => row.stars >= 3 || row.count > 0);
const pageSize = 3;
const visibleReviews = exampleReviews.slice(0, 15);
const pageCount = Math.ceil(visibleReviews.length / pageSize);
const pageButton = "grid size-11 place-items-center rounded-full border border-[#0b2447]/20 hover:bg-white disabled:opacity-30";

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} de 5 estrelas`} role="img" className="inline-flex gap-0.5 text-[#91691e]">
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} strokeWidth={1.5} fill={n <= value ? "currentColor" : "none"} aria-hidden="true" />)}
    </span>
  );
}

export default function HomeReviews() {
  const [page, setPage] = useState(0);
  const [selectedReview, setSelectedReview] = useState<HomeReview | null>(null);
  const lightbox = useRef<HTMLDialogElement>(null);
  const catalog = useProductCatalog();
  const offset = page * pageSize;

  return (
    <section id="avaliacoes" aria-labelledby="home-reviews-title" className="scroll-mt-28 border-y border-[#b5935e]/30 bg-[#f0eadf]">
      <div className="site-container py-14 lg:py-20">
        <header>
          <h2 id="home-reviews-title" className="font-serif text-[clamp(2.5rem,4.8vw,4.6rem)] leading-none tracking-[-0.055em]">
            O que diz quem <em className="font-normal text-[#8a6427]">já levou.</em>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#526273]">Prévia com avaliações de exemplo e imagens ilustrativas.</p>
        </header>
        <div className="mt-7 grid gap-5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 rounded-3xl bg-[#0b2447] px-5 py-6 text-[#fffdf8] sm:grid-cols-[auto_minmax(9rem,1fr)_auto] sm:gap-10 sm:px-8 lg:gap-16 lg:px-10">
            <div>
              <div className="flex items-center gap-2">
                <strong className="font-serif text-5xl font-normal tracking-tight lg:text-[4.2rem]">{average}</strong>
                <Star aria-hidden="true" size={20} fill="currentColor" className="text-[#e6c784]" />
              </div>
              <p className="mt-1 text-xs text-[#eee5d3]">{total} avaliações de exemplo</p>
            </div>
            <dl aria-label="Distribuição das avaliações de exemplo" className="space-y-2.5">
              {distribution.map(({ stars, percent }) => (
                <div key={stars} className="grid grid-cols-[1.6rem_1fr_auto] items-center gap-2 text-xs">
                  <dt className="flex items-center gap-1">{stars}<span className="sr-only"> estrelas</span><Star aria-hidden="true" size={10} fill="currentColor" /></dt>
                  <dd className="col-span-2 grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-[#e6c784]" style={{ width: `${percent}%` }} /></span>
                    <span className="text-right tabular-nums">{percent}%</span>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="hidden border-l border-white/20 pl-8 sm:block lg:pl-12">
              <strong className="font-serif text-4xl font-normal text-[#e6c784]">{distribution[0].percent}%</strong>
              <p className="mt-1 text-xs">deram cinco estrelas</p>
            </div>
          </div>
          <div className="grid items-stretch gap-4 lg:grid-cols-3">
            {visibleReviews.slice(offset, offset + pageSize).map((review) => {
              const product = catalog[review.product];
              const pieceName = product?.name || storyProducts[review.product];
              const productSummary = <>
                <Image src={`/avaliacoes/${review.product}.webp`} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-lg bg-[#e9dfcf] object-cover" />
                <span>{pieceName}</span>
              </>;
              return (
                <figure key={review.author} className="flex flex-col rounded-3xl border border-[#0b2447]/10 bg-[#fffdf8] p-5 sm:p-6">
                  <div className="flex flex-1 flex-col items-start">
                    <Stars value={review.stars} />
                    <blockquote className="mt-3 mb-5 text-base leading-snug">{review.text}</blockquote>
                    {review.photo && (
                      <button type="button" aria-label={`Ampliar foto ilustrativa de ${pieceName}`} className="relative mb-4 size-20 shrink-0 overflow-hidden rounded-xl bg-[#e9dfcf]" onClick={() => { setSelectedReview(review); lightbox.current?.showModal(); }}>
                        <Image src={review.photo.src} alt="" fill unoptimized className="object-cover" />
                        <Expand size={16} aria-hidden="true" className="absolute right-1 bottom-1 rounded bg-white/80 p-0.5" />
                      </button>
                    )}
                  </div>
                  <figcaption className="border-t border-[#0b2447]/10 pt-3">
                    <span className="block text-sm font-semibold">{review.author}</span>
                    {product?.listed ? (
                      <Link href={product.href} className="mt-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg text-xs text-[#725421] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                        {productSummary}
                        <ArrowUpRight size={13} className="shrink-0" aria-hidden="true" />
                      </Link>
                    ) : <span className="mt-2 inline-flex items-center gap-2 text-xs text-[#725421]">{productSummary}</span>}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
        <dialog ref={lightbox} aria-label="Imagem ilustrativa da peça" onClose={() => setSelectedReview(null)}
          onClick={(event) => { if (event.target === event.currentTarget) lightbox.current?.close(); }}
          className="fixed inset-0 m-auto w-fit max-w-[92vw] rounded-2xl bg-[#fffdf8] text-[#0b2447] shadow-2xl backdrop:bg-black/75">
          {selectedReview?.photo && <div>
            <div className="flex items-center justify-between gap-4 px-4 py-2">
              <span className="font-serif text-xl">{storyProducts[selectedReview.product]}</span>
              <button type="button" aria-label="Fechar imagem" className="grid size-10 place-items-center rounded-full hover:bg-[#ebe4d8]" onClick={() => lightbox.current?.close()}><X size={18} /></button>
            </div>
            <Image src={selectedReview.photo.src} alt={selectedReview.photo.alt} width={selectedReview.photo.width} height={selectedReview.photo.height}
              unoptimized className="h-auto max-h-[72dvh] w-auto max-w-full object-contain" />
          </div>}
        </dialog>
        <div className="mt-5 flex items-center justify-end gap-3">
          <span aria-live="polite" aria-atomic="true" className="mr-1 text-xs tabular-nums text-[#526273]">
            {offset + 1}–{Math.min(offset + pageSize, visibleReviews.length)} de {visibleReviews.length} comentários
          </span>
          <button type="button" className={pageButton} aria-label="Avaliações anteriores" disabled={page === 0} onClick={() => setPage(page - 1)}><ArrowLeft size={17} /></button>
          <button type="button" className={pageButton} aria-label="Próximas avaliações" disabled={page === pageCount - 1} onClick={() => setPage(page + 1)}><ArrowRight size={17} /></button>
        </div>
      </div>
    </section>
  );
}
