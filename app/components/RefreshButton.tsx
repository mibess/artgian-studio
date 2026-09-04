"use client";

import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      aria-busy={pending}
      aria-label={pending ? "Atualizando painel" : "Atualizar painel"}
      className="grid size-9 place-items-center rounded-full border border-[#d9dedb] bg-white text-[#6c7b83] shadow-sm transition hover:border-[#b9c4bf] hover:text-[#193848] disabled:opacity-60"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      type="button"
    >
      <RefreshCcw className={pending ? "animate-spin" : ""} size={14} />
    </button>
  );
}
