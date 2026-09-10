import type { Metadata } from "next";
import Link from "next/link";
import AccountEmailLayout from "../AccountEmailLayout";
import ResetPasswordForm from "./ResetPasswordForm";
export const metadata: Metadata = {
  title: "Nova senha | Artgian Studio",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <AccountEmailLayout title="Crie sua nova senha.">
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="mt-5 space-y-4">
          <p role="alert" className="text-sm leading-7">
            Este link é inválido ou expirou. Solicite um novo link para
            redefinir sua senha.
          </p>
          <Link
            href="/login/recuperar"
            className="block text-sm font-semibold underline"
          >
            Solicitar novo link
          </Link>
        </div>
      )}
    </AccountEmailLayout>
  );
}
