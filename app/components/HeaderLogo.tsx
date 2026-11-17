"use client";
import Link from "next/link";
import { useNavigationBusy } from "../../lib/navigation-progress";
import PrintingLogo from "./PrintingLogo";

/** The header monogram; while a page is loading it turns into the printer. */
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
          <img
            alt="AS"
            className={`size-full object-contain transition-opacity duration-200 ${busy ? "opacity-0" : ""}`}
            src="/artgian-monogram.png"
          />
          {busy && <PrintingLogo className="absolute w-[56%]" variant="compact" />}
        </span>
      </Link>
      <span className="sr-only" role="status">
        {busy ? "Carregando" : ""}
      </span>
    </>
  );
}
