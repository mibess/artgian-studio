"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Camera, Expand, Play, X } from "lucide-react";
import { homeStories, storyProducts } from "../../lib/home-stories";
import { useProductCatalog } from "../../lib/products/context";

const arrowClass = "grid size-11 place-items-center rounded-full border border-[#0b2447]/20 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-30";
const storyButton = "grid size-11 shrink-0 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white disabled:invisible";

export default function HomeStories() {
  const rail = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [index, setIndex] = useState<number | null>(null);
  const catalog = useProductCatalog();
  const selected = index === null ? null : homeStories[index];
  const product = selected && catalog[selected.product];
  const isOpen = index !== null;

  useEffect(() => {
    const list = rail.current;
    if (!list) return;
    function update() {
      if (list) setEdges({
        start: list.scrollLeft < 2,
        end: list.scrollWidth - list.clientWidth - list.scrollLeft < 2,
      });
    }
    const observer = new ResizeObserver(update);
    observer.observe(list);
    list.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  function scroll(direction: number) {
    const list = rail.current;
    if (!list || list.children.length < 2) return;
    const stride = list.children[1].getBoundingClientRect().left - list.children[0].getBoundingClientRect().left;
    list.scrollBy({
      left: direction * stride * Math.max(1, Math.floor(list.clientWidth / stride)),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  return (
    <section id="artgian-em-casa" aria-labelledby="home-stories-title" className="site-container scroll-mt-28 py-16 lg:py-24">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-5 lg:mb-10">
        <div>
          <h2 id="home-stories-title" className="font-serif text-[clamp(2.7rem,5vw,4.8rem)] leading-none tracking-[-0.055em]">
            Artgian <em className="font-normal text-[#8a6427]">em casa.</em>
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#526273]">Marque <strong>#ArtgianEmCasa</strong> no Instagram para mostrar o seu cantinho.</p>
        </div>
        <a className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0b2447]/20 px-4 text-sm font-semibold hover:bg-white" href="https://www.instagram.com/artgian.studio/" target="_blank" rel="noopener noreferrer">
          <Camera size={17} aria-hidden="true" /> @artgian.studio <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </header>
      <ul ref={rail} aria-label="Galeria de peças em casa" className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
        {homeStories.map((story, i) => (
          <li className="w-[64%] flex-none snap-start sm:w-[35%] lg:w-[23%] xl:w-[19%]" key={story.title}>
            <button type="button" aria-label={`${story.video ? "Assistir ao vídeo" : "Ampliar foto"} — ${story.title}`} onClick={() => setIndex(i)}
              className="group relative block aspect-9/16 w-full overflow-hidden rounded-[1.4rem] bg-[#dfd6c7] text-left text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6427]">
              <Image src={story.image} fill sizes="(max-width: 639px) 64vw, (max-width: 1023px) 35vw, 23vw" alt="" className="object-cover motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-[1.025]" />
              <span className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/85 to-transparent" />
              <span className="absolute top-3 right-3 grid size-9 place-items-center rounded-full border border-white/60 bg-black/25 backdrop-blur-sm">
                {story.video ? <Play size={15} className="ml-0.5 fill-current" aria-hidden="true" /> : <Expand size={15} aria-hidden="true" />}
              </span>
              <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <span className="block text-[0.65rem] font-semibold tracking-wide">{storyProducts[story.product]}</span>
                <span className="mt-1 block font-serif text-[clamp(1.45rem,2.1vw,2rem)] leading-none">{story.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-4 px-1">
        <p className="text-xs text-[#526273]">Cenas ilustrativas com peças da Artgian Studio.</p>
        <div className="flex gap-2">
          <button type="button" aria-label="Ver cenas anteriores" disabled={edges.start} className={arrowClass} onClick={() => scroll(-1)}><ArrowLeft size={18} /></button>
          <button type="button" aria-label="Ver mais cenas" disabled={edges.end} className={arrowClass} onClick={() => scroll(1)}><ArrowRight size={18} /></button>
        </div>
      </div>
      <dialog ref={dialog} aria-labelledby="story-player-title" onClose={() => setIndex(null)}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        className="fixed inset-0 m-auto h-fit w-[min(100vw,56.25dvh)] max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 text-white backdrop:bg-black/75 sm:w-[min(92vw,52.875dvh,28rem)] sm:rounded-2xl">
        {selected && index !== null && (
          <div className="relative isolate aspect-9/16 w-full bg-[#efe8da]">
            <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 bg-linear-to-b from-black/75 via-black/40 to-transparent px-4 pt-3 pb-9">
              <div>
                <h3 className="font-serif text-xl leading-tight sm:text-2xl" id="story-player-title">{selected.title}</h3>
                {product?.listed ? (
                  <Link href={product.href} className="pointer-events-auto mt-1 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
                    {storyProducts[selected.product]} <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                ) : <span className="mt-1 block text-sm">{storyProducts[selected.product]}</span>}
              </div>
              <button className={`pointer-events-auto ${storyButton}`} type="button" aria-label="Fechar cena" onClick={() => dialog.current?.close()}><X size={20} /></button>
            </header>
            {selected.video ? (
              <video key={selected.video} src={selected.video} poster={selected.image} aria-label={selected.title}
                autoPlay playsInline controls className="absolute inset-0 size-full object-cover">
                Seu navegador não oferece reprodução de vídeo.
              </video>
            ) : (
              <Image src={selected.image} alt={storyProducts[selected.product]} fill sizes="(max-width: 639px) 100vw, 448px" className="object-contain" />
            )}
            <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 flex -translate-y-1/2 justify-between">
              <button className={`pointer-events-auto ${storyButton}`} aria-label="Cena anterior" type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft size={18} /></button>
              <button className={`pointer-events-auto ${storyButton}`} aria-label="Próxima cena" type="button" disabled={index === homeStories.length - 1} onClick={() => setIndex(index + 1)}><ArrowRight size={18} /></button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
