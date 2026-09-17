import seeds from "./initial-products.json";
import { toProduct } from "../../lib/products/repository";
import type { CatalogRecord } from "../../lib/products/repository";
import type { ProductCatalog } from "../../lib/catalog";
import * as cart from "../../lib/cart";
export const catalog: ProductCatalog = Object.fromEntries(
  seeds.map((p) => {
    const product = toProduct({
      id: "store-" + p.id,
      storeId: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      basePriceCents: p.basePriceCents,
      priceFromCents: null,
      pricingType: "fixed",
      active: true,
      productionTime: null,
      minimumQuantity: 1,
      maximumQuantity: 9,
      storefront: JSON.stringify(p.storefront),
    } as CatalogRecord)!;
    return [product.id, product];
  }),
);
export const parseCart = (value: unknown) => cart.parseCart(value, catalog);
export const addCartItem = (items: cart.CartItem[], item: cart.CartItem) =>
  cart.addCartItem(items, item, catalog);
export const cartSelections = (items: cart.CartItem[]) =>
  cart.cartSelections(items, catalog);
export const checkoutItems = (
  payload: Parameters<typeof cart.checkoutItems>[0],
) => cart.checkoutItems(payload, catalog);
export const cartItemKey = cart.cartItemKey;
