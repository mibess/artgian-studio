"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Package } from "lucide-react";

const tabs = [
  { id: "pedidos", label: "Pedidos", icon: Package },
  { id: "enderecos", label: "Endereços", icon: MapPin },
] as const;

export default function AccountTabs({ orders, addresses, orderCount, addressCount }: {
  orders: ReactNode;
  addresses: ReactNode;
  orderCount: number;
  addressCount: number;
}) {
  const searchParams = useSearchParams();
  const active = searchParams.get("aba") === "enderecos" ? "enderecos" : "pedidos";
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(id: typeof active) {
    const query = new URLSearchParams(searchParams.toString());
    if (id === "pedidos") query.delete("aba");
    else query.set("aba", id);
    window.history.replaceState(null, "", `/conta${query.size ? `?${query}` : ""}`);
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = 1 - index;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 1;
    else return;
    event.preventDefault();
    select(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return <div className="mt-7 sm:mt-9">
    <div role="tablist" aria-label="Minha conta" className="flex w-full gap-1.5 rounded-2xl border border-[#0b2447]/8 bg-[#ebe6da]/60 p-1.5 sm:w-fit">
      {tabs.map(({ id, label, icon: Icon }, index) => <button
        key={id} ref={element => { buttons.current[index] = element; }}
        type="button" role="tab" id={`account-tab-${id}`} aria-selected={active === id}
        aria-controls={`account-panel-${id}`} tabIndex={active === id ? 0 : -1}
        onClick={() => select(id)} onKeyDown={event => navigate(event, index)}
        className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b] sm:flex-none sm:px-6 ${active === id ? "bg-[#0b2447] font-semibold text-white shadow-sm" : "font-medium text-[#647087] hover:bg-white/60 hover:text-[#0b2447]"}`}
      ><Icon size={17} aria-hidden="true" /><span>{label}</span><span aria-label={`${id === "pedidos" ? orderCount : addressCount} ${label.toLocaleLowerCase("pt-BR")}`} className={`ml-1 rounded-md px-1.5 py-0.5 text-[0.65rem] tabular-nums ${active === id ? "bg-white/15 text-[#e6c785]" : "bg-[#0b2447]/5"}`}>{id === "pedidos" ? orderCount : addressCount}</span></button>)}
    </div>
    <div id="account-panel-pedidos" role="tabpanel" aria-labelledby="account-tab-pedidos" hidden={active !== "pedidos"} tabIndex={0} className="mt-7 focus-visible:outline-[#b88a3b]">{orders}</div>
    <div id="account-panel-enderecos" role="tabpanel" aria-labelledby="account-tab-enderecos" hidden={active !== "enderecos"} tabIndex={0} className="mt-7 focus-visible:outline-[#b88a3b]">{addresses}</div>
  </div>;
}
