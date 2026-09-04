"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  MessageCircleMore,
  PackageCheck,
  Pause,
  Settings2,
  Sparkles,
  Tags,
  Users,
  Workflow,
  X,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "../components/PendingButton";
import { updateAutomationSetting } from "./actions";

const groups = [
  {
    label: "Visão geral",
    items: [{ href: "/comercial", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Relacionamento",
    items: [
      { href: "/comercial/leads", label: "Leads", icon: Users },
      { href: "/comercial/funil", label: "Funil", icon: Workflow },
      { href: "/comercial/conversas", label: "Conversas", icon: MessageCircleMore },
      { href: "/comercial/briefings", label: "Briefings", icon: ClipboardList },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/comercial/orcamentos", label: "Orçamentos", icon: BriefcaseBusiness },
      { href: "/comercial/pedidos", label: "Pedidos", icon: PackageCheck },
      { href: "/comercial/produtos", label: "Produtos", icon: Boxes },
      { href: "/comercial/campanhas", label: "Campanhas", icon: Tags },
      { href: "/comercial/experimentos", label: "Experimentos", icon: FlaskConical },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/comercial/ia", label: "Inteligência artificial", icon: Bot },
      { href: "/comercial/jobs", label: "Automações", icon: Gauge },
      { href: "/comercial/excecoes", label: "Revisão humana", icon: CircleAlert },
      { href: "/comercial/configuracoes", label: "Configurações", icon: Settings2 },
    ],
  },
];

type CommercialSidebarProps = {
  companyName: string;
  instagramHandle: string;
  paused: boolean;
};

export function CommercialSidebar({ companyName, instagramHandle, paused }: CommercialSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebar = (
    <>
      <div className="flex h-[82px] items-center justify-between border-b border-white/10 px-6">
        <Link className="group flex items-center gap-3" href="/comercial" onClick={() => setOpen(false)}>
          <span className="grid size-10 place-items-center rounded-[14px] bg-[#ee6e4f] text-sm font-black tracking-[-0.08em] text-white shadow-[0_8px_24px_rgba(238,110,79,.24)]">A3</span>
          <span>
            <span className="block text-[15px] font-bold tracking-[-0.02em] text-white">{companyName}</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">Comercial inteligente</span>
          </span>
        </Link>
        <button className="text-white/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
      </div>
      <div className="border-b border-white/10 px-4 py-4">
        <button className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-left">
          <span className="grid size-8 place-items-center rounded-full bg-[#f3c76b] text-xs font-extrabold text-[#142b3a]">AS</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-white">Conta principal</span>
            <span className="block truncate text-[11px] text-white/45">{instagramHandle}</span>
          </span>
          <ChevronDown size={14} className="text-white/40" />
        </button>
      </div>
      <nav className="commercial-scrollbar flex-1 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div className="mb-5" key={group.label}>
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/comercial" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`group flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${active ? "bg-[#ee6e4f] text-white shadow-[0_8px_20px_rgba(238,110,79,.18)]" : "text-white/58 hover:bg-white/7 hover:text-white"}`}>
                    <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                    <span className="flex-1">{item.label}</span>
                    {item.label === "Revisão humana" && <span className="grid size-5 place-items-center rounded-full bg-[#f3c76b] text-[9px] font-extrabold text-[#142b3a]">2</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <form action={updateAutomationSetting}>
          <input type="hidden" name="key" value="automation_paused" />
          <input type="hidden" name="value" value={paused ? "false" : "true"} />
          <SubmitButton className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.12em] transition disabled:opacity-60 ${paused ? "bg-[#f3c76b] text-[#142b3a] hover:bg-[#f7d486]" : "bg-white/8 text-white hover:bg-white/12"}`} pendingLabel={paused ? "Retomando…" : "Pausando…"}>
            {paused ? <Sparkles size={15} /> : <Pause size={15} />}
            {paused ? "Retomar automação" : "Pausar automação"}
          </SubmitButton>
        </form>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/35">
          <span className={`size-1.5 rounded-full ${paused ? "bg-[#f3c76b]" : "bg-[#68d391]"}`} />
          {paused ? "Operação sob controle manual" : "Automações seguras ativas"}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed left-4 top-4 z-40 grid size-11 place-items-center rounded-xl bg-[#142b3a] text-white shadow-lg lg:hidden" aria-label="Abrir menu"><Menu size={20} /></button>
      {open && <button aria-label="Fechar menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-[#091923]/55 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[#142b3a] transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>{sidebar}</aside>
    </>
  );
}
