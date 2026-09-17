import { ProductPage, productMetadata } from "../products/ProductPage";
export async function generateMetadata() { return productMetadata("porta-palhetas-solo"); }
export default function Page() { return <ProductPage id="porta-palhetas-solo" />; }
