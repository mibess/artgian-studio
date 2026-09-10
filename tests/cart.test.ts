import { describe, expect, it } from "vitest";
import {
  addCartItem,
  cartItemKey,
  cartSelections,
  checkoutItems,
  parseCart,
} from "../lib/cart";
import { safeReturnTo } from "../lib/auth-redirect";
const item = {
  productId: "organizador-arco",
  color: "rosa-marfim",
  quantity: 2,
};
describe("store cart", () => {
  it("merges identical variants and preserves separate colors and personalization", () => {
    let cart = addCartItem([], item);
    cart = addCartItem(cart, { ...item, quantity: 1 });
    cart = addCartItem(cart, { ...item, color: "marrom-branco" });
    cart = addCartItem(cart, {
      productId: "porta-palhetas-solo",
      color: "preto",
      quantity: 1,
      personalization: "Ana",
    });
    cart = addCartItem(cart, {
      productId: "porta-palhetas-solo",
      color: "preto",
      quantity: 1,
      personalization: "Bia",
    });
    expect(cart.map((entry) => entry.quantity)).toEqual([3, 2, 1, 1]);
    expect(new Set(cart.map(cartItemKey)).size).toBe(4);
  });
  it.each([
    null,
    {},
    [{ ...item, productId: "__proto__" }],
    [{ ...item, productId: "constructor" }],
    [{ ...item, color: "preto" }],
    [{ ...item, quantity: 1.5 }],
    [{ ...item, quantity: -1 }],
    [{ ...item, quantity: 10 }],
    [{ ...item, quantity: "2" }],
    [{ ...item, personalization: "x".repeat(19) }],
    Array(31).fill(item),
  ])("rejects malformed cart %j", (input) => {
    expect(parseCart(input)).toBeNull();
  });
  it("does not silently truncate quantities or use client prices", () => {
    expect(() => addCartItem([{ ...item, quantity: 9 }], item)).toThrow(
      "9 unidades",
    );
    const cart = parseCart([{ ...item, unitPriceCents: 1, subtotalCents: 1 }])!;
    expect(cartSelections(cart)[0].subtotalCents).toBe(10_980);
    expect(
      parseCart([
        { ...item, quantity: 5 },
        { ...item, quantity: 5 },
      ]),
    ).toBeNull();
  });
  it("supports legacy direct checkout and prioritizes explicit cart validation", () => {
    expect(checkoutItems(item)).toHaveLength(1);
    expect(checkoutItems({ ...item, items: null })).toBeNull();
    expect(checkoutItems({ ...item, items: [] })).toEqual([]);
  });
});
describe("login return destination", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/api/auth/sign-out",
    "/comercial",
    "/login",
    "/comprar\n",
  ])("rejects %s", (url) => expect(safeReturnTo(url)).toBe("/conta"));
  it("preserves direct checkout selection", () =>
    expect(
      safeReturnTo("/comprar?produto=organizador-arco&cor=rosa-marfim"),
    ).toBe("/comprar?produto=organizador-arco&cor=rosa-marfim"));
});
