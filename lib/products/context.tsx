"use client";
import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ProductCatalog } from "../catalog";
const Context = createContext<ProductCatalog>({});
export function ProductCatalogProvider({
  catalog,
  children,
}: {
  catalog: ProductCatalog;
  children: React.ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  return <Context.Provider value={catalog}>{children}</Context.Provider>;
}
export function useProductCatalog() {
  return useContext(Context);
}
