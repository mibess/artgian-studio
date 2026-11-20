"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Inbox, LoaderCircle, MessageCircleMore, PenLine, Search, X } from "lucide-react";
import { formatBrl } from "../../../../lib/catalog";
import { nextStepHint, orderSituation, ORDER_QUEUES, type AdminOrder, type OrderQueue, type OrderQueueCounts } from "../../../../lib/admin-order-view";
import { OrderPanel } from "./OrderPanel";
import { Badge } from "./ui";

type WorkspaceProps = {
  orders: AdminOrder[];
  focusOrder: AdminOrder | null;
  queue: OrderQueue;
  query: string;
  counts: OrderQueueCounts;
  page: number;
  pageCount: number;
  pageSize: number;
  initialSelectedId: string | null;
};

function ordersHref({ queue, query, page, orderId }: { queue: OrderQueue; query: string; page: number; orderId?: string | null }) {
  const params = new URLSearchParams();
  if (queue !== "a-enviar") params.set("fila", queue);
  if (query) params.set("busca", query);
  if (page > 1) params.set("pagina", String(page));
  if (orderId) params.set("pedido", orderId);
  const search = params.toString();
  return search ? `/admin/pedidos?${search}` : "/admin/pedidos";
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));

export function OrdersWorkspace({ orders, focusOrder, queue, query, counts, page, pageCount, pageSize, initialSelectedId }: WorkspaceProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [updatedOrders, setUpdatedOrders] = useState<Record<string, AdminOrder>>({});
  const [search, setSearch] = useState(query);
  // The last query this page sent; any other incoming query came from back/forward navigation.
  const [requestedQuery, setRequestedQuery] = useState(query);
  const [receivedQuery, setReceivedQuery] = useState(query);
  if (query !== receivedQuery) {
    setReceivedQuery(query);
    if (query !== requestedQuery) {
      setRequestedQuery(query);
      setSearch(query);
    }
  }
  const [searching, startSearch] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const openedWithPush = useRef(false);
  // Where the open order sat in the list, so J/K keep working after it leaves the queue.
  const [anchorIndex, setAnchorIndex] = useState(() => orders.findIndex(order => order.id === initialSelectedId));

  // The list is authoritative; an order that just left this queue keeps its latest saved copy open.
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return orders.find(order => order.id === selectedId)
      ?? updatedOrders[selectedId]
      ?? (focusOrder?.id === selectedId ? focusOrder : null);
  }, [orders, updatedOrders, focusOrder, selectedId]);
  const selectedIndex = selectedId ? orders.findIndex(order => order.id === selectedId) : -1;

  const select = useCallback((id: string) => {
    const url = ordersHref({ queue, query, page, orderId: id });
    if (selectedId) window.history.replaceState(null, "", url);
    else {
      window.history.pushState(null, "", url);
      openedWithPush.current = true;
    }
    setSelectedId(id);
    setAnchorIndex(orders.findIndex(order => order.id === id));
  }, [orders, page, query, queue, selectedId]);

  const close = useCallback(() => {
    const id = selectedId;
    if (openedWithPush.current) {
      openedWithPush.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", ordersHref({ queue, query, page }));
    }
    setSelectedId(null);
    if (id) requestAnimationFrame(() => rowRefs.current.get(id)?.focus({ preventScroll: false }));
  }, [page, query, queue, selectedId]);

  const neighbor = useCallback((direction: 1 | -1) => {
    if (selectedIndex >= 0) return orders[selectedIndex + direction] ?? null;
    if (!selectedId) return direction === 1 ? orders[0] ?? null : null;
    // The open order left the list (for example, it was just shipped): its successor took its place.
    const base = Math.max(0, anchorIndex);
    return (direction === 1 ? orders[base] : orders[base - 1]) ?? null;
  }, [anchorIndex, orders, selectedId, selectedIndex]);

  const goTo = useCallback((direction: 1 | -1) => {
    const target = neighbor(direction);
    if (!target) return;
    select(target.id);
    rowRefs.current.get(target.id)?.scrollIntoView({ block: "nearest" });
  }, [neighbor, select]);

  useEffect(() => {
    const onPopState = () => {
      openedWithPush.current = false;
      setSelectedId(new URLSearchParams(window.location.search).get("pedido"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        if (isTyping(event.target)) (event.target as HTMLElement).blur();
        else if (selectedId) { event.preventDefault(); close(); }
        return;
      }
      if (isTyping(event.target)) return;
      if (event.key === "/") { event.preventDefault(); searchRef.current?.focus(); }
      else if (event.key === "j") { event.preventDefault(); goTo(1); }
      else if (event.key === "k") { event.preventDefault(); goTo(-1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, goTo, selectedId]);

  // Below xl the order opens over the list, so the page behind it must not scroll.
  useEffect(() => {
    if (!selectedId || !window.matchMedia("(max-width: 1279.98px)").matches) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    panelRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [selectedId]);

  // Debounced search keeps typing fluid and the URL shareable.
  useEffect(() => {
    const value = search.trim();
    if (value === requestedQuery) return;
    const timer = setTimeout(() => {
      // The replaced entry now carries the search, so closing must not go back to the old results.
      openedWithPush.current = false;
      setRequestedQuery(value);
      startSearch(() => router.replace(ordersHref({ queue, query: value, page: 1, orderId: selectedId }), { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [queue, requestedQuery, router, search, selectedId]);

  const onOrderChange = useCallback((order: AdminOrder) => {
    setUpdatedOrders(current => ({ ...current, [order.id]: order }));
  }, []);

  const queueInfo = ORDER_QUEUES.find(item => item.id === queue)!;
  const total = counts[queue];
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  const otherMatches = query && !total ? ORDER_QUEUES.filter(item => item.id !== queue && item.id !== "todos" && counts[item.id] > 0) : [];
  const previous = selected ? neighbor(-1) : null;
  const next = selected ? neighbor(1) : null;

  return (
    <div>
      <nav aria-label="Filas de pedidos" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-7 sm:px-7 lg:mx-0 lg:px-0">
        <ul className="flex min-w-max gap-1 border-b border-[#dfded6]">
          {ORDER_QUEUES.map(item => {
            const active = item.id === queue;
            const urgent = item.id === "a-enviar" && counts[item.id] > 0;
            return (
              <li key={item.id}>
                <Link
                  href={ordersHref({ queue: item.id, query, page: 1 })}
                  scroll={false}
                  onClick={() => { openedWithPush.current = false; setSelectedId(null); }}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex min-h-11 items-center gap-2 rounded-t-lg px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#b88a3b] ${active ? "font-semibold text-[#193244]" : "text-[#5d6b72] hover:bg-white/60 hover:text-[#193244]"}`}
                >
                  {item.label}
                  <QueueCount value={counts[item.id]} urgent={urgent} active={active} />
                  {active && <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#193244]" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
        <section aria-label={`Pedidos: ${queueInfo.label}`} className="min-w-0">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a979d]" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              aria-label="Buscar pedidos"
              placeholder="Buscar nome, CPF, e-mail ou nº"
              maxLength={80}
              className="h-12 w-full rounded-2xl border border-[#dfded6] bg-white pl-10 pr-11 text-sm text-[#193244] shadow-[0_1px_2px_rgba(25,50,68,.04)] outline-none transition placeholder:text-[#8a979d] focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {searching ? (
              <LoaderCircle size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[#8a979d]" aria-label="Buscando" />
            ) : search && (
              <button type="button" onClick={() => { setSearch(""); searchRef.current?.focus(); }} aria-label="Limpar busca" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#74838a] hover:bg-[#193244]/6">
                <X size={16} />
              </button>
            )}
            {!search && !searching && <kbd aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[#dfded6] px-1.5 font-sans text-[11px] text-[#8a979d] xl:inline">/</kbd>}
          </div>

          <div className={`mt-3 overflow-hidden rounded-[20px] border border-[#e1e1db] bg-white shadow-[0_8px_28px_rgba(32,52,60,.04)] transition-opacity ${searching ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between gap-3 border-b border-[#efeee8] px-4 py-2.5 text-xs text-[#74838a] sm:px-5">
              <span aria-live="polite">
                {query ? `${total} ${total === 1 ? "resultado" : "resultados"} para “${query}”` : `${total} ${total === 1 ? "pedido" : "pedidos"}`}
              </span>
              {queue === "a-enviar" && total > 1 && <span>Mais antigos primeiro</span>}
            </div>

            {orders.length ? (
              <ul className="divide-y divide-[#f0efe9]">
                {orders.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    selected={order.id === selectedId}
                    href={ordersHref({ queue, query, page, orderId: order.id })}
                    onSelect={() => select(order.id)}
                    rowRef={element => {
                      if (element) rowRefs.current.set(order.id, element);
                      else rowRefs.current.delete(order.id);
                    }}
                  />
                ))}
              </ul>
            ) : (
              <div className="px-6 py-14 text-center">
                <Inbox size={28} className="mx-auto text-[#b9c0c3]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-[#415967]">{query ? `Nada em “${queueInfo.label}” para essa busca.` : queueInfo.empty}</p>
                {otherMatches.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {otherMatches.map(item => (
                      <Link key={item.id} href={ordersHref({ queue: item.id, query, page: 1 })} scroll={false} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#193244]/15 px-4 text-xs font-semibold text-[#193244] hover:border-[#193244]/35">
                        Ver {counts[item.id]} em {item.label} <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pageCount > 1 && (
              <nav aria-label="Páginas de pedidos" className="flex items-center justify-between gap-3 border-t border-[#efeee8] px-4 py-3 text-xs text-[#74838a] sm:px-5">
                <span className="tabular-nums">{first}–{last} de {total}</span>
                <div className="flex gap-2">
                  <PageLink href={page > 1 ? ordersHref({ queue, query, page: page - 1 }) : null} label="Anterior"><ChevronLeft size={15} aria-hidden="true" /></PageLink>
                  <PageLink href={page < pageCount ? ordersHref({ queue, query, page: page + 1 }) : null} label="Próxima" trailing><ChevronRight size={15} aria-hidden="true" /></PageLink>
                </div>
              </nav>
            )}
          </div>
          <p className="mt-3 hidden text-center text-[11px] text-[#8a979d] xl:block">
            Atalhos: <Kbd>J</Kbd> próximo · <Kbd>K</Kbd> anterior · <Kbd>/</Kbd> buscar · <Kbd>Esc</Kbd> fechar
          </p>
        </section>

        {selected && <button type="button" aria-label="Fechar pedido" tabIndex={-1} onClick={close} className="fixed inset-0 z-40 hidden bg-[#091923]/40 backdrop-blur-[2px] lg:block xl:hidden" />}
        <div
          ref={panelRef}
          className={selected
            ? "fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#f3f1eb] lg:left-auto lg:w-[min(680px,100%)] lg:shadow-[-24px_0_60px_rgba(9,25,35,.18)] xl:sticky xl:inset-auto xl:top-6 xl:z-auto xl:max-h-[calc(100dvh-3rem)] xl:w-auto xl:rounded-[20px] xl:border xl:border-[#e1e1db] xl:bg-[#f8f7f3] xl:shadow-none"
            : "hidden xl:block"}
        >
          {selected ? (
            <OrderPanel
              key={selected.id}
              order={selected}
              headingRef={headingRef}
              position={selectedIndex >= 0 ? `${(page - 1) * pageSize + selectedIndex + 1} de ${total}` : null}
              onClose={close}
              onPrev={previous ? () => goTo(-1) : null}
              onNext={next ? () => goTo(1) : null}
              onOrderChange={onOrderChange}
            />
          ) : (
            <div className="sticky top-6 grid min-h-[420px] place-items-center rounded-[20px] border border-dashed border-[#d9d8d0] px-8 text-center">
              <div>
                <PenLine size={26} className="mx-auto text-[#c2c8ca]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-[#415967]">Selecione um pedido</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#8a979d]">Os detalhes, a etiqueta e a atualização da entrega aparecem aqui, sem sair da lista.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderRow({ order, selected, href, onSelect, rowRef }: {
  order: AdminOrder; selected: boolean; href: string; onSelect: () => void; rowRef: (element: HTMLAnchorElement | null) => void;
}) {
  const situation = orderSituation(order);
  const hint = nextStepHint(order);
  const [firstItem, ...rest] = order.items;
  return (
    <li>
      <a
        ref={rowRef}
        href={href}
        aria-current={selected ? "true" : undefined}
        onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onSelect();
        }}
        className={`relative block px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#b88a3b] sm:px-5 ${selected ? "bg-[#f6efe1]" : "hover:bg-[#faf9f5]"}`}
      >
        {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#b88a3b]" />}
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold text-[#193244]">{order.customer.name}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-[#193244]">{formatBrl(order.totals.totalCents)}</span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-3">
          <span className="truncate text-xs text-[#74838a]">
            <span className="font-mono">#{order.shortId}</span> · <time dateTime={order.createdAt} title={order.createdLabel}>{order.createdRelative}</time>
          </span>
          <Badge tone={situation.tone}>{situation.label}</Badge>
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-xs text-[#415967]">
          <span className="min-w-0 truncate">
            {firstItem ? `${firstItem.quantity}× ${firstItem.name}` : "Sem itens"}
            {rest.length > 0 && <span className="text-[#8a979d]"> + {rest.length} {rest.length === 1 ? "item" : "itens"}</span>}
          </span>
          {order.hasPersonalization && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#946b28]" title="Tem personalização">
              <PenLine size={12} aria-hidden="true" /> Personalizado
            </span>
          )}
          {order.unread > 0 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-[#c4513b] px-2 py-0.5 text-[11px] font-semibold text-white">
              <MessageCircleMore size={12} aria-hidden="true" />{order.unread}<span className="sr-only"> {order.unread === 1 ? "mensagem nova" : "mensagens novas"}</span>
            </span>
          )}
        </span>
        {hint && (
          <span className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${hint.tone === "critical" ? "text-[#b4452f]" : hint.tone === "warning" ? "text-[#8a6212]" : "text-[#946b28]"}`}>
            <ArrowRight size={12} aria-hidden="true" /> {hint.label}
          </span>
        )}
      </a>
    </li>
  );
}

function QueueCount({ value, urgent, active }: { value: number; urgent: boolean; active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <LoaderCircle size={13} className="animate-spin text-[#8a979d]" aria-label="Carregando" />;
  return (
    <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ${urgent ? "bg-[#b88a3b] text-white" : active ? "bg-[#193244]/10 text-[#193244]" : "bg-[#193244]/6 text-[#74838a]"}`}>
      {value}
    </span>
  );
}

function PageLink({ href, label, trailing = false, children }: { href: string | null; label: string; trailing?: boolean; children: React.ReactNode }) {
  const className = "inline-flex min-h-10 items-center gap-1 rounded-full border border-[#193244]/15 px-3.5 font-semibold text-[#193244] transition hover:border-[#193244]/35";
  if (!href) return <span aria-disabled="true" className={`${className} opacity-35`}>{!trailing && children}{label}{trailing && children}</span>;
  return <Link href={href} className={className}>{!trailing && children}{label}{trailing && children}</Link>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-[#dfded6] bg-white px-1 font-sans text-[10px] text-[#56656c]">{children}</kbd>;
}
