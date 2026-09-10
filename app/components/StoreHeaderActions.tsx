"use client";
import Link from "next/link";
import { ShoppingBag, UserRound } from "lucide-react";
import { authClient } from "../../lib/auth-client";
import { useCart } from "../../lib/cart-store";

export default function StoreHeaderActions() {
  const { count } = useCart();
  const { data } = authClient.useSession();
  return (
    <div className="relative z-10 flex items-center gap-1 sm:gap-2">
      <Link
        href={data ? "/conta" : "/login"}
        className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold transition hover:bg-white/70"
        aria-label={data ? "Minha conta" : "Entrar"}
      >
        <UserRound size={19} aria-hidden="true" />
        <span className="hidden xl:inline">
          {data ? "Minha conta" : "Entrar"}
        </span>
      </Link>
      <Link
        href="/carrinho"
        className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold transition hover:bg-white/70"
        aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}
      >
        <ShoppingBag size={19} aria-hidden="true" />
        <span
          className="grid min-w-5 place-items-center rounded-full bg-[#0b2447] px-1.5 py-0.5 text-[10px] text-white"
          aria-hidden="true"
        >
          {count}
        </span>
      </Link>
    </div>
  );
}
