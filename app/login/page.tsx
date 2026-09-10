import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import BrandHeader from "../components/BrandHeader";
import { getCustomerSession, googleLoginEnabled } from "../../lib/auth";
import { safeReturnTo } from "../../lib/auth-redirect";
import LoginForm from "./LoginForm";
export const metadata: Metadata = {
  title: "Entrar | Artgian Studio",
  robots: { index: false, follow: false },
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeReturnTo(params.next);
  if (await getCustomerSession(await headers())) redirect(next);
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:py-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b88a3b]">
            Bem-vindo à Artgian
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight tracking-tight sm:text-6xl">
            Um espaço
            <br />
            com a sua cara.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#647087]">
            Entre ou crie sua conta para finalizar compras, acompanhar pedidos
            e preencher seus dados com mais facilidade.
          </p>
          <p className="mt-5 text-xs leading-6 text-[#647087]">
            Seu carrinho e a seleção do produto continuam aqui enquanto você
            acessa sua conta.
          </p>
        </div>
        <LoginForm
          next={next}
          googleEnabled={googleLoginEnabled()}
          oauthError={Boolean(params.error)}
        />
      </div>
    </main>
  );
}
