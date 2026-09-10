"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "../../../lib/auth-client";
export default function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmation"))) {
      setError("As senhas não coincidem.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await authClient.resetPassword({
        token,
        newPassword: password,
      });
      if (result.error) {
        const expired =
          result.error.code === "INVALID_TOKEN" ||
          result.error.code === "TOKEN_EXPIRED";
        setInvalid(expired);
        setError(
          expired
            ? "Este link é inválido, expirou ou já foi usado. Solicite um novo link."
            : result.error.status === 429
              ? "Muitas tentativas. Aguarde um minuto e tente novamente."
              : "Não foi possível alterar sua senha. Use de 8 a 128 caracteres e tente novamente.",
        );
      } else {
        setComplete(true);
        window.history.replaceState(null, "", "/login/redefinir");
      }
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setPending(false);
    }
  }
  if (complete)
    return (
      <div className="mt-5">
        <p role="status" className="text-sm leading-7">
          Sua senha foi alterada. As sessões anteriores foram encerradas. Entre
          novamente com a nova senha.
        </p>
        <Link
          href="/login"
          className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-[#0b2447] px-5 text-sm font-semibold text-white"
        >
          Entrar com a nova senha
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <fieldset disabled={pending || invalid} className="space-y-4">
        {[
          ["password", "Nova senha"],
          ["confirmation", "Confirmar nova senha"],
        ].map(([name, label]) => (
          <label key={name} className="block text-xs font-semibold">
            {label}
            <input
              name={name}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className="mt-2 h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea]/70 px-4 text-sm outline-none focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/20"
            />
          </label>
        ))}
        <p className="text-xs text-[#647087]">Use pelo menos 8 caracteres.</p>
        <button
          disabled={pending || invalid}
          aria-busy={pending}
          className="min-h-12 w-full rounded-full bg-[#0b2447] px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Aguarde…" : "Salvar nova senha"}
        </button>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {invalid && (
        <Link
          href="/login/recuperar"
          className="block text-sm font-semibold underline"
        >
          Solicitar novo link
        </Link>
      )}
    </form>
  );
}
