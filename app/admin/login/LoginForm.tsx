"use client";

import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { signInAdmin } from "../auth-actions";

export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const [state, action, pending] = useActionState(signInAdmin, { error: "" });
  const [username, setUsername] = useState("");
  const inputClass = "mt-2 h-12 w-full rounded-xl border border-[#dcded9] bg-white px-4 text-sm text-[#193244] outline-none transition focus:border-[#ee6e4f] focus:ring-2 focus:ring-[#ee6e4f]/20";

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block text-xs font-semibold text-[#526873]">
        Usuário
        <input className={inputClass} name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={256} autoFocus />
      </label>
      <label className="block text-xs font-semibold text-[#526873]">
        Senha
        <input className={inputClass} name="password" type="password" autoComplete="current-password" required maxLength={1024} />
      </label>
      {(!configured || state.error) && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {!configured ? "O acesso administrativo ainda não foi configurado." : state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !configured} aria-busy={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ee6e4f] px-5 text-sm font-bold text-white transition hover:bg-[#d95f42] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ee6e4f] disabled:opacity-60">
        {pending ? <LoaderCircle className="animate-spin" size={17} /> : null}
        {pending ? "Entrando…" : "Entrar no admin"}
        {!pending && <ArrowRight size={17} />}
      </button>
    </form>
  );
}
