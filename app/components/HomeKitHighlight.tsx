import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "../../lib/catalog";
import { productPrice } from "../../lib/product-listing";

export default function HomeKitHighlight({ product }: { product: Product }) {
  const price = productPrice(product);

  return (
    <section
      aria-labelledby="kit-natalino-destaque"
      className="site-container mt-10 sm:mt-14 md:mt-16 lg:mt-20"
    >
      <div className="grid grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] items-center gap-x-3.5 gap-y-2.5 rounded-3xl border border-[#d8bc7b]/20 bg-[linear-gradient(105deg,#193556,#0b2447_72%)] p-3.5 text-[#f7f3ea] shadow-[0_16px_40px_rgba(11,36,71,.13)] sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-5 sm:p-5 md:min-h-36 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:gap-x-6 md:py-4 lg:min-h-40 lg:grid-cols-[15rem_minmax(0,1fr)_auto] lg:gap-x-8 lg:px-7">
        <div className="relative row-span-2 self-stretch md:row-span-1">
          <Image
            src="/kit-natalino-trico-recorte.webp"
            alt="Cinco miniaturas de Natal com textura de tricô em uma bandeja branca"
            width={640}
            height={560}
            sizes="(min-width: 1024px) 240px, (min-width: 768px) 192px, (min-width: 640px) 160px, 42vw"
            className="absolute inset-x-0 -top-8 h-auto w-full drop-shadow-[0_8px_12px_rgba(6,23,46,.32)] sm:-top-10 md:top-auto md:-bottom-1"
          />
        </div>

        <div className="min-w-0">
          <h2
            id="kit-natalino-destaque"
            className="font-serif text-[clamp(1.5rem,3.35vw,3.1rem)] leading-none tracking-[-0.045em]"
          >
            Kit Natalino <em className="font-normal text-[#d8bc7b]">Tricô</em>
          </h2>
          <p className="mt-2 text-xs leading-snug text-[#f7f3ea]/85 sm:text-sm">
            Cinco miniaturas e uma bandeja.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-[#efd197] sm:text-sm">
            {price.prefix ? `${price.prefix} ` : ""}{price.value}
          </p>
        </div>

        <Link
          href={product.href}
          aria-label="Ver o Kit Natalino Tricô"
          className="inline-flex min-h-11 w-fit max-w-full items-center gap-2 rounded-full bg-[#f7f3ea] px-3.5 py-2 text-xs font-semibold text-[#0b2447] transition-colors hover:bg-[#efd197] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8bc7b] sm:gap-3 sm:px-5 sm:text-sm"
        >
          Ver o kit <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      </div>
    </section>
  );
}
