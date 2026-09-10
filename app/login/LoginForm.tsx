"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "../../lib/auth-client";

function googleErrorMessage(code?: string) {
  if (!code) return "";
  if (code === "account_not_linked")
    return "Para usar o Google com um cadastro existente, confirme primeiro o e-mail da sua conta. Você também pode entrar com e-mail e senha.";
  if (code === "access_denied")
    return "O acesso com Google foi cancelado. Tente novamente quando quiser.";
  if (
    [
      "state_mismatch",
      "state_not_found",
      "state_expired",
      "please_restart_the_process",
    ].includes(code)
  )
    return "A tentativa de acesso expirou. Clique em Continuar com Google para iniciar novamente.";
  return "Não foi possível concluir o acesso com Google. Tente novamente.";
}

function errorMessage(code?: string, status?: number) {
  if (status === 429)
    return "Muitas tentativas. Aguarde um minuto e tente novamente.";
  if (
    code === "USER_ALREADY_EXISTS" ||
    code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  )
    return "Não foi possível criar a conta com esse e-mail. Tente entrar ou use outro endereço.";
  if (code === "INVALID_EMAIL_OR_PASSWORD")
    return "E-mail ou senha incorretos. Confira seus dados.";
  if (code === "PASSWORD_TOO_SHORT")
    return "Use uma senha com pelo menos 8 caracteres.";
  if (code === "AUTH_UNAVAILABLE")
    return "O acesso está temporariamente indisponível. Tente novamente em instantes.";
  return "Não foi possível acessar sua conta. Confira os dados e tente novamente.";
}
export default function LoginForm({
  next,
  googleEnabled,
  oauthError,
}: {
  next: string;
  googleEnabled: boolean;
  oauthError?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(googleErrorMessage(oauthError));
  const verificationCallback = `/login/verificar?confirmed=1&next=${encodeURIComponent(next)}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    if (mode === "register" && password !== String(form.get("confirmation"))) {
      setError("As senhas não coincidem.");
      setPending(false);
      return;
    }
    try {
      const result =
        mode === "register"
          ? await authClient.signUp.email({
              name: String(form.get("name")).trim(),
              email,
              password,
              callbackURL: verificationCallback,
            })
          : await authClient.signIn.email({
              email,
              password,
              callbackURL: next,
            });
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          router.push(`/login/verificar?next=${encodeURIComponent(next)}`);
          return;
        }
        setError(errorMessage(result.error.code, result.error.status));
        setPending(false);
        return;
      }
      if (mode === "register") {
        router.push(`/login/verificar?next=${encodeURIComponent(next)}`);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
      setPending(false);
    }
  }
  async function google() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: next,
        errorCallbackURL: `/login?next=${encodeURIComponent(next)}`,
      });
      if (result.error) {
        setError(errorMessage(result.error.code, result.error.status));
        setPending(false);
      }
    } catch {
      setError("Não foi possível conectar ao Google. Tente novamente.");
      setPending(false);
    }
  }
  const inputClass =
    "mt-2 h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea]/70 px-4 text-sm outline-none focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/20";
  return (
    <section className="rounded-[2rem] border border-white bg-white/75 p-6 shadow-[0_20px_60px_rgba(11,36,71,.07)] sm:p-9">
      <div
        className="mb-7 flex rounded-full bg-[#f7f3ea] p-1"
        aria-label="Tipo de acesso"
      >
        {(
          [
            ["login", "Entrar"],
            ["register", "Criar conta"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            disabled={pending}
            onClick={() => {
              setMode(value);
              setError("");
            }}
            className={`min-h-11 flex-1 rounded-full text-sm font-semibold ${mode === value ? "bg-[#0b2447] text-white shadow-sm" : "text-[#647087]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <h2 className="font-serif text-3xl">
        {mode === "login" ? "Que bom ter você aqui." : "Sua conta começa aqui."}
      </h2>
      <button
        type="button"
        onClick={google}
        disabled={pending || !googleEnabled}
        aria-describedby={!googleEnabled ? "google-availability" : undefined}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-[#0b2447]/20 bg-white px-5 text-sm font-semibold hover:bg-[#f7f3ea] disabled:opacity-45"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
          <path
            fill="#4285F4"
            d="M43.6 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11a9.5 9.5 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.4Z"
          />
          <path
            fill="#34A853"
            d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.7-5.2c-1.8 1.2-4 1.9-6.5 1.9-5.2 0-9.5-3.5-11.1-8.1H6v5.4A20 20 0 0 0 24 44Z"
          />
          <path
            fill="#FBBC05"
            d="M12.9 27.8a12 12 0 0 1 0-7.6v-5.4H6a20 20 0 0 0 0 18.4l6.9-5.4Z"
          />
          <path
            fill="#EA4335"
            d="M24 12.1c2.8 0 5.3 1 7.3 2.8l5.5-5.5A19.2 19.2 0 0 0 24 4 20 20 0 0 0 6 14.8l6.9 5.4c1.6-4.6 5.9-8.1 11.1-8.1Z"
          />
        </svg>
        Continuar com Google
      </button>
      {!googleEnabled && (
        <p
          id="google-availability"
          className="mt-2 text-center text-xs leading-5 text-[#647087]"
        >
          O acesso com Google estará disponível em breve. Use seu e-mail para
          continuar.
        </p>
      )}
      <div className="my-6 flex items-center gap-4 text-xs text-[#647087]">
        <span className="h-px flex-1 bg-[#0b2447]/10" />
        ou use seu e-mail
        <span className="h-px flex-1 bg-[#0b2447]/10" />
      </div>
      <form onSubmit={submit} className="space-y-4" key={mode}>
        <fieldset disabled={pending} className="space-y-4">
          {mode === "register" && (
            <label className="block text-xs font-semibold">
              Nome completo
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
                className={inputClass}
              />
            </label>
          )}
          <label className="block text-xs font-semibold">
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={180}
              required
              className={inputClass}
              placeholder="voce@exemplo.com"
            />
          </label>
          <label className="block text-xs font-semibold">
            Senha
            <span className="relative block">
              <input
                name="password"
                aria-label="Senha"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                maxLength={128}
                required
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 bottom-1 grid size-10 place-items-center text-[#647087]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {mode === "register" && (
            <>
              <p className="text-xs text-[#647087]">
                Use pelo menos 8 caracteres.
              </p>
              <label className="block text-xs font-semibold">
                Confirmar senha
                <input
                  name="confirmation"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  className={inputClass}
                />
              </label>
            </>
          )}
        </fieldset>
        {mode === "login" && (
          <div className="flex flex-wrap justify-between gap-3 text-xs font-semibold">
            <Link
              className="underline underline-offset-4"
              href="/login/recuperar"
            >
              Esqueci minha senha
            </Link>
            <Link
              className="underline underline-offset-4"
              href={`/login/verificar?next=${encodeURIComponent(next)}`}
            >
              Confirmar meu e-mail
            </Link>
          </div>
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
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="min-h-12 w-full rounded-full bg-[#0b2447] px-6 text-sm font-semibold text-white transition hover:bg-[#173861] disabled:opacity-50"
        >
          {pending
            ? "Aguarde…"
            : mode === "login"
              ? "Entrar na minha conta"
              : "Criar minha conta"}
        </button>
      </form>
      <p className="mt-5 text-center text-xs leading-5 text-[#647087]">
        Saiba como tratamos seus dados na{" "}
        <Link
          href="/politica-de-privacidade"
          className="underline underline-offset-2"
        >
          Política de Privacidade
        </Link>
        .
      </p>
      {!next.startsWith("/comprar") && (
        <Link
          href="/produtos"
          className="mt-5 block text-center text-xs font-semibold"
        >
          Voltar aos produtos →
        </Link>
      )}
    </section>
  );
}
