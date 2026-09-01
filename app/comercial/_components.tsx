import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PIPELINE_LABELS, type ConsumerPipelineStage } from "../../src/features/leads/domain";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d96245]">{eyebrow}</p><h1 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-[-0.045em] text-[#173244]">{title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[#74838a]">{description}</p></div>{action}</header>;
}

const badgeStyles: Record<string, string> = {
  discovered: "bg-[#edf1f2] text-[#657780]",
  qualified: "bg-[#e5eef0] text-[#446875]",
  contacted: "bg-[#e6edf6] text-[#4b6486]",
  replied: "bg-[#fff1ca] text-[#846214]",
  interest_identified: "bg-[#fbe8c2] text-[#8c6410]",
  requirements_collection: "bg-[#f9dfd5] text-[#9a4c36]",
  quote_requested: "bg-[#f5d2c7] text-[#93402a]",
  whatsapp_handoff: "bg-[#d9eee6] text-[#2f755f]",
  quote_sent: "bg-[#dce8f6] text-[#3f5e8f]",
  order_pending: "bg-[#eee2f0] text-[#74527b]",
  order_confirmed: "bg-[#d8ede4] text-[#2b7258]",
  closed: "bg-[#ececea] text-[#787d7c]",
  active: "bg-[#d8ede4] text-[#2b7258]",
  paused: "bg-[#fff1ca] text-[#846214]",
  pending: "bg-[#fff1ca] text-[#846214]",
  completed: "bg-[#d8ede4] text-[#2b7258]",
  dead_letter: "bg-[#f8ddd7] text-[#9c4031]",
  waiting_review: "bg-[#eee2f0] text-[#74527b]",
  open: "bg-[#f8ddd7] text-[#9c4031]",
  requested: "bg-[#f9dfd5] text-[#9a4c36]",
  accepted: "bg-[#d8ede4] text-[#2b7258]",
  collecting: "bg-[#fff1ca] text-[#846214]",
  ready: "bg-[#dce8f6] text-[#3f5e8f]",
  converted: "bg-[#d8ede4] text-[#2b7258]",
};

const genericLabels: Record<string, string> = {
  active: "Ativo", paused: "Pausado", pending: "Pendente", completed: "Concluído", dead_letter: "Esgotado", waiting_review: "Aguardando revisão", open: "Aberto", requested: "Solicitado", accepted: "Aceito", collecting: "Em coleta", ready: "Pronto", converted: "Convertido", draft: "Rascunho", running: "Em andamento", none: "Não iniciado", confirmed: "Confirmado",
};

export function StatusBadge({ status }: { status: string }) {
  const label = PIPELINE_LABELS[status as ConsumerPipelineStage] || genericLabels[status] || status.replaceAll("_", " ");
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${badgeStyles[status] || "bg-[#edf1f2] text-[#657780]"}`}>{label}</span>;
}

const colors = ["bg-[#f2c86b] text-[#4f3b10]", "bg-[#aed8cf] text-[#173f39]", "bg-[#e9a994] text-[#5c2113]", "bg-[#b9c9eb] text-[#25365c]", "bg-[#d8bfd8] text-[#4f2c50]"];
export function Avatar({ name, username, index = 0, size = "md" }: { name: string | null; username: string; index?: number; size?: "sm" | "md" | "lg" }) {
  const initials = (name || username).split(/[\s._-]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const sizes = { sm: "size-8 text-[9px]", md: "size-10 text-[10px]", lg: "size-14 text-sm" };
  return <span className={`grid shrink-0 place-items-center rounded-full font-extrabold ${sizes[size]} ${colors[index % colors.length]}`}>{initials}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-[18px] border border-dashed border-[#d5d8d3] bg-[#f8f7f3] px-5 py-12 text-center"><p className="text-sm font-semibold text-[#415967]">{title}</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#8a959b]">{description}</p></div>;
}

export function LeadLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link className="inline-flex items-center gap-1 text-xs font-bold text-[#d96245] hover:text-[#b74a31]" href={`/comercial/leads/${id}`}>{children}<ChevronRight size={13}/></Link>;
}

export const formatBrl = (cents: number | null | undefined) => cents == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const formatDateTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
