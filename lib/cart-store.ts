"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  addCartItem,
  cartItemKey,
  cartSelections,
  parseCart,
  type CartItem,
} from "./cart";

export const CART_STORAGE_KEY = "artgian:cart:v1";
const CHANGE_EVENT = "artgian:cart-change";
let memory = "[]";
let storageAvailable = true;

function getSnapshot() {
  if (!storageAvailable) return memory;
  try {
    memory = localStorage.getItem(CART_STORAGE_KEY) || "[]";
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  return memory;
}
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === CART_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
function readCart(raw: string): CartItem[] {
  try {
    return parseCart(JSON.parse(raw)) || [];
  } catch {
    return [];
  }
}
function writeCart(items: CartItem[]) {
  memory = JSON.stringify(items);
  try {
    localStorage.setItem(CART_STORAGE_KEY, memory);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function useCart() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const items = useMemo(() => (raw === null ? [] : readCart(raw)), [raw]);
  const selections = useMemo(() => cartSelections(items), [items]);
  return {
    items,
    selections,
    ready: raw !== null,
    storageAvailable,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents: selections.reduce(
      (sum, item) => sum + item.subtotalCents,
      0,
    ),
    add: (item: CartItem) =>
      writeCart(addCartItem(readCart(getSnapshot()), item)),
    remove: (key: string) =>
      writeCart(
        readCart(getSnapshot()).filter((item) => cartItemKey(item) !== key),
      ),
    setQuantity: (key: string, quantity: number) => {
      const next = parseCart(
        readCart(getSnapshot()).map((item) =>
          cartItemKey(item) === key ? { ...item, quantity } : item,
        ),
      );
      if (next) writeCart(next);
    },
    clear: () => writeCart([]),
  };
}

/** Called only after the server has confirmed payment, never from URL status alone. */
export function clearPurchasedItems(orderId: string) {
  try {
    const key = `artgian:checkout:${orderId}`;
    const snapshot = sessionStorage.getItem(key);
    if (!snapshot) return;
    const purchased = parseCart(JSON.parse(snapshot));
    if (!purchased) return;
    const next = readCart(getSnapshot()).flatMap((item) => {
      const bought = purchased.find(
        (entry) => cartItemKey(entry) === cartItemKey(item),
      );
      const quantity = item.quantity - (bought?.quantity ?? 0);
      return quantity > 0 ? [{ ...item, quantity }] : [];
    });
    writeCart(next);
    sessionStorage.removeItem(key);
  } catch {
    /* Retain the cart if the browser cannot read the checkout snapshot. */
  }
}
