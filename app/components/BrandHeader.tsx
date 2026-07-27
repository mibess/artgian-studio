type BrandHeaderProps = {
  cartHref?: string;
  tone?: "light" | "clay";
};

export default function BrandHeader({
  cartHref = "/comprar",
  tone = "light",
}: BrandHeaderProps) {
  const clay = tone === "clay";

  return (
    <header className="relative z-50 px-4 pt-4 sm:px-7 sm:pt-6">
      <div
        className={`mx-auto flex max-w-[1440px] items-center justify-between rounded-full border px-4 py-3 backdrop-blur-xl sm:px-6 ${
          clay
            ? "border-white/35 bg-[#fffaf4]/75 text-[#152849] shadow-[0_16px_50px_rgba(77,41,30,.12)]"
            : "border-white/70 bg-white/60 text-[#0b2447] shadow-[0_16px_50px_rgba(11,36,71,.1)]"
        }`}
      >
        <Link
          className="flex items-center gap-3"
          href="/"
          aria-label="Artgian Studio — página inicial"
        >
          <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-[#f7f3ea] ring-1 ring-[#b88a3b]/30 sm:size-11">
            <img
              className="size-14 max-w-none mix-blend-multiply sm:size-16"
              src="/artgian-logo.jpeg"
              alt=""
            />
          </span>
          <span className="leading-none">
            <b className="block font-serif text-xl font-normal tracking-[0.08em] sm:text-2xl">
              Artgian
            </b>
            <small className="mt-1 block text-[0.45rem] font-bold uppercase tracking-[0.5em]">
              studio
            </small>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-5">
          <Link
            className="hidden text-xs font-semibold sm:inline"
            href="/produtos"
          >
            Todos os produtos
          </Link>
          <Link
            className="grid size-10 place-items-center rounded-full bg-[#0b2447] text-lg text-white transition hover:-translate-y-0.5 hover:bg-[#173b68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b]"
            href={cartHref}
            aria-label="Abrir carrinho"
          >
            <span aria-hidden="true">⌑</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
import Link from "next/link";
