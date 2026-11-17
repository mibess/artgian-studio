"use client";
import type { CustomPieceType } from "../../lib/custom-order";
import { announceCustomPieceType } from "./CustomQuoteForm";

type IdeaCardProps = {
  type: CustomPieceType;
  title: string;
  text: string;
  image: string;
  alt: string;
  position?: string;
};

/** Jumps to the quote form with this kind of piece already chosen. */
export default function IdeaCard({ type, title, text, image, alt, position = "object-center" }: IdeaCardProps) {
  return (
    <a
      className="group flex flex-col rounded-[1.6rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b]"
      href="#orcamento"
      onClick={() => announceCustomPieceType(type)}
    >
      <span className="relative block aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[#e9dfcf]">
        <img
          alt={alt}
          className={`absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04] ${position}`}
          decoding="async"
          loading="lazy"
          src={image}
        />
      </span>
      <span className="mt-4 block font-serif text-xl leading-tight tracking-[-0.02em] sm:mt-5 sm:text-2xl">
        {title}
      </span>
      <span className="mt-2 block text-xs leading-5 text-[#647087] sm:text-sm sm:leading-6">{text}</span>
      <span className="mt-3 inline-flex w-fit items-center gap-2 border-b border-[#b88a3b]/60 pb-1 text-xs font-semibold transition group-hover:border-[#b88a3b]">
        Pedir orçamento <b className="text-[#b88a3b] transition group-hover:translate-x-0.5">→</b>
      </span>
    </a>
  );
}
