import { ProductPage, productMetadata } from "../products/ProductPage";
export async function generateMetadata() { return productMetadata("porta-incenso-samurai"); }
export default function Page() { return <ProductPage id="porta-incenso-samurai" />; }
