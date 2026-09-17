import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { adminDestination, hasAdminAccess, isAdminConfigured } from "../../../lib/admin-access";
import { LoginForm } from "./LoginForm";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = adminDestination((await searchParams).next);
  if (hasAdminAccess(await headers())) redirect(next);

  return (
    <main className="grid min-h-svh place-items-center bg-[#f3f1eb] px-5 py-10 text-[#193244]">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="grid size-11 place-items-center rounded-[15px] bg-[#ee6e4f] text-sm font-black tracking-[-0.08em] text-white">A3</span>
          <span className="text-lg font-bold tracking-tight">Artgian Studio</span>
        </div>
        <section className="rounded-3xl border border-[#e1e1db] bg-white p-7 shadow-[0_16px_60px_rgba(25,50,68,.06)] sm:p-9">
          <span className="mb-6 grid size-11 place-items-center rounded-xl bg-[#f3f1eb] text-[#526873]"><LockKeyhole size={21} /></span>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d96245]">Área administrativa</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
          <p className="mt-3 text-sm leading-6 text-[#718088]">Acesse o painel para gerenciar seu comercial, pedidos e descontos.</p>
          <LoginForm next={next} configured={isAdminConfigured()} />
        </section>
        <div className="mt-7 text-center"><Link href="/" className="text-xs font-medium text-[#718088] hover:text-[#193244]">← Voltar para a loja</Link></div>
      </div>
    </main>
  );
}
