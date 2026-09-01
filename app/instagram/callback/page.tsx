import type { Metadata } from "next";
import Link from "next/link";
import BrandHeader from "../../components/BrandHeader";

export const metadata: Metadata = {
  title: "Instagram conectado | Artgian Studio",
  description: "Retorno seguro da autorização do Instagram.",
  robots: { index: false, follow: false },
};

export default function InstagramCallbackPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />
      <section className="mx-auto grid min-h-[70vh] max-w-3xl place-content-center px-5 py-20 text-center sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9b702a]">
          Integração do Instagram
        </p>
        <h1 className="mt-5 font-serif text-[clamp(2.8rem,7vw,5.2rem)] font-normal leading-[0.95] tracking-[-0.045em]">
          Autorização recebida.
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-base leading-8 text-[#56677d]">
          Você pode fechar esta janela e voltar ao painel da Meta ou às
          configurações comerciais da Artgian Studio.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white"
            href="/comercial/configuracoes"
          >
            Voltar às configurações
          </Link>
          <Link
            className="rounded-full border border-[#0b2447]/20 px-6 py-3 text-sm font-semibold"
            href="/"
          >
            Ir para o site
          </Link>
        </div>
      </section>
    </main>
  );
}
