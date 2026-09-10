import type { Metadata } from "next";
import BrandHeader from "../components/BrandHeader";
import Cart from "./Cart";
export const metadata: Metadata = {
  title: "Seu carrinho | Artgian Studio",
  robots: { index: false, follow: false },
};
export default function CartPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#0b2447]">
      <BrandHeader />
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-20">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b88a3b]">
          Suas próximas criações
        </p>
        <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">
          Seu carrinho.
        </h1>
        <Cart />
      </div>
    </main>
  );
}
