"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import AddressFields from "../components/AddressFields";
import { addressSchema, emptyAddress, formatPostalCode, type AddressDraft, type SavedAddress } from "../../lib/addresses/schema";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#647087] transition hover:bg-[#0b2447]/5 hover:text-[#0b2447] focus-visible:outline-[#b88a3b] disabled:opacity-50";
export default function AddressBook({ initialAddresses }: { initialAddresses: SavedAddress[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(emptyAddress);
  const [makeDefault, setMakeDefault] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(addresses.length / 4));
  const currentPage = Math.min(page, pageCount - 1);

  async function mutate(payload: { action: "save" | "default" | "delete"; id?: string; address?: unknown; makeDefault?: boolean }, successMessage: string) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (response.status === 401) { router.push("/login?next=%2Fconta%3Faba%3Denderecos"); return; }
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a alteração.");
      const nextAddresses: SavedAddress[] = result.addresses;
      const changedId = payload.action === "delete" ? undefined : payload.id ?? nextAddresses.find(address => !addresses.some(previous => previous.id === address.id))?.id;
      const changedIndex = nextAddresses.findIndex(address => address.id === changedId);
      if (changedIndex >= 0) setPage(Math.floor(changedIndex / 4));
      setAddresses(nextAddresses); setEditing(null); setDeleting(null); setMessage(successMessage);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar a alteração. Tente novamente."); }
    finally { setBusy(false); }
  }
  function startEditing(address?: SavedAddress) {
    setDraft(address ? { ...address } : { ...emptyAddress });
    setEditing(address?.id ?? "new"); setMakeDefault(address?.isDefault ?? !addresses.length);
    setDeleting(null); setError(""); setMessage("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = addressSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    void mutate({ action: "save", id: editing === "new" || editing === null ? undefined : editing, address: parsed.data, makeDefault }, "Endereço salvo.");
  }
  return <section aria-labelledby="addresses-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="addresses-title" className="font-serif text-3xl">Seus endereços</h2><p className="mt-1 text-sm leading-6 text-[#647087]">Seus lugares favoritos para receber nossas criações.</p></div>
      {editing === null && <button type="button" className={`${buttonClass} border border-[#b88a3b]/30 bg-white/60 !text-[#0b2447]`} onClick={() => startEditing()} disabled={busy || addresses.length >= 20}><Plus size={15} />Cadastrar endereço</button>}
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Check size={16} />{message}</p>}
    {editing !== null && <form onSubmit={submit} className="mt-6 rounded-3xl border border-white bg-white/70 p-5 sm:p-7">
      <h3 className="mb-5 font-serif text-2xl">{editing === "new" ? "Novo endereço" : "Editar endereço"}</h3>
      <fieldset disabled={busy} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-6"><AddressFields value={draft} onChange={setDraft} includeLabel /></div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="accent-[#0b2447]" checked={makeDefault} onChange={event => setMakeDefault(event.target.checked)} disabled={!addresses.length || addresses.some(address => address.id === editing && address.isDefault)} />
          Usar como endereço padrão
        </label>
        <div className="flex gap-3">
          <button className="rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50" type="submit">{busy ? "Salvando…" : "Salvar endereço"}</button>
          <button className={buttonClass} type="button" onClick={() => { setEditing(null); setError(""); }}>Cancelar</button>
        </div>
      </fieldset>
    </form>}
    {!addresses.length && editing === null && <div className="mt-5 rounded-[1.5rem] border border-dashed border-[#b88a3b]/30 bg-white/60 px-6 py-9 text-center"><MapPin size={28} strokeWidth={1.3} className="mx-auto text-[#b88a3b]" /><p className="mt-4 font-serif text-2xl">Onde vamos entregar?</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#647087]">Você ainda não tem endereços salvos. O primeiro endereço cadastrado será o padrão.</p></div>}
    {editing === null && <div className="mt-5 grid grid-cols-1 items-start gap-4">
      {addresses.slice(currentPage * 4, (currentPage + 1) * 4).map(address => <article key={address.id} className={`min-w-0 rounded-[1.5rem] border bg-white/80 p-5 ${address.isDefault ? "border-[#b88a3b]/40" : "border-white"}`}>
        <div className="flex items-center gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${address.isDefault ? "bg-[#d8bc7b]/20 text-[#9a722e]" : "bg-[#0b2447]/5 text-[#647087]"}`}><MapPin size={19} strokeWidth={1.5} /></span>
          <div className="min-w-0 flex-1"><h3 className="break-words font-serif text-xl">{address.label || "Endereço de entrega"}</h3>{address.isDefault && <p className="mt-0.5 text-[0.65rem] text-[#647087]">Selecionado nas próximas compras</p>}</div>
          {address.isDefault && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#d8bc7b]/20 px-2.5 py-1 text-[0.65rem] font-semibold text-[#846023]"><Check size={11} />Padrão</span>}
        </div>
        <p className="mt-4 break-words text-sm leading-6">{address.streetAddress}, {address.addressNumber}{address.addressComplement && ` · ${address.addressComplement}`}<br /><span className="text-xs text-[#647087]">{address.neighborhood} · {address.city}/{address.state}<br />CEP {formatPostalCode(address.postalCode)}</span></p>
        {deleting === address.id ? <div className="mt-4 space-y-3">
          <p className="text-sm">Excluir este endereço?{address.isDefault && addresses.length > 1 ? " O mais antigo restante será o padrão." : ""} Seus pedidos anteriores serão mantidos.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => void mutate({ action: "delete", id: address.id }, "Endereço excluído.")}>Confirmar exclusão</button><button type="button" className={buttonClass} disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div>
        </div> : <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-[#0b2447]/8 pt-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => startEditing(address)}><Pencil size={13} />Editar</button>
          {!address.isDefault && <button type="button" className={buttonClass} disabled={busy} onClick={() => void mutate({ action: "default", id: address.id }, "Endereço padrão atualizado.")}><Star size={13} />Tornar padrão</button>}
          <button type="button" className={`${buttonClass} ml-auto min-w-11 hover:!text-red-800`} disabled={busy} onClick={() => { setDeleting(address.id); setError(""); setMessage(""); }}><Trash2 size={13} /><span className="sr-only min-[420px]:not-sr-only">Excluir</span></button>
        </div>}
      </article>)}
    </div>}
    {editing === null && pageCount > 1 && <nav aria-label="Páginas dos endereços" className="mt-5 flex items-center justify-between gap-2 border-t border-[#0b2447]/10 pt-4">
      <button type="button" className={buttonClass} disabled={busy || currentPage === 0} onClick={() => { setPage(currentPage - 1); setDeleting(null); }}><ArrowLeft size={14} />Anteriores</button>
      <span className="text-xs text-[#647087]">{currentPage + 1} de {pageCount}</span>
      <button type="button" className={buttonClass} disabled={busy || currentPage === pageCount - 1} onClick={() => { setPage(currentPage + 1); setDeleting(null); }}>Próximos<ArrowRight size={14} /></button>
    </nav>}
    {addresses.length > 0 && editing === null && <p className="mt-4 text-xs leading-5 text-[#647087]">Você pode escolher outro endereço na hora de comprar.</p>}
  </section>;
}
