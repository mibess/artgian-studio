"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "../../lib/auth-client";

export default function EmailRequestForm({
  kind,
  next = "/conta",
}: {
  kind: "reset" | "verification";
  next?: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"))
      .trim()
      .toLowerCase();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result =
        kind === "reset"
          ? await authClient.requestPasswordReset({
              email,
              redirectTo: "/login/redefinir",
            })
          : await authClient.sendVerificationEmail({
              email,
              callbackURL: `/login/verificar?confirmed=1&next=${encodeURIComponent(next)}`,
            });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Muitas tentativas. Aguarde um minuto antes de solicitar outro e-mail."
            : "Não foi possível solicitar o e-mail. Tente novamente em instantes.",
        );
      } else {
        setMessage(
          kind === "reset"
            ? "Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha. Confira também o spam."
            : "Se esse e-mail precisar de confirmação, você receberá um novo link. Confira também o spam.",
        );
      }
    } catch {
      setError(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-xs font-semibold">
        E-mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={180}
          required
          disabled={pending}
          placeholder="voce@exemplo.com"
          className="mt-2 h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea]/70 px-4 text-sm outline-none focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/20"
        />
      </label>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-3 text-sm leading-6 text-green-900"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <button
        disabled={pending}
        aria-busy={pending}
        className="min-h-12 w-full rounded-full bg-[#0b2447] px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending
          ? "Aguarde…"
          : kind === "reset"
            ? "Enviar link de recuperação"
            : "Reenviar confirmação"}
      </button>
    </form>
  );
}
