"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ImportRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!active || pending) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        startTransition(() => router.refresh());
    }, 10_000);
    return () => clearInterval(timer);
  }, [active, pending, router]);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="rounded-lg border border-[#d8dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#365767] disabled:opacity-50"
    >
      {pending ? "Atualizando…" : "Atualizar importações"}
    </button>
  );
}
