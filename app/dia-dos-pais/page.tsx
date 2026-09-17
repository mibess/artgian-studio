import { ProductPage, productMetadata } from "../products/ProductPage";
export async function generateMetadata() { return productMetadata("kit-dia-dos-pais"); }
export default function Page() { return <ProductPage id="kit-dia-dos-pais" />; }
