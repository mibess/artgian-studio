"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

type MobileMenuProps = {
  links: ReadonlyArray<readonly [string, string]>;
};

export default function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

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
        className="relative z-10 grid size-11 place-items-center rounded-full transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] xl:hidden"
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
            className="absolute inset-x-3 top-[5.75rem] rounded-[1.75rem] border border-white/70 bg-[#fffdf8]/95 p-3 text-[#0b2447] shadow-[0_18px_60px_rgba(11,36,71,0.2)] backdrop-blur-2xl sm:inset-x-6 sm:top-[6.75rem]"
            aria-label="Menu"
          >
            <ul className="divide-y divide-[#0b2447]/10">
              {links.map(([label, href]) => (
                <li key={href}>
                  <Link
                    className="flex items-center justify-between rounded-2xl px-4 py-4 font-serif text-2xl transition hover:bg-[#f7f3ea]"
                    href={href}
                    onClick={() => setOpen(false)}
                  >
                    {label}
                    <span className="text-lg text-[#b88a3b]" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>,
          document.body,
        )}
    </>
  );
}
