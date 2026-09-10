import type { Metadata } from "next";
import AccountEmailLayout from "../AccountEmailLayout";
import EmailRequestForm from "../EmailRequestForm";
export const metadata: Metadata = {
  title: "Recuperar senha | Artgian Studio",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function RecoverPasswordPage() {
  return (
    <AccountEmailLayout title="Esqueceu sua senha?">
      <p className="mt-4 text-sm leading-7 text-[#647087]">
        Informe o e-mail da sua conta. O link para criar uma nova senha é válido
        por 30 minutos.
      </p>
      <EmailRequestForm kind="reset" />
    </AccountEmailLayout>
  );
}
