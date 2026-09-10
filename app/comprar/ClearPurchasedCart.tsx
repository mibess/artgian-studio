"use client";
import { useEffect } from "react";
import { clearPurchasedItems } from "../../lib/cart-store";
export default function ClearPurchasedCart({ orderId }: { orderId: string }) {
  useEffect(() => {
    clearPurchasedItems(orderId);
  }, [orderId]);
  return null;
}
