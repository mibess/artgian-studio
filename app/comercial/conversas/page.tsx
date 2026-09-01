import Link from "next/link";
import { AtSign as Instagram, Bot, MessageSquareText, Sparkles } from "lucide-react";
import { getConversationsOverview } from "../../../src/db/commercial";
import { Avatar, PageHeader, StatusBadge, formatDateTime } from "../_components";
import { simulateInbound } from "../actions";

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const params = await searchParams;
  const rows = await getConversationsOverview();
  return <>
    <PageHeader eyebrow="Instagram inbound" title="Conversas" description="Mensagens organizadas por intenção, com sugestão de resposta e escalada quando a informação não é segura." />
    {params.erro && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{params.erro}</p>}
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <section className="overflow-hidden rounded-[22px] border border-[#e1e1db] bg-white shadow-[0_8px_28px_rgba(32,52,60,.04)]">
        <header className="flex items-center justify-between border-b border-[#ecece7] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b979d]">Caixa de entrada</p><h2 className="mt-1 text-base font-semibold">Conversas recentes</h2></div><span className="flex items-center gap-2 rounded-full bg-[#e1f0e8] px-3 py-1.5 text-[9px] font-bold text-[#32745e]"><span className="size-1.5 rounded-full bg-[#4eaa83]"/>Monitorando</span></header>
        <div className="divide-y divide-[#efefea]">{rows.map(({conversation,lead},index)=><Link href={`/comercial/leads/${lead.id}`} key={conversation.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-[#faf9f6]"><Avatar name={lead.name} username={lead.instagramUsername} index={index}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-[#294653]">{lead.name || `@${lead.instagramUsername}`}</p>{lead.score>=80&&<span className="rounded-full bg-[#f8ded5] px-2 py-0.5 text-[8px] font-bold text-[#9e4934]">Alta intenção</span>}</div><p className="mt-1 truncate text-[10px] text-[#7d8a90]">@{lead.instagramUsername} · {lead.productInterest || "Conversa iniciada"}</p></div><div className="hidden text-right sm:block"><StatusBadge status={conversation.status}/><p className="mt-1.5 text-[9px] text-[#9aa3a7]">{formatDateTime(conversation.lastMessageAt)}</p></div></Link>)}</div>
      </section>
      <aside className="space-y-5">
        <section className="rounded-[22px] bg-[#193848] p-6 text-white shadow-[0_14px_40px_rgba(25,56,72,.12)]">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[13px] bg-[#f1c865] text-[#193848]"><Sparkles size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">Ambiente seguro</p><h2 className="text-base font-semibold">Simular inbound</h2></div></div>
          <p className="mt-4 text-xs leading-5 text-white/60">Demonstre classificação, score, briefing e deduplicação sem enviar nenhuma mensagem real.</p>
          <form action={simulateInbound} className="mt-5 space-y-3">
            <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wide text-white/45">Perfil de teste</span><div className="relative"><Instagram className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={14}/><input name="username" required defaultValue="cliente.teste" className="h-10 w-full rounded-xl border border-white/10 bg-white/8 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-[#f1c865]/60"/></div></label>
            <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wide text-white/45">Mensagem recebida</span><textarea name="message" required rows={4} defaultValue="Oi! Quanto custa uma miniatura personalizada? Preciso de 2 unidades para 20/09." className="w-full resize-none rounded-xl border border-white/10 bg-white/8 p-3 text-xs leading-5 text-white outline-none placeholder:text-white/30 focus:border-[#f1c865]/60"/></label>
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f1c865] px-4 py-3 text-xs font-extrabold text-[#193848]"><Bot size={15}/>Processar em dry-run</button>
          </form>
        </section>
        <section className="rounded-[20px] border border-[#e1e1db] bg-white p-5"><div className="flex items-center gap-3"><MessageSquareText className="text-[#d96245]" size={18}/><div><p className="text-xs font-bold text-[#344f5c]">Respostas automáticas pausadas</p><p className="mt-0.5 text-[10px] text-[#8a959b]">Sugestões são criadas como jobs, sem envio.</p></div></div></section>
      </aside>
    </div>
  </>;
}
