"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowUpRight, Clock3, Search, X } from "lucide-react";
import { useProductCatalog } from "../../lib/products/context";
import { beginNavigation } from "../../lib/navigation-progress";
import {
  highlightParts,
  productPrice,
  searchProducts,
  searchSuggestions,
  storefrontProducts,
} from "../../lib/product-listing";

const RECENT_KEY = "artgian:pesquisas-recentes";
const MAX_RECENT = 6;
const PLACEHOLDER = "Buscar peças, cores, presentes…";

export function searchHref(term: string) {
  return `/produtos?busca=${encodeURIComponent(term.trim())}`;
}

export function categoryHref(category: string) {
  return `/produtos?categoria=${encodeURIComponent(category)}`;
}

// Recent searches are a per-visitor convenience: storage may be blocked, so every access is guarded.
function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

type Option = { id: string; href: string; term?: string };

const pill =
  "flex h-11 w-full items-center gap-3 rounded-full border border-white/80 bg-white/60 pr-2 pl-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.9)] ring-1 ring-[#0b2447]/10 transition";

/** Static stand-in rendered until the URL-aware search hydrates. */
export function HeaderSearchFallback() {
  return (
    <div className="relative z-10 flex min-w-0 flex-1 justify-end sm:justify-start xl:max-w-md">
      <div className={`${pill} hidden text-[#0b2447]/45 sm:flex`}>
        <Search size={18} aria-hidden="true" />
        {PLACEHOLDER}
      </div>
      <span className="grid size-11 place-items-center sm:hidden" aria-hidden="true">
        <Search size={20} />
      </span>
    </div>
  );
}

