"use client";
import Link from "next/link";
import { useCart } from "../../lib/cart-store";
import type { CartItem } from "../../lib/cart";
import { EmptyCart } from "../carrinho/Cart";
import CheckoutForm from "./CheckoutForm";
export default function CheckoutContents({
  initialItem,
  invalidSelection,
}: {
  initialItem: CartItem | null;
  invalidSelection: boolean;
}) {
  const cart = useCart();
  if (invalidSelection)
    return (
      <div className="rounded-3xl bg-white/70 p-8">
        <p>
          Esta seleção não está disponível. Confira os produtos no seu carrinho.
        </p>
        <Link
          href="/carrinho"
          className="mt-4 inline-flex font-semibold underline"
        >
          Voltar ao carrinho
        </Link>
      </div>
    );
  if (!initialItem && !cart.ready)
    return <p role="status">Carregando seu pedido…</p>;
  const items = initialItem ? [initialItem] : cart.items;
  if (!items.length) return <EmptyCart />;
  return (
    <CheckoutForm
      key={JSON.stringify(items)}
      items={items}
      fromCart={!initialItem}
    />
  );
}
