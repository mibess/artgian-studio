import Link from "next/link";
import { seasonalCampaign } from "../../lib/seasonal-campaign";

type BrandHeaderProps = {
  fixed?: boolean;
  tone?: "light" | "clay";
};

const navigation = [
  [seasonalCampaign.navigationLabel, seasonalCampaign.href],
  ["Produtos", "/produtos"],
  ["Personalizados", "/#personalizados"],
  ["Como funciona", "/#como-funciona"],
  ["Sobre", "/#sobre"],
];

export default function BrandHeader({ fixed = false }: BrandHeaderProps) {
  return (
    <header
      className={`inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5 ${
        fixed ? "fixed" : "relative"
      }`}
    >
      <div className="relative mx-auto flex max-w-7xl items-center justify-between overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/55 px-4 py-3 text-[#0b2447] shadow-[0_18px_60px_rgba(11,36,71,0.13),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[#0b2447]/5 backdrop-blur-2xl sm:px-6">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent" />
        <div className="pointer-events-none absolute -top-16 left-1/4 size-36 rounded-full bg-white/70 blur-3xl" />

        <Link
          className="relative z-10 flex shrink-0 items-center"
          href="/"
          aria-label="Artgian Studio — página inicial"
        >
          <span className="grid size-12 place-items-center overflow-hidden rounded-2xl border border-white/80 bg-[#f7f3ea]/80 shadow-sm sm:size-14">
            <img
              className="size-full object-cover mix-blend-multiply"
              src="/artgian-monogram.png"
              alt="AS"
            />
          </span>
        </Link>

        <nav
          className="relative z-10 hidden items-center gap-2 lg:flex"
          aria-label="Navegação principal"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              className="rounded-full px-4 py-2 text-xs font-semibold transition hover:bg-white/65 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b]"
              href={href}
            >
              {label}
            </Link>
          ))}
        </nav>

        <Link
          className="relative z-10 inline-flex items-center gap-2 rounded-full bg-[#0b2447] py-2.5 pr-3 pl-4 text-xs font-semibold text-[#fffdf8] shadow-lg shadow-[#0b2447]/15 transition hover:-translate-y-0.5 hover:bg-[#143866] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] sm:gap-3 sm:py-3 sm:pr-4 sm:pl-5 sm:text-sm"
          href="/#orcamento"
        >
          <span className="hidden sm:inline">Pedir orçamento</span>
          <span className="sm:hidden">Orçamento</span>
          <span
            className="grid size-7 place-items-center rounded-full bg-[#d8bc7b] text-base text-[#0b2447]"
            aria-hidden="true"
          >
            ↗
          </span>
        </Link>
      </div>
    </header>
  );
}
