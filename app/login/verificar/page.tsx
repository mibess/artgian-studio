import type { Metadata } from "next";
import Link from "next/link";
import { safeReturnTo } from "../../../lib/auth-redirect";
import AccountEmailLayout from "../AccountEmailLayout";
import EmailRequestForm from "../EmailRequestForm";
export const metadata: Metadata = {
  title: "Confirmar e-mail | Artgian Studio",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeReturnTo(params.next);
  const success = params.confirmed === "1" && !params.error;
  return (
    <AccountEmailLayout
      title={success ? "E-mail confirmado." : "Confirme seu e-mail."}
    >
      {success ? (
        <>
          <p role="status" className="mt-4 text-sm leading-7 text-[#647087]">
            Agora você pode entrar com seu e-mail e senha.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-[#0b2447] px-5 text-sm font-semibold text-white"
          >
            Entrar na minha conta
          </Link>
        </>
      ) : (
        <>
          {params.error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            >
              Este link é inválido ou expirou. Solicite uma nova confirmação
              abaixo.
            </p>
          ) : (
            <p className="mt-4 text-sm leading-7 text-[#647087]">
              Para acessar sua conta com senha, abra a mensagem de confirmação
              enviada para seu e-mail. O link vale por 1 hora. Confira também o
              spam.
            </p>
          )}
          <p className="mt-4 text-xs leading-6 text-[#647087]">
            Não recebeu? Informe seu e-mail para solicitar outro link.
          </p>
          <EmailRequestForm kind="verification" next={next} />
        </>
      )}
    </AccountEmailLayout>
  );
}
