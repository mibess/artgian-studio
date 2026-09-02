import { AlertOctagon, CheckCircle2, Clock3, LoaderCircle, Workflow } from "lucide-react";
import { getOperationsData } from "../../../src/db/commercial";
import { PageHeader, StatusBadge, formatDateTime } from "../_components";
import { JOB_TYPE_LABELS } from "../../../src/features/leads/domain";

export default async function JobsPage() {
  const { jobs } = await getOperationsData();
  const cards = [
    { label: "Pendentes", value: jobs.filter((job) => job.status === "pending").length, Icon: Clock3, color: "bg-[#fff0c9] text-[#8b6718]" },
    { label: "Em revisão", value: jobs.filter((job) => job.status === "waiting_review").length, Icon: LoaderCircle, color: "bg-[#eee2f0] text-[#74527b]" },
    { label: "Concluídos", value: jobs.filter((job) => job.status === "completed").length, Icon: CheckCircle2, color: "bg-[#d8ede4] text-[#2b7258]" },
    { label: "Dead-letter", value: jobs.filter((job) => job.status === "dead_letter").length, Icon: AlertOctagon, color: "bg-[#f8ddd7] text-[#9c4031]" },
  ];
  return <>
    <PageHeader eyebrow="Fila persistente" title="Automações" description="Jobs sobrevivem a reinícios, possuem tentativas limitadas, idempotência e fila de falhas para revisão." />
    <div className="mb-5 grid gap-4 sm:grid-cols-4">{cards.map(({ label, value, Icon, color })=><article className="rounded-[20px] border border-[#e1e1db] bg-white p-4" key={label}><span className={`grid size-8 place-items-center rounded-xl ${color}`}><Icon size={15}/></span><p className="mt-3 text-[9px] font-bold uppercase tracking-wide text-[#8b979d]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></article>)}</div>
    <section className="overflow-hidden rounded-[22px] border border-[#e1e1db] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead><tr className="border-b border-[#ecece7] text-[9px] font-bold uppercase tracking-[0.13em] text-[#8e999e]"><th className="px-5 py-4">Automação</th><th className="px-4 py-4">Estado</th><th className="px-4 py-4">Tentativas</th><th className="px-4 py-4">Agendado</th><th className="px-5 py-4">Último erro</th></tr></thead><tbody className="divide-y divide-[#efefea]">{jobs.map(job=><tr key={job.id}><td className="px-5 py-4"><p className="flex items-center gap-2 text-xs font-bold text-[#415967]"><Workflow size={14} className="text-[#d96245]"/>{JOB_TYPE_LABELS[job.type] || "Automação interna"}</p><p className="mt-1 font-mono text-[8px] text-[#9aa3a7]">{job.idempotencyKey||job.id.slice(0,12)}</p></td><td className="px-4 py-4"><StatusBadge status={job.status}/></td><td className="px-4 py-4 text-[10px] text-[#718088]">{job.attempts} / {job.maxAttempts}</td><td className="px-4 py-4 text-[10px] text-[#718088]">{formatDateTime(job.scheduledAt)}</td><td className="max-w-xs px-5 py-4 text-[10px] leading-4 text-[#a04a37]">{job.lastError||"—"}</td></tr>)}</tbody></table></div></section>
  </>;
}
