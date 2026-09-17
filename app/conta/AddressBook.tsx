"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AddressFields from "../components/AddressFields";
import { addressSchema, emptyAddress, formatPostalCode, type AddressDraft, type SavedAddress } from "../../lib/addresses/schema";

const buttonClass = "rounded-full border border-[#0b2447]/20 px-4 py-2 text-xs font-semibold hover:border-[#b88a3b] disabled:opacity-50";
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

  async function mutate(payload: object, successMessage: string) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (response.status === 401) { router.push("/login?next=/conta"); return; }
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a alteração.");
      setAddresses(result.addresses); setEditing(null); setDeleting(null); setMessage(successMessage);
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
    void mutate({ action: "save", id: editing === "new" ? undefined : editing, address: parsed.data, makeDefault }, "Endereço salvo.");
  }
  return <section className="mt-12" aria-labelledby="addresses-title">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 id="addresses-title" className="font-serif text-3xl">Seus endereços</h2>
      {editing === null && <button type="button" className={buttonClass} onClick={() => startEditing()} disabled={busy || addresses.length >= 20}>Cadastrar endereço</button>}
    </div>
    <p className="mt-2 text-sm text-[#647087]">O endereço padrão será selecionado nas próximas compras. Você pode escolher outro na hora de comprar.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p>}
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
    {!addresses.length && editing === null && <p className="mt-6 rounded-3xl bg-white/65 p-6 text-sm text-[#647087]">Você ainda não tem endereços salvos. O primeiro endereço cadastrado será o padrão.</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {addresses.map(address => <article key={address.id} className="min-w-0 rounded-3xl border border-white bg-white/65 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="break-words font-semibold">{address.label || "Endereço de entrega"}</h3>
          {address.isDefault && <span className="rounded-full bg-[#d8bc7b]/30 px-3 py-1 text-xs font-semibold">Padrão</span>}
        </div>
        <p className="mt-3 break-words text-sm leading-6">{address.streetAddress}, {address.addressNumber}{address.addressComplement && ` · ${address.addressComplement}`}<br />{address.neighborhood} · {address.city}/{address.state}<br />CEP {formatPostalCode(address.postalCode)}</p>
        {deleting === address.id ? <div className="mt-4 space-y-3">
          <p className="text-sm">Excluir este endereço?{address.isDefault && addresses.length > 1 ? " O mais antigo restante será o padrão." : ""} Seus pedidos anteriores serão mantidos.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => void mutate({ action: "delete", id: address.id }, "Endereço excluído.")}>Confirmar exclusão</button><button type="button" className={buttonClass} disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div>
        </div> : <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={busy || editing !== null} onClick={() => startEditing(address)}>Editar</button>
          {!address.isDefault && <button type="button" className={buttonClass} disabled={busy || editing !== null} onClick={() => void mutate({ action: "default", id: address.id }, "Endereço padrão atualizado.")}>Tornar padrão</button>}
          <button type="button" className={buttonClass} disabled={busy || editing !== null} onClick={() => { setDeleting(address.id); setError(""); setMessage(""); }}>Excluir</button>
        </div>}
      </article>)}
    </div>
  </section>;
}
