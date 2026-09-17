import { ProductPage, productMetadata } from "../products/ProductPage";
export async function generateMetadata() { return productMetadata("organizador-arco"); }
export default function Page() { return <ProductPage id="organizador-arco" />; }
