"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type SortOption = { value: string; label: string; href: string };

type SortSelectProps = {
  value: string;
  options: SortOption[];
};

const icons: Record<string, LucideIcon> = {
  destaques: Sparkles,
  "menor-preco": ArrowUpNarrowWide,
  "maior-preco": ArrowDownWideNarrow,
  "a-z": ArrowDownAZ,
};

// Display is left to each control: one shows only on phones, the other from sm up.
const trigger =
  "h-11 shrink-0 items-center gap-2 rounded-full border border-[#0b2447]/15 bg-white/55 text-sm transition hover:bg-white";

// Phones keep the native picker, which already feels right there; from the sm
// breakpoint up the options open in a menu drawn in the store's own style.
export default function SortSelect({ value, options }: SortSelectProps) {
  const router = useRouter();
  const baseId = useId();
  const listId = `${baseId}-opcoes`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Show the new choice right away; the listing catches up when navigation ends.
  const [selected, setSelected] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setSelected(value);
  }

  const current = options.find((o) => o.value === selected) ?? options[0];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function choose(option: SortOption) {
    setOpen(false);
    buttonRef.current?.focus();
    if (option.value === selected) return;
    setSelected(option.value);
    startTransition(() => router.push(option.href, { scroll: false }));
  }

  function openMenu(at?: "first" | "last") {
    const index = options.findIndex((o) => o.value === selected);
    setActive(at === "first" ? 0 : at === "last" ? options.length - 1 : Math.max(0, index));
    setOpen(true);
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1;
    const moves: Record<string, () => number> = {
      ArrowDown: () => (active >= last ? 0 : active + 1),
      ArrowUp: () => (active <= 0 ? last : active - 1),
      Home: () => 0,
      End: () => last,
    };
    if (moves[event.key]) {
      event.preventDefault();
      setActive(moves[event.key]());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <label className={`${trigger} relative flex w-full pr-10 pl-4 focus-within:ring-2 focus-within:ring-[#b88a3b]/50 sm:hidden`}>
        <span className="text-[#647087]">Ordenar:</span>
        <select
          className="min-w-0 flex-1 appearance-none bg-transparent font-semibold outline-none"
          value={selected}
          onChange={(event) => {
            const option = options.find((o) => o.value === event.target.value);
            if (option) choose(option);
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

      <button
        type="button"
        ref={buttonRef}
        className={`${trigger} hidden pr-3 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] sm:inline-flex ${
          open ? "bg-white ring-2 ring-[#b88a3b]/40" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-busy={pending}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowDown" ? "first" : "last");
          }
        }}
      >
        <span className="text-[#647087]">Ordenar:</span>
        <span className="font-semibold">{current?.label}</span>
        <span className="grid size-6 place-items-center text-[#0b2447]/60" aria-hidden="true">
          {pending ? (
            <span className="ui-spinner text-[#b88a3b]" />
          ) : (
            <ChevronDown className={`transition duration-200 ${open ? "rotate-180" : ""}`} size={16} />
          )}
        </span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-30 mt-2 w-72 origin-top-right rounded-[1.4rem] border border-white/70 bg-[#fffdf8]/95 p-2 text-[#0b2447] shadow-[0_18px_60px_rgba(11,36,71,0.18)] ring-1 ring-[#0b2447]/5 backdrop-blur-2xl transition duration-150 ease-out starting:-translate-y-1 starting:scale-95 starting:opacity-0">
          <p className="px-3 pt-2 pb-2 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#b88a3b]" id={`${listId}-titulo`}>
            Ordenar por
          </p>
          <div
            aria-activedescendant={`${listId}-${options[active]?.value}`}
            aria-labelledby={`${listId}-titulo`}
            className="outline-none"
            id={listId}
            onKeyDown={onListKeyDown}
            ref={listRef}
            role="listbox"
            tabIndex={-1}
          >
            {options.map((option, index) => {
              const Icon = icons[option.value] ?? Sparkles;
              const isSelected = option.value === selected;
              return (
                <div
                  aria-selected={isSelected}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                    index === active ? "bg-[#ebe4d8]/75" : ""
                  }`}
                  id={`${listId}-${option.value}`}
                  key={option.value}
                  onClick={() => choose(option)}
                  onPointerMove={() => setActive(index)}
                  role="option"
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full transition ${
                      isSelected ? "bg-[#0b2447] text-[#d8bc7b]" : "bg-[#ebe4d8]/70 text-[#0b2447]/70"
                    }`}
                    aria-hidden="true"
                  >
                    <Icon size={15} strokeWidth={1.8} />
                  </span>
                  <span className={`flex-1 ${isSelected ? "font-semibold" : ""}`}>{option.label}</span>
                  {isSelected && <Check className="shrink-0 text-[#b88a3b]" size={16} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
