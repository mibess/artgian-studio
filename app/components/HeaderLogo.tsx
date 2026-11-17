"use client";
import Link from "next/link";
import { useNavigationBusy } from "../../lib/navigation-progress";
import PrintingLogo, { LOGO_MARK } from "./PrintingLogo";

/**
 * The header monogram. While a page is loading the same mark, at the same size
 * and place, re-prints itself; the two states cross-fade so nothing jumps.
 */
export default function HeaderLogo() {
  const busy = useNavigationBusy();
  return (
    <>
      <Link
        aria-busy={busy}
        aria-label="Artgian Studio — página inicial"
        className="relative z-10 flex shrink-0 items-center"
        href="/"
      >
        <span className="relative grid size-12 place-items-center overflow-hidden rounded-2xl border border-white/80 bg-[#f7f3ea]/80 shadow-sm sm:size-14">
          <span className="relative h-[78%] aspect-[507/640]">
            <img
              alt="AS"
              className={`absolute inset-0 size-full object-contain transition-opacity duration-300 ease-out ${
                busy ? "opacity-0" : "opacity-100"
              }`}
              src={LOGO_MARK}
            />
            {busy && <PrintingLogo className="absolute inset-0 h-full" />}
          </span>
        </span>
      </Link>
      <span className="sr-only" role="status">
        {busy ? "Carregando" : ""}
      </span>
    </>
  );
}
