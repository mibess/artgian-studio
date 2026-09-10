"use client";
import Link from "next/link";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import type { CartItem } from "../../lib/cart";
import { useCart } from "../../lib/cart-store";

export default function AddToCartButton({
  item,
  disabled,
}: {
  item: CartItem;
  disabled?: boolean;
}) {
  const cart = useCart();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled || !cart.ready}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-current/25 bg-white/40 px-5 text-sm font-semibold transition hover:bg-white/80 disabled:opacity-40"
        onClick={() => {
          setError("");
          setMessage("");
          try {
            cart.add(item);
            setMessage("Adicionado ao carrinho.");
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Não foi possível adicionar o item.",
            );
          }
        }}
      >
        <ShoppingBag size={17} aria-hidden="true" />
        Adicionar ao carrinho
      </button>
      <div aria-live="polite">
        {message && (
          <p className="mt-3 text-center text-sm">
            {message}{" "}
            <Link
              href="/carrinho"
              className="font-semibold underline underline-offset-4"
            >
              Ver carrinho →
            </Link>
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
