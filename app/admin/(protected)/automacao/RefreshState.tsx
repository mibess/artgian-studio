"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

export function RefreshState() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !pending) {
        startTransition(() => router.refresh());
      }
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, pending]);

  return <button type="button" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())} className="inline-flex items-center gap-2 rounded-xl border border-[#d9e3e7] bg-white px-4 py-2.5 text-xs font-semibold text-[#415967] disabled:opacity-60"><RefreshCw size={14} className={pending ? "animate-spin" : undefined} />{pending ? "Atualizando…" : "Atualizar estado"}</button>;
}
