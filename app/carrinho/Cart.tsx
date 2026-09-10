"use client";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "../../lib/cart-store";
import { cartItemKey } from "../../lib/cart";
import { formatBrl } from "../../lib/catalog";
import ProductColorImage from "../components/ProductColorImage";

export function EmptyCart() {
  return (
    <div className="mt-10 rounded-[2rem] border border-white bg-white/65 px-6 py-16 text-center">
      <ShoppingBag
        className="mx-auto text-[#b88a3b]"
        size={40}
        strokeWidth={1}
      />
      <h2 className="mt-5 font-serif text-3xl">Seu carrinho está vazio.</h2>
      <p className="mt-3 text-sm text-[#647087]">
        Escolha uma criação feita para fazer parte do seu dia.
      </p>
      <Link
        href="/produtos"
        className="mt-7 inline-flex rounded-full bg-[#0b2447] px-7 py-4 text-sm font-semibold text-white"
      >
        Explorar criações →
      </Link>
    </div>
  );
}
export default function Cart() {
  const cart = useCart();
  if (!cart.ready)
    return (
      <p className="mt-10" role="status">
        Carregando seu carrinho…
      </p>
    );
  if (!cart.items.length) return <EmptyCart />;
  return (
    <>
      {!cart.storageAvailable && (
        <p role="alert" className="mt-5 text-sm">
          Seu navegador não permite salvar o carrinho. Mantenha esta aba aberta
          para continuar.
        </p>
      )}
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {cart.selections.map((selection, index) => {
            const key = cartItemKey(cart.items[index]);
            const label = `${selection.product.name}, ${selection.color}${selection.personalization ? `, ${selection.personalization}` : ""}`;
            return (
              <article
                key={key}
                aria-label={label}
                className="flex gap-4 rounded-3xl border border-white bg-white/65 p-4 sm:gap-6 sm:p-6"
              >
                <Link href={selection.product.href} className="shrink-0">
                  <ProductColorImage
                    product={selection.productId}
                    src={selection.product.image}
                    alt={`${selection.product.name} — ${selection.color}`}
                    initialColor={selection.colorKey}
                    className="size-20 rounded-2xl object-cover sm:size-28"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={selection.product.href}
                    className="font-serif text-xl sm:text-2xl"
                  >
                    {selection.product.name}
                  </Link>
                  <p className="mt-1 text-xs text-[#647087]">
                    Cor: {selection.color}
                  </p>
                  {selection.personalization && (
                    <p className="mt-1 break-words text-xs text-[#647087]">
                      Personalização: “{selection.personalization}”
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[#647087]">
                    {formatBrl(selection.product.unitPriceCents)} por unidade
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center rounded-full border border-[#0b2447]/15 bg-white">
                      <button
                        type="button"
                        aria-label={`Diminuir quantidade de ${label}`}
                        disabled={selection.quantity === 1}
                        onClick={() =>
                          cart.setQuantity(key, selection.quantity - 1)
                        }
                        className="grid size-10 place-items-center disabled:opacity-25"
                      >
                        <Minus size={15} />
                      </button>
                      <output
                        aria-live="polite"
                        className="min-w-6 text-center text-sm font-semibold"
                      >
                        {selection.quantity}
                      </output>
                      <button
                        type="button"
                        aria-label={`Aumentar quantidade de ${label}`}
                        disabled={selection.quantity === 9}
                        onClick={() =>
                          cart.setQuantity(key, selection.quantity + 1)
                        }
                        className="grid size-10 place-items-center disabled:opacity-25"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <strong className="text-sm">
                      {formatBrl(selection.subtotalCents)}
                    </strong>
                    <button
                      type="button"
                      aria-label={`Remover ${label}`}
                      className="grid size-10 place-items-center rounded-full text-[#647087] hover:bg-red-50 hover:text-red-800"
                      onClick={() => cart.remove(key)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <Link
            href="/produtos"
            className="inline-flex py-4 text-sm font-semibold"
          >
            ← Continuar comprando
          </Link>
        </div>
        <aside className="rounded-[2rem] bg-[#0b2447] p-7 text-white lg:sticky lg:top-6">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d8bc7b]">
            Resumo do pedido
          </p>
          <p className="mt-5 text-sm text-white/65">
            {cart.count}{" "}
            {cart.count === 1 ? "peça escolhida" : "peças escolhidas"}
          </p>
          <div className="mt-6 flex justify-between border-y border-white/15 py-5">
            <span>Subtotal</span>
            <strong>{formatBrl(cart.subtotalCents)}</strong>
          </div>
          <p className="mt-4 text-xs leading-5 text-white/65">
            Frete calculado pelo CEP na próxima etapa. Produção sob encomenda.
          </p>
          <Link
            href="/comprar"
            className="mt-7 flex items-center justify-between rounded-full bg-[#d8bc7b] px-6 py-4 text-sm font-semibold text-[#0b2447]"
          >
            Finalizar compra <span aria-hidden="true">→</span>
          </Link>
          <p className="mt-4 text-center text-xs text-white/65">
            Pagamento seguro com Mercado Pago
          </p>
        </aside>
      </div>
    </>
  );
}
