import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { Product } from "../../lib/catalog";
import { productPrice } from "../../lib/product-listing";

type ProductCardProps = {
  product: Product;
  /** Grid placement classes (column/row spans). */
  className?: string;
  /** Image frame classes; defaults to the portrait shelf format. */
  frame?: string;
  /** Caption classes; stretched tiles pass `lg:flex-none` so the photo takes the spare height. */
  caption?: string;
  feature?: boolean;
  eager?: boolean;
};

export default function ProductCard({
  product,
  className = "",
  frame = "aspect-[4/5]",
  caption = "flex-1",
  feature = false,
  eager = false,
}: ProductCardProps) {
  const price = productPrice(product);
  const buyable = product.purchasable && product.pricingType === "fixed";
  const multiTone = product.variants.some((v) => v.swatches.length > 1);

  return (
    <Link
      className={`group flex flex-col rounded-[1.6rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b] ${className}`}
      href={product.href}
    >
      <div className={`relative overflow-hidden rounded-[1.5rem] bg-[#e9dfcf] ${frame}`}>
        <img
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.04]"
          src={product.image}
          alt={product.alt}
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 sm:top-4 sm:left-4">
          {feature && (
            <span className="rounded-full bg-[#0b2447] px-3 py-1.5 text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[#f7f3ea] shadow-sm sm:text-[0.6rem]">
              Em destaque
            </span>
          )}
          {product.customizable && (
            <span className="rounded-full border border-white/50 bg-white/70 px-3 py-1.5 text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[#0b2447] shadow-sm backdrop-blur-xl sm:text-[0.6rem]">
              Personalizável
            </span>
          )}
        </div>
      </div>

      <div className={`mt-4 flex flex-col sm:mt-5 ${caption}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#b88a3b] sm:text-[0.65rem]">
            {product.category}
          </span>
          {product.variants.length > 1 && (
            <span className="flex shrink-0 items-center gap-2" title={product.variants.map((v) => v.name).join(", ")}>
              <span className="flex -space-x-1" aria-hidden="true">
                {product.variants.slice(0, 4).map((variant) => (
                  <i
                    className="flex size-3.5 overflow-hidden rounded-full border border-[#f7f3ea] ring-1 ring-[#0b2447]/15"
                    key={variant.key}
                  >
                    {variant.swatches.map((swatch, i) => (
                      <b className="h-full flex-1" key={i} style={{ backgroundColor: swatch }} />
                    ))}
                  </i>
                ))}
              </span>
              <span className="hidden text-[0.65rem] font-semibold text-[#647087] sm:inline lg:hidden xl:inline">
                {product.variants.length} {multiTone ? "combinações" : "cores"}
              </span>
            </span>
          )}
        </div>
        <h3
          className={`mt-2 font-serif leading-tight font-normal tracking-[-0.02em] ${
            feature ? "text-2xl sm:text-4xl" : "text-lg sm:text-2xl"
          }`}
        >
          {product.name}
        </h3>
        {feature && product.description && (
          <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-[#647087]">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <span className="leading-tight">
            {price.prefix && (
              <span className="block text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[#647087]">
                {price.prefix}
              </span>
            )}
            <strong className={`font-semibold ${feature ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>
              {price.value}
            </strong>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0b2447] p-2.5 text-xs font-semibold text-[#fffdf8] transition group-hover:bg-[#143866] sm:py-2.5 sm:pr-4 sm:pl-3.5">
            <ShoppingBag size={16} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{buyable ? "Comprar" : "Ver detalhes"}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
