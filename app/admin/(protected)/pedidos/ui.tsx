"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Tone } from "../../../../lib/admin-order-view";

const toneClass: Record<Tone, string> = {
  positive: "bg-[#dcefe5] text-[#22654c]",
  warning: "bg-[#fbecc9] text-[#7a560f]",
  critical: "bg-[#f8ddd7] text-[#97402f]",
  neutral: "bg-[#ebedeb] text-[#56656c]",
  info: "bg-[#dfe8f5] text-[#36578a]",
  progress: "bg-[#e8e3f3] text-[#574683]",
};

const dotClass: Record<Tone, string> = {
  positive: "bg-[#2f8a66]",
  warning: "bg-[#c8901f]",
  critical: "bg-[#c4513b]",
  neutral: "bg-[#8a979d]",
  info: "bg-[#4f74ad]",
  progress: "bg-[#7560a8]",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${toneClass[tone]}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dotClass[tone]}`} />
      {children}
    </span>
  );
}

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#56656c] transition hover:bg-[#193244]/6 hover:text-[#193244] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#b88a3b] ${className}`}
    >
      {copied ? <Check size={14} className="text-[#2f8a66]" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Copiado" : label}</span>
    </button>
  );
}

export function Section({ title, aside, children, labelledBy }: { title: string; aside?: React.ReactNode; children: React.ReactNode; labelledBy: string }) {
  return (
    <section aria-labelledby={labelledBy} className="rounded-2xl border border-[#e4e3dc] bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id={labelledBy} className="text-sm font-semibold text-[#193244]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Feedback({ state }: { state: { ok: boolean; message: string } | null }) {
  return (
    <p
      role={state && !state.ok ? "alert" : "status"}
      className={state ? `rounded-xl px-3.5 py-2.5 text-sm leading-5 ${state.ok ? "bg-[#e6f3ec] text-[#1f5e46]" : "bg-[#fbe6e1] text-[#8c3727]"}` : "sr-only"}
    >
      {state?.message}
    </p>
  );
}
