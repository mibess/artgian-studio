import { ProductPage, productMetadata } from "../products/ProductPage";
export async function generateMetadata() { return productMetadata("suporte-pocket"); }
export default function Page() { return <ProductPage id="suporte-pocket" />; }
