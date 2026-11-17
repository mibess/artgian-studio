import type { ReactNode } from "react";
import BrandHeader from "../components/BrandHeader";
import SignOutButton from "./SignOutButton";

type AccountShellProps = {
  children: ReactNode;
  user?: { name: string; email: string };
  /** O cabeçalho é padrão. Uma futura exceção deve declarar false no layout. */
  showAccountHeader?: boolean;
};

export default function AccountShell({ children, user, showAccountHeader = true }: AccountShellProps) {
  const firstName = user?.name.trim().split(/\s+/)[0];

  return <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
    <BrandHeader />
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:py-10">
      {showAccountHeader && user && <header aria-label="Sua conta" className="flex items-center justify-between gap-3 border-b border-[#0b2447]/10 pb-5">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-bold uppercase tracking-[.24em] text-[#b88a3b]">Seu espaço na Artgian</p>
          <h1 className="mt-2 break-words font-serif text-3xl tracking-tight sm:text-5xl">Olá, {firstName}.</h1>
          <p className="mt-2 break-all text-xs text-[#647087]">{user.email}</p>
        </div>
        <SignOutButton />
      </header>}
      {children}
    </div>
  </main>;
}
