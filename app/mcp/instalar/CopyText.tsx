"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CopyText({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("manual");
    }
  }

  return (
    <div className="min-w-0">
      <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#c6d0d2] bg-white px-4 text-sm font-semibold text-[#193244] hover:bg-[#f4f7f6]">
        <Copy size={15} aria-hidden="true" /> {label}
      </button>
      <span role="status" className="ml-2 text-xs text-[#375e50]">{state === "copied" && "Copiado."}</span>
      {state === "manual" && (
        <label className="mt-2 block text-sm">
          Selecione e copie o texto abaixo.
          <textarea readOnly value={value} onFocus={event => event.currentTarget.select()} className="mt-1 block w-full rounded-lg border bg-white p-2 font-mono text-xs" />
        </label>
      )}
    </div>
  );
}
