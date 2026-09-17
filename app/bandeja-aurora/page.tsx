import { ProductPage, productMetadata } from "../products/ProductPage";
export async function generateMetadata() { return productMetadata("bandeja-aurora"); }
export default function Page() { return <ProductPage id="bandeja-aurora" />; }
