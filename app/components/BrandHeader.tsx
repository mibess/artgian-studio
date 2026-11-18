import { Suspense } from "react";
import Link from "next/link";
import StoreHeaderActions from "./StoreHeaderActions";
import MobileMenu, { type MenuLink } from "./MobileMenu";
import HeaderSearch, { HeaderSearchFallback } from "./HeaderSearch";
import HeaderLogo from "./HeaderLogo";
import { Store } from "lucide-react";
import { headerButtonInteraction } from "./header-styles";

type BrandHeaderProps = {
  fixed?: boolean;
  tone?: "light" | "clay";
};

// "Produtos" is the header's primary button, so the desktop nav lists the
// quote link instead; the menu carries every destination. The search box takes
// the middle of the bar, so these text links only fit from the xl breakpoint.
const navigation = [
  ["Personalizados", "/personalizados"],
  ["Como funciona", "/personalizados#como-funciona"],
  ["Orçamento", "/personalizados#orcamento"],
] as const;

const menuLinks: MenuLink[] = [
  { label: "Produtos", href: "/produtos", description: "Todas as peças da loja", icon: "loja" },
  { label: "Personalizados", href: "/personalizados", description: "Peças criadas sob medida", icon: "personalizados" },
  { label: "Como funciona", href: "/personalizados#como-funciona", description: "Da ideia à entrega", icon: "processo" },
  { label: "Orçamento", href: "/personalizados#orcamento", description: "Conte a sua ideia", icon: "contato" },
];

export default function BrandHeader({ fixed = false }: BrandHeaderProps) {
  // site-container is the width every page section uses too, so the bar and the
  // content below it always share the same side edges.
  return (
    <header
      className={`site-container inset-x-0 top-0 z-50 pt-3 sm:pt-5 ${
        fixed ? "fixed" : "relative"
      }`}
    >
      <div
        data-header-shell
        className="relative flex items-center justify-between gap-2 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/55 px-4 py-3 text-[#0b2447] shadow-[0_18px_60px_rgba(11,36,71,0.13),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[#0b2447]/5 backdrop-blur-2xl sm:gap-4 sm:px-6"
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent" />
        <div className="pointer-events-none absolute -top-16 left-1/4 size-36 rounded-full bg-white/70 blur-3xl" />

        <HeaderLogo />

        <Suspense fallback={<HeaderSearchFallback />}>
          <HeaderSearch />
        </Suspense>

        <nav
          className="relative z-10 hidden shrink-0 items-center gap-1 xl:flex"
          aria-label="Navegação principal"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${headerButtonInteraction}`}
              href={href}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <StoreHeaderActions />
          <Link
            className="relative z-10 hidden items-center gap-2 rounded-full min-[440px]:inline-flex bg-[#0b2447] py-2.5 pr-2.5 pl-4 text-xs font-semibold text-[#fffdf8] shadow-lg shadow-[#0b2447]/15 transition hover:-translate-y-0.5 hover:bg-[#143866] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] sm:gap-3 sm:py-3 sm:pr-4 sm:pl-5 sm:text-sm"
            href="/produtos"
          >
            <Store size={17} strokeWidth={2} className="-mr-0.5 shrink-0 sm:-mr-1" aria-hidden="true" />
            Produtos
            <span
              className="hidden size-7 place-items-center rounded-full bg-[#d8bc7b] text-base text-[#0b2447] min-[400px]:grid"
              aria-hidden="true"
            >
              ↗
            </span>
          </Link>
          <MobileMenu links={menuLinks} />
        </div>
      </div>
    </header>
  );
}