export default function HeaderSearch() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const catalog = useProductCatalog();
  const baseId = useId();
  const panelId = `${baseId}-painel`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inlineRef = useRef<HTMLInputElement>(null);

  const urlQuery = pathname === "/produtos" ? params.get("busca") || "" : "";
  const location = `${pathname}?${params.toString()}`;
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  const [syncedLocation, setSyncedLocation] = useState(location);
  const [open, setOpen] = useState<false | "inline" | "sheet">(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [top, setTop] = useState(96);

  // Follow the URL: a new search fills the box, and any navigation closes the panel.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }
  if (location !== syncedLocation) {
    setSyncedLocation(location);
    setOpen(false);
    setActive(-1);
  }

  const trimmed = query.trim();
  const products = useMemo(() => storefrontProducts(Object.values(catalog)), [catalog]);
  const categories = useMemo(() => {
    const seen = new Map<string, { name: string; image: string; alt: string; count: number }>();
    for (const p of products) {
      if (!p.category) continue;
      const entry = seen.get(p.category);
      if (entry) entry.count++;
      else seen.set(p.category, { name: p.category, image: p.image, alt: p.alt, count: 1 });
    }
    return [...seen.values()];
  }, [products]);
  // Category tiles, plus a way into custom work for ideas the shop doesn't sell yet.
  const tiles = useMemo(
    () => [
      ...categories.map((c) => ({
        name: c.name,
        meta: `${c.count} ${c.count === 1 ? "peça" : "peças"}`,
        image: c.image,
        href: categoryHref(c.name),
        custom: false,
      })),
      { name: "Sob medida", meta: "Crie a sua peça", image: "/personalized-gifts.png", href: "/personalizados", custom: true },
    ],
    [categories],
  );
  const suggestions = useMemo(
    () => (trimmed ? searchSuggestions(products, trimmed, 6) : []),
    [products, trimmed],
  );
  const matches = useMemo(() => (trimmed ? searchProducts(products, trimmed) : []), [products, trimmed]);

  // One flat list in screen order, so the arrow keys walk the panel top to bottom.
  const options: Option[] = trimmed
    ? [
        ...suggestions.map((s, i) => ({ id: `${baseId}-s${i}`, href: searchHref(s.term), term: s.term })),
        ...matches.slice(0, 4).map((p, i) => ({ id: `${baseId}-p${i}`, href: p.href })),
        { id: `${baseId}-todos`, href: searchHref(trimmed), term: trimmed },
      ]
    : [
        ...recent.map((term, i) => ({ id: `${baseId}-r${i}`, href: searchHref(term), term })),
        ...tiles.map((t, i) => ({ id: `${baseId}-c${i}`, href: t.href })),
      ];
  const activeId = open && active >= 0 ? options[active]?.id : undefined;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  if (pathname.startsWith("/comprar")) return null;

  function openPanel(mode: "inline" | "sheet") {
    if (open) return;
    const shell = rootRef.current?.closest("[data-header-shell]");
    setTop(Math.max(12, (shell?.getBoundingClientRect().bottom ?? 84) + 10));
    setRecent(readRecent());
    setActive(-1);
    setOpen(mode);
  }

  function remember(term: string) {
    const clean = term.trim();
    if (!clean) return;
    const next = [clean, ...readRecent().filter((t) => t.toLocaleLowerCase("pt-BR") !== clean.toLocaleLowerCase("pt-BR"))].slice(0, MAX_RECENT);
    writeRecent(next);
    setRecent(next);
  }

  function forget(term: string) {
    const next = readRecent().filter((t) => t !== term);
    writeRecent(next);
    setRecent(next);
  }

  function go(option: Option) {
    if (option.term) remember(option.term);
    setOpen(false);
    inlineRef.current?.blur();
    const target = new URL(option.href, window.location.href);
    if (target.pathname + target.search !== window.location.pathname + window.location.search) beginNavigation();
    router.push(option.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openPanel(event.currentTarget === inlineRef.current ? "inline" : "sheet");
      if (!options.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      // -1 is the input itself: walking past either end returns to typing.
      setActive((current) => {
        const next = current + step;
        if (next >= options.length) return -1;
        if (next < -1) return options.length - 1;
        return next;
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = active >= 0 ? options[active] : undefined;
      if (option) go(option);
      else if (trimmed) go({ id: "busca", href: searchHref(trimmed), term: trimmed });
    } else if (event.key === "Escape") {
      setOpen(false);
      event.currentTarget.blur();
    }
  }

  function onChange(value: string) {
    setQuery(value);
    setActive(-1);
  }

  const optionClass = (id: string) =>
    `outline-none transition ${activeId === id ? "bg-[#ebe4d8]/80" : "hover:bg-[#ebe4d8]/55"}`;

  const comboboxProps = {
    role: "combobox" as const,
    "aria-expanded": Boolean(open),
    "aria-controls": panelId,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": activeId,
    autoComplete: "off",
    enterKeyHint: "search" as const,
    spellCheck: false,
    type: "search",
    value: query,
    placeholder: PLACEHOLDER,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    onKeyDown,
  };

  const clearButton = query && (
    <button
      type="button"
      className="grid size-8 shrink-0 place-items-center rounded-full text-[#0b2447]/60 transition hover:bg-[#0b2447]/8 hover:text-[#0b2447]"
      aria-label="Limpar busca"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        onChange("");
        (open === "sheet" ? document.getElementById(`${baseId}-sheet`) : inlineRef.current)?.focus();
      }}
    >
      <X size={16} aria-hidden="true" />
    </button>
  );

  const sectionTitle = "text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#b88a3b]";

  const panel = open
    ? createPortal(
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-[#0b2447]/25 backdrop-blur-sm"
            aria-label="Fechar busca"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute inset-x-3 mx-auto max-w-7xl overflow-y-auto overscroll-contain rounded-[1.75rem] border border-white/70 bg-[#fffdf8]/95 text-[#0b2447] shadow-[0_18px_60px_rgba(11,36,71,0.2)] backdrop-blur-2xl sm:inset-x-6"
            id={panelId}
            style={{ top, maxHeight: `calc(100dvh - ${top}px - 12px)` }}
          >
            {open === "sheet" && (
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#0b2447]/10 bg-[#fffdf8]/95 p-3 backdrop-blur-xl">
                <button
                  type="button"
                  className="grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-[#ebe4d8]/70"
                  aria-label="Voltar"
                  onClick={() => setOpen(false)}
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <label className={`${pill} min-w-0 focus-within:bg-white focus-within:ring-[#b88a3b]/60`}>
                  <Search className="shrink-0 text-[#0b2447]/55" size={18} aria-hidden="true" />
                  <span className="sr-only">Buscar produtos</span>
                  <input
                    {...comboboxProps}
                    // The sheet only exists after a deliberate tap on the search button.
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#0b2447]/45 [&::-webkit-search-cancel-button]:hidden"
                    id={`${baseId}-sheet`}
                  />
                  {clearButton}
                </label>
              </div>
            )}

            {trimmed ? (
              <div className="grid grid-cols-1 gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] lg:gap-10">
                <section aria-labelledby={`${baseId}-sugestoes`}>
                  <h2 className={sectionTitle} id={`${baseId}-sugestoes`}>
                    Sugestões
                  </h2>
                  {suggestions.length ? (
                    <div className="mt-3 -mx-2" role="listbox" aria-labelledby={`${baseId}-sugestoes`}>
                      {suggestions.map((suggestion, i) => {
                        const id = `${baseId}-s${i}`;
                        return (
                          <Link
                            aria-selected={activeId === id}
                            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${optionClass(id)}`}
                            href={searchHref(suggestion.term)}
                            id={id}
                            key={id}
                            onClick={() => {
                              remember(suggestion.term);
                              setOpen(false);
                            }}
                            role="option"
                            tabIndex={-1}
                          >
                            <Search className="shrink-0 text-[#0b2447]/45" size={16} aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-[0.95rem]">
                              {highlightParts(suggestion.term, trimmed).map((part, k) => (
                                <span className={part.match ? "font-normal" : "font-semibold"} key={k}>
                                  {part.text}
                                </span>
                              ))}
                            </span>
                            <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#647087]">
                              {suggestion.kind}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[#647087]">
                      Nenhum termo parecido. Tente pela categoria, pela cor ou pelo
                      nome da peça.
                    </p>
                  )}
                </section>

                <section aria-labelledby={`${baseId}-produtos`}>
                  <h2 className={sectionTitle} id={`${baseId}-produtos`}>
                    {matches.length
                      ? `${matches.length} ${matches.length === 1 ? "peça encontrada" : "peças encontradas"}`
                      : "Produtos"}
                  </h2>
                  {matches.length ? (
                    <div className="mt-3 -mx-2 grid grid-cols-1 gap-1" role="listbox" aria-labelledby={`${baseId}-produtos`}>
                      {matches.slice(0, 4).map((product, i) => {
                        const id = `${baseId}-p${i}`;
                        const price = productPrice(product);
                        return (
                          <Link
                            aria-selected={activeId === id}
                            className={`flex items-center gap-4 rounded-2xl p-2 ${optionClass(id)}`}
                            href={product.href}
                            id={id}
                            key={product.id}
                            onClick={() => setOpen(false)}
                            role="option"
                            tabIndex={-1}
                          >
                            <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-[#e9dfcf]">
                              <img className="size-full object-cover" src={product.image} alt="" loading="lazy" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[#b88a3b]">
                                {product.category}
                              </span>
                              <span className="mt-1 block truncate font-serif text-lg leading-tight">
                                {product.name}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-sm font-semibold">
                              {price.prefix && (
                                <span className="block text-[0.5rem] font-bold uppercase tracking-[0.14em] text-[#647087]">
                                  {price.prefix}
                                </span>
                              )}
                              {price.value}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl bg-[#ebe4d8]/60 p-5">
                      <p className="font-serif text-xl leading-tight">
                        Ainda não temos “{trimmed}” na loja.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#647087]">
                        Podemos criar essa peça sob medida para você.
                      </p>
                      <Link
                        className="mt-4 inline-flex items-center gap-2 border-b border-[#b88a3b] pb-1 text-sm font-semibold"
                        href={`/personalizados?ideia=${encodeURIComponent(trimmed)}#orcamento`}
                        onClick={() => setOpen(false)}
                      >
                        Pedir uma peça personalizada <span className="text-[#b88a3b]">→</span>
                      </Link>
                    </div>
                  )}
                </section>

                <div className="border-t border-[#0b2447]/10 pt-4 lg:col-span-2" role="listbox" aria-label="Todos os resultados">
                  <Link
                    aria-selected={activeId === `${baseId}-todos`}
                    className={`-mx-2 flex items-center justify-between gap-4 rounded-2xl px-3 py-3 text-sm font-semibold ${optionClass(`${baseId}-todos`)}`}
                    href={searchHref(trimmed)}
                    id={`${baseId}-todos`}
                    onClick={() => {
                      remember(trimmed);
                      setOpen(false);
                    }}
                    role="option"
                    tabIndex={-1}
                  >
                    <span className="min-w-0 truncate">
                      Ver todos os resultados para “{trimmed}”
                    </span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0b2447] text-white" aria-hidden="true">
                      <ArrowUpRight size={16} />
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 p-5 sm:p-7">
                {recent.length > 0 && (
                  <section aria-labelledby={`${baseId}-recentes`}>
                    <div className="flex items-center justify-between gap-4">
                      <h2 className={sectionTitle} id={`${baseId}-recentes`}>
                        Pesquisas recentes
                      </h2>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#647087] underline-offset-4 hover:text-[#0b2447] hover:underline"
                        onClick={() => {
                          writeRecent([]);
                          setRecent([]);
                          setActive(-1);
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2" role="listbox" aria-labelledby={`${baseId}-recentes`}>
                      {recent.map((term, i) => {
                        const id = `${baseId}-r${i}`;
                        return (
                          <span
                            className={`inline-flex items-center rounded-full border border-[#0b2447]/10 ${
                              activeId === id ? "bg-[#ebe4d8]" : "bg-white/70"
                            }`}
                            key={term}
                          >
                            <Link
                              aria-selected={activeId === id}
                              className="flex items-center gap-2 py-2 pl-3.5 text-sm font-semibold outline-none"
                              href={searchHref(term)}
                              id={id}
                              onClick={() => {
                                remember(term);
                                setOpen(false);
                              }}
                              role="option"
                              tabIndex={-1}
                            >
                              <Clock3 className="text-[#b88a3b]" size={14} aria-hidden="true" />
                              {term}
                            </Link>
                            <button
                              type="button"
                              className="mx-1 grid size-7 place-items-center rounded-full text-[#0b2447]/55 transition hover:bg-[#ebe4d8] hover:text-[#0b2447]"
                              aria-label={`Remover “${term}” das pesquisas recentes`}
                              onClick={() => forget(term)}
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </section>
                )}

                {tiles.length > 0 && (
                  <section aria-labelledby={`${baseId}-categorias`}>
                    <h2 className={sectionTitle} id={`${baseId}-categorias`}>
                      Explore
                    </h2>
                    <div
                      className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
                      role="listbox"
                      aria-labelledby={`${baseId}-categorias`}
                    >
                      {tiles.map((tile, i) => {
                        const id = `${baseId}-c${i}`;
                        return (
                          <Link
                            aria-selected={activeId === id}
                            className={`group relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#e9dfcf] outline-none ${
                              activeId === id ? "ring-2 ring-[#b88a3b] ring-offset-2 ring-offset-[#fffdf8]" : ""
                            }`}
                            href={tile.href}
                            id={id}
                            key={tile.href}
                            onClick={() => setOpen(false)}
                            role="option"
                            tabIndex={-1}
                          >
                            <img
                              className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
                              src={tile.image}
                              alt=""
                              loading="lazy"
                            />
                            <span
                              className={`absolute inset-0 bg-linear-to-t ${
                                tile.custom
                                  ? "from-[#0b2447]/90 via-[#0b2447]/45 to-[#0b2447]/10"
                                  : "from-[#0b2447]/75 via-[#0b2447]/10 to-transparent"
                              }`}
                            />
                            <span className="absolute inset-x-3 bottom-3 text-white">
                              <span className="block font-serif text-lg leading-tight">
                                {tile.custom ? <i className="font-normal text-[#d8bc7b]">{tile.name}</i> : tile.name}
                              </span>
                              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white/75">
                                {tile.meta}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative z-10 flex min-w-0 flex-1 justify-end sm:justify-start xl:max-w-md" ref={rootRef}>
      <form
        className="hidden w-full sm:block"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <label
          className={`${pill} ${open === "inline" ? "bg-white ring-[#b88a3b]/60" : "hover:bg-white/80"} focus-within:bg-white focus-within:ring-[#b88a3b]/60`}
        >
          <Search className="shrink-0 text-[#0b2447]/55" size={18} aria-hidden="true" />
          <span className="sr-only">Buscar produtos</span>
          <input
            {...comboboxProps}
            aria-controls={open === "inline" ? panelId : undefined}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#0b2447]/45 [&::-webkit-search-cancel-button]:hidden"
            onFocus={() => openPanel("inline")}
            onClick={() => openPanel("inline")}
            ref={inlineRef}
          />
          {clearButton}
        </label>
      </form>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-full transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] sm:hidden"
        aria-label="Buscar produtos"
        aria-expanded={open === "sheet"}
        onClick={() => openPanel("sheet")}
      >
        <Search size={20} aria-hidden="true" />
      </button>
      {panel}
    </div>
  );
}
