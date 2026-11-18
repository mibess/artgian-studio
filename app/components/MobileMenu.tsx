"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Layers,
  Menu,
  MessageCircle,
  PenLine,
  ShoppingBag,
  X,
  type LucideIcon,
} from "lucide-react";
import { headerButtonInteraction } from "./header-styles";

const icons = {
  loja: ShoppingBag,
  personalizados: PenLine,
  processo: Layers,
  contato: MessageCircle,
} satisfies Record<string, LucideIcon>;

export type MenuLink = {
  label: string;
  href: string;
  /** Shown only in the compact desktop dropdown. */
  description?: string;
  icon?: keyof typeof icons;
};

type MobileMenuProps = {
  links: ReadonlyArray<MenuLink>;
};

// Phones and tablets get the full-width sheet with large serif rows; from lg up
// the same links open as a compact dropdown under the button, in the style of
// the search and sort menus.
export default function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`relative z-10 grid size-11 place-items-center rounded-full ${headerButtonInteraction} xl:hidden ${
          open ? "lg:bg-white lg:ring-2 lg:ring-[#b88a3b]/40" : ""
        }`}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="menu-mobile"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-40 xl:hidden" id="menu-mobile">
          <button
            type="button"
            className="absolute inset-0 bg-[#0b2447]/25 backdrop-blur-sm"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <nav
            className="absolute inset-x-3 top-[5.75rem] max-h-[calc(100dvh-6.5rem)] overflow-y-auto overscroll-contain rounded-[1.75rem] border border-white/70 bg-[#fffdf8]/95 p-3 text-[#0b2447] shadow-[0_18px_60px_rgba(11,36,71,0.2)] backdrop-blur-2xl sm:inset-x-6 sm:top-[6.75rem] sm:max-h-[calc(100dvh-8.25rem)] lg:right-6 lg:left-auto lg:w-[23rem] lg:rounded-[1.4rem] lg:p-2 lg:transition lg:duration-150 lg:ease-out lg:starting:-translate-y-1 lg:starting:scale-95 lg:starting:opacity-0 lg:origin-top-right"
            aria-label="Menu"
          >
            <p className="hidden px-3 pt-2 pb-2 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#b88a3b] lg:block">
              Navegue pela Artgian
            </p>
            <ul className="divide-y divide-[#0b2447]/10 lg:divide-y-0">
              {links.map(({ label, href, description, icon }) => {
                const Icon = icon ? icons[icon] : undefined;
                const current = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      aria-current={current ? "page" : undefined}
                      className={`group flex items-center justify-between rounded-2xl px-4 py-4 font-serif text-2xl transition hover:bg-[#f7f3ea] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#b88a3b] lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:hover:bg-[#ebe4d8]/75 ${
                        current ? "lg:bg-[#ebe4d8]/60" : ""
                      }`}
                      href={href}
                      onClick={() => setOpen(false)}
                    >
                      {Icon && (
                        <span
                          className={`hidden size-9 shrink-0 place-items-center rounded-full transition lg:grid ${
                            current
                              ? "bg-[#0b2447] text-[#d8bc7b]"
                              : "bg-[#ebe4d8]/70 text-[#0b2447]/70 group-hover:bg-[#0b2447] group-hover:text-[#d8bc7b]"
                          }`}
                          aria-hidden="true"
                        >
                          <Icon size={16} strokeWidth={1.8} />
                        </span>
                      )}
                      <span className="lg:min-w-0 lg:flex-1">
                        <span className="lg:block lg:text-lg lg:leading-tight">{label}</span>
                        {description && (
                          <span className="hidden font-sans text-xs text-[#647087] lg:mt-0.5 lg:block">
                            {description}
                          </span>
                        )}
                      </span>
                      <span
                        className="text-lg text-[#b88a3b] lg:-translate-x-1 lg:text-base lg:opacity-0 lg:transition lg:group-hover:translate-x-0 lg:group-hover:opacity-100 lg:group-focus-visible:translate-x-0 lg:group-focus-visible:opacity-100"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>,
          document.body,
        )}
    </>
  );
}
