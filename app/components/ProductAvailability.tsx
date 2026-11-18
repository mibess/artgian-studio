import { Check, Clock3 } from "lucide-react";
import type { Product } from "../../lib/catalog";
import { fulfillmentSummary } from "../../lib/product-fulfillment";

export default function ProductAvailability({ product }: { product: Product }) {
  const summary = fulfillmentSummary(product);
  const Icon = summary.readyToShip ? Check : Clock3;
  return (
    <div className="mt-3 text-xs leading-5">
      <span className={`inline-flex items-center gap-1.5 font-semibold ${summary.readyToShip ? "text-[#28644c]" : "text-[#765920]"}`}>
        <Icon size={14} aria-hidden="true" />{summary.label}
      </span>
      {product.fulfillment && <p className="text-[#647087]">{summary.detail}</p>}
    </div>
  );
}
