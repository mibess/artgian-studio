"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { useState } from "react";

export default function OrderThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  return <span className="grid size-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#0b2447]/5 bg-[#f2eee5] text-[#b88a3b]">
    {src && src !== failedSource ? <Image src={src} alt={alt} width={72} height={72} sizes="72px" unoptimized={src.startsWith("https://")} onError={() => setFailedSource(src)} className="size-full object-cover" /> : <Package size={25} strokeWidth={1.3} aria-label="Imagem do produto indisponível" />}
  </span>;
}
