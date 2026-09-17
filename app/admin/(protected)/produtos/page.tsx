import {
  getProductRecords,
  parseStorefront,
  parseStringList,
} from "../../../../lib/products/repository";
import { ProductManager } from "./ProductManager";
import { PageHeader } from "../_components";
export default async function ProductsPage() {
  const rows = await getProductRecords();
  const products = rows.map((p) => ({
    id: p.id,
    version: p.version,
    name: p.name,
    category: p.category || "",
    description: p.description || "",
    active: p.active,
    pricingType: p.pricingType as "fixed" | "from" | "quote",
    basePriceCents: p.basePriceCents,
    priceFromCents: p.priceFromCents,
    productionTime: p.productionTime || "",
    minimumQuantity: p.minimumQuantity || 1,
    maximumQuantity: Math.min(9, p.maximumQuantity || 9),
    aliases: parseStringList(p.aliases),
    materials: parseStringList(p.materials),
    availableColors: parseStringList(p.availableColors),
    availableSizes: parseStringList(p.availableSizes),
    customizationOptions: parseStringList(p.customizationOptions),
    verifiedClaims: parseStringList(p.verifiedClaims),
    notes: p.notes || "",
    storefront: parseStorefront(p.storefront),
  }));
  return (
    <>
      <PageHeader
        eyebrow="Produtos"
        title="Catálogo de produtos"
        description="Um cadastro para a loja, as vendas e o atendimento. Mantenha a identidade de cada página e as informações comerciais sempre atualizadas."
      />
      <ProductManager initialProducts={products} />
    </>
  );
}
