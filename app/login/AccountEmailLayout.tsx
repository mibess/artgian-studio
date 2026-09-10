import type { ReactNode } from "react";
import Link from "next/link";
import BrandHeader from "../components/BrandHeader";

export default function AccountEmailLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />
      <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
        <section className="rounded-[2rem] border border-white bg-white/80 p-6 shadow-[0_20px_60px_rgba(11,36,71,.07)] sm:p-9">
          <p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-[#b88a3b]">
            Sua conta Artgian
          </p>
          <h1 className="font-serif text-3xl">{title}</h1>
          {children}
          <Link
            href="/login"
            className="mt-7 block text-center text-sm font-semibold underline underline-offset-4"
          >
            Voltar para entrar
          </Link>
        </section>
      </div>
    </main>
  );
}
