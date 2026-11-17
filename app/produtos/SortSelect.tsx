"use client";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

type SortSelectProps = {
  value: string;
  options: { value: string; label: string; href: string }[];
};

export default function SortSelect({ value, options }: SortSelectProps) {
  const router = useRouter();
  return (
    <label className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#0b2447]/15 bg-white/55 pr-10 pl-4 text-sm transition focus-within:ring-2 focus-within:ring-[#b88a3b]/50 hover:bg-white">
      <span className="text-[#647087]">Ordenar:</span>
      <select
        className="appearance-none bg-transparent font-semibold outline-none"
        value={value}
        onChange={(event) => {
          const option = options.find((o) => o.value === event.target.value);
          if (option) router.push(option.href, { scroll: false });
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 text-[#0b2447]/60" size={16} aria-hidden="true" />
    </label>
  );
}
