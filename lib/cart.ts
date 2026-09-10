import { z } from "zod";
import { getProductSelection } from "./catalog";

export const MAX_CART_ITEMS = 30;
export const MAX_ITEM_QUANTITY = 9;
const itemSchema = z.object({
  productId: z.string().max(80),
  color: z.string().max(40),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
  personalization: z.string().trim().min(1).max(18).nullable().optional(),
});
export type CartItem = z.infer<typeof itemSchema>;
export type CartSelection = NonNullable<ReturnType<typeof getProductSelection>>;

export function cartItemKey(item: CartItem) {
  return JSON.stringify([
    item.productId,
    item.color,
    item.personalization || null,
  ]);
}

/** Shared validation; prices and product details always come from the catalog. */
export function parseCart(value: unknown): CartItem[] | null {
  const parsed = z.array(itemSchema).max(MAX_CART_ITEMS).safeParse(value);
  if (!parsed.success) return null;
  const items = new Map<string, CartItem>();
  for (const input of parsed.data) {
    const selection = getProductSelection({
      ...input,
      personalization: input.personalization ?? undefined,
    });
    if (!selection) return null;
    const item = {
      productId: selection.productId,
      color: selection.colorKey,
      quantity: selection.quantity,
      personalization: selection.personalization,
    };
    const key = cartItemKey(item);
    item.quantity += items.get(key)?.quantity ?? 0;
    if (item.quantity > MAX_ITEM_QUANTITY) return null;
    items.set(key, item);
  }
  return [...items.values()];
}

export function cartSelections(items: CartItem[]): CartSelection[] {
  return items.map((item) =>
    getProductSelection({
      ...item,
      personalization: item.personalization ?? undefined,
    })!,
  );
}

export function addCartItem(items: CartItem[], item: CartItem): CartItem[] {
  const incoming = parseCart([item])?.[0];
  if (!incoming)
    throw new Error("Confira a cor, a quantidade e a personalização.");
  const key = cartItemKey(incoming);
  const existing = items.find((entry) => cartItemKey(entry) === key);
  if (existing && existing.quantity + incoming.quantity > MAX_ITEM_QUANTITY) {
    throw new Error(
      "Você pode adicionar até 9 unidades da mesma peça e personalização.",
    );
  }
  if (!existing && items.length >= MAX_CART_ITEMS)
    throw new Error("Seu carrinho atingiu o limite de 30 itens diferentes.");
  return existing
    ? items.map((entry) =>
        cartItemKey(entry) === key
          ? { ...entry, quantity: entry.quantity + incoming.quantity }
          : entry,
      )
    : [...items, incoming];
}

export function checkoutItems(payload: {
  items?: unknown;
  productId?: unknown;
  color?: unknown;
  quantity?: unknown;
  personalization?: unknown;
}) {
  if (payload.items !== undefined) return parseCart(payload.items);
  return parseCart([
    {
      productId: payload.productId,
      color: payload.color,
      quantity: payload.quantity,
      personalization: payload.personalization || null,
    },
  ]);
}
