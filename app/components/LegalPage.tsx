import Link from "next/link";
import type { ReactNode } from "react";
import BrandHeader from "./BrandHeader";

export function LegalPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />
      <article className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <header className="border-b border-[#b88a3b]/35 pb-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9b702a]">
            {eyebrow}
          </p>
          <h1 className="mt-5 font-serif text-[clamp(2.8rem,7vw,5.5rem)] font-normal leading-[0.95] tracking-[-0.045em]">
            {title}
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-[#56677d]">
            {description}
          </p>
          <p className="mt-4 text-xs font-semibold text-[#7b8798]">
            Última atualização: 1º de setembro de 2026
          </p>
        </header>

        <div className="legal-content mt-12 space-y-10 text-sm leading-7 text-[#40536b]">
          {children}
        </div>
      </article>

      <footer className="border-t border-[#0b2447]/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 text-xs text-[#647087] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Artgian Studio</span>
          <nav className="flex flex-wrap gap-5 font-semibold">
            <Link className="hover:text-[#b88a3b]" href="/">
              Início
            </Link>
            <Link className="hover:text-[#b88a3b]" href="/politica-de-privacidade">
              Privacidade
            </Link>
            <Link className="hover:text-[#b88a3b]" href="/exclusao-de-dados">
              Exclusão de dados
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-serif text-2xl font-normal tracking-[-0.02em] text-[#0b2447]">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
