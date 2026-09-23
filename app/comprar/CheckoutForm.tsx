"use client";

import { FormEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Barcode, CreditCard, LockKeyhole, MapPin, Plus, QrCode, UserRound } from "lucide-react";
import { cartSelections, type CartItem } from "../../lib/cart";
import { formatCpf, formatPhone, hasFullName, isValidCpf } from "../../lib/brazil";
import { formatBrl } from "../../lib/catalog";
import type { ShippingOption } from "../../lib/shipping";
import ProductColorImage from "../components/ProductColorImage";

import AddressFields from "../components/AddressFields";
import { emptyAddress, formatPostalCode, type AddressDraft, type SavedAddress } from "../../lib/addresses/schema";

import { useProductCatalog } from "../../lib/products/context";

type CheckoutFormProps = {
  customer: { name: string; email: string; phone: string | null };
  addresses: SavedAddress[];
  items: CartItem[];
  fromCart?: boolean;
};

type QuoteResponse = {
  postalCode?: string;
  options?: ShippingOption[];
  error?: string;
};

function couponExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now();
}

function onlyPostalCodeDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export default function CheckoutForm({
  customer,
  addresses,
  items,
  fromCart = false,
}: CheckoutFormProps) {
  const router = useRouter();
  const catalog = useProductCatalog();
  const selections = cartSelections(items, catalog);
  const subtotalCents = selections.reduce(
    (sum, selection) => sum + selection.subtotalCents,
    0,
  );
  const quoteVersion = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const couponVersion = useRef(0);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{
    code: string;
    discountCents: number;
    subtotalCents: number;
    expiresAt: string | null;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [error, setError] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [customerName, setCustomerName] = useState(customer.name);
  const [customerPhone, setCustomerPhone] = useState(formatPhone(customer.phone || ""));
  const [savedContact, setSavedContact] = useState(customer.phone && hasFullName(customer.name) ? { name: customer.name, phone: formatPhone(customer.phone) } : null);
  const [editingContact, setEditingContact] = useState(!savedContact);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [documentError, setDocumentError] = useState("");
  const documentInput = useRef<HTMLInputElement>(null);
  const initialAddress = addresses.find(address => address.isDefault) ?? addresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState(initialAddress?.id ?? "");
  const [choosingAddress, setChoosingAddress] = useState(false);
  const [address, setAddress] = useState<AddressDraft>(initialAddress ?? { ...emptyAddress });
  const [saveNewAddress, setSaveNewAddress] = useState(addresses.length < 20);
  const postalCode = address.postalCode;
  const [quotedPostalCode, setQuotedPostalCode] = useState("");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");

  const selectedShipping = shippingOptions.find(
    (option) => option.serviceId === selectedServiceId,
  );
  const appliedCoupon = coupon?.subtotalCents === subtotalCents ? coupon : null;
  const totalCents =
    subtotalCents -
    (appliedCoupon?.discountCents ?? 0) +
    (selectedShipping?.priceCents ?? 0);

  const quoteItemsKey = JSON.stringify(items);
  const quoteAddress = useEffectEvent(() => { void calculateQuote(); });
  useEffect(() => {
    if (onlyPostalCodeDigits(postalCode).length !== 8) return;
    const timer = setTimeout(() => quoteAddress(), selectedAddressId ? 0 : 350);
    return () => {
      clearTimeout(timer);
      quoteVersion.current += 1;
    };
  }, [selectedAddressId, postalCode, quoteItemsKey]);

  async function applyCoupon() {
    const version = ++couponVersion.current;
    setApplyingCoupon(true);
    setCouponError("");
    setCoupon(null);
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, items }),
      });
      const result = await response.json();
      if (version !== couponVersion.current) return;
      if (!response.ok)
        throw new Error(result.error || "Não foi possível aplicar o cupom.");
      setCoupon(result);
      setCouponCode(result.code);
    } catch (error) {
      if (version === couponVersion.current)
        setCouponError(
          error instanceof Error
            ? error.message
            : "Não foi possível aplicar o cupom.",
        );
    } finally {
      if (version === couponVersion.current) setApplyingCoupon(false);
    }
  }

  function handlePostalCodeChange(value: string) {
    setShippingError("");
    setAddress(current => ({ ...current, postalCode: formatPostalCode(value) }));
    quoteVersion.current += 1;
    setQuoting(false);
    if (onlyPostalCodeDigits(value) !== quotedPostalCode) {
      setShippingOptions([]);
      setSelectedServiceId("");
    }
  }

  function selectAddress(id: string) {
    setChoosingAddress(false);
    if (id === selectedAddressId) return;
    const selected = addresses.find(address => address.id === id);
    setSelectedAddressId(id);
    setAddress(selected ?? { ...emptyAddress });
    quoteVersion.current += 1;
    setQuoting(false);
    setShippingOptions([]);
    setSelectedServiceId("");
    setQuotedPostalCode("");
    setShippingError("");
    setError("");
  }

  async function calculateQuote() {
    const normalizedPostalCode = onlyPostalCodeDigits(postalCode);
    if (normalizedPostalCode.length !== 8) {
      setShippingError("Informe um CEP válido para calcular a entrega.");
      return;
    }

    const version = ++quoteVersion.current;
    setQuoting(true);
    setShippingOptions([]);
    setSelectedServiceId("");
    setShippingError("");
    setError("");

    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          postalCode: normalizedPostalCode,
        }),
      });
      const result = (await response.json()) as QuoteResponse;

      if (version !== quoteVersion.current) return;
      if (!response.ok || !result.options?.length || !result.postalCode) {
        throw new Error(
          result.error || "Não encontramos entrega para esse CEP.",
        );
      }

      setShippingOptions(result.options);
      setQuotedPostalCode(result.postalCode);
      setSelectedServiceId(result.options[0].serviceId);
    } catch (quoteError) {
      if (version !== quoteVersion.current) return;
      setShippingOptions([]);
      setSelectedServiceId("");
      setShippingError(
        quoteError instanceof Error
          ? quoteError.message
          : "Não foi possível calcular a entrega.",
      );
    } finally {
      if (version === quoteVersion.current) setQuoting(false);
    }
  }

  function showDocumentError(message = "Informe um CPF válido com 11 dígitos.") {
    setDocumentError(message);
    documentInput.current?.focus({ preventScroll: true });
    documentInput.current?.scrollIntoView({ block: "center" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    if (!isValidCpf(customerDocument)) {
      showDocumentError();
      return;
    }
    setDocumentError("");
    if (editingContact && !(await saveContact())) return;

    if (
      !selectedShipping ||
      quotedPostalCode !== onlyPostalCodeDigits(postalCode)
    ) {
      setShippingError("Calcule e escolha uma modalidade de entrega.");
      return;
    }

    if (couponCode.trim() && !appliedCoupon) {
      setCouponError("Aplique o cupom ou limpe o código antes de pagar.");
      return;
    }
    if (
      appliedCoupon?.expiresAt &&
      couponExpired(appliedCoupon.expiresAt)
    ) {
      setCoupon(null);
      setCouponError(
        "Este cupom expirou. Remova o código ou informe outro cupom.",
      );
      return;
    }
    setSubmitting(true);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedSubtotalCents: subtotalCents,
          checkoutMode: "embedded",
          ...payload,
          customerName,
          customerPhone,
          postalCode: address.postalCode,
          streetAddress: address.streetAddress,
          addressNumber: address.addressNumber,
          addressComplement: address.addressComplement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          label: address.label,
          addressId: selectedAddressId || undefined,
          saveAddress: !selectedAddressId && saveNewAddress,
          couponCode: appliedCoupon?.code,
          items,
          shippingServiceId: selectedShipping.serviceId,
          shippingPriceCents: selectedShipping.priceCents,
        }),
      });
      const result = (await response.json()) as {
        paymentUrl?: string;
        orderId?: string;
        error?: string;
        code?: string;
        field?: string;
      };

      if (response.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (!response.ok && result.field === "customerDocument") {
        showDocumentError(result.error);
        setSubmitting(false);
        return;
      }

      if (!response.ok && result.code === "SHIPPING_REQUOTE_REQUIRED") {
        setShippingOptions([]);
        setSelectedServiceId("");
        setQuotedPostalCode("");
        setShippingError(result.error || "Calcule novamente a entrega antes de pagar.");
        setSubmitting(false);
        return;
      }
      if (response.status === 409 || response.status === 404) router.refresh();
      if (!response.ok || !result.paymentUrl) {
        throw new Error(
          result.error || "Não foi possível iniciar o pagamento.",
        );
      }

      if (fromCart && result.orderId) {
        try {
          sessionStorage.setItem(
            `artgian:checkout:${result.orderId}`,
            JSON.stringify(items),
          );
        } catch {
          /* Cart remains available when storage is blocked. */
        }
      }
      router.push(result.paymentUrl);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível iniciar o pagamento.",
      );
      setSubmitting(false);
    }
  }

  async function saveContact() {
    if (savingContact) return false;
    setSavingContact(true);
    setContactError("");
    try {
      const response = await fetch("/api/customer/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customerName, phone: customerPhone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar seus dados.");
      const contact = { name: result.contact.name as string, phone: formatPhone(result.contact.phone) };
      setSavedContact(contact);
      setCustomerName(contact.name);
      setCustomerPhone(contact.phone);
      setEditingContact(false);
      return true;
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "Não foi possível salvar seus dados. Tente novamente.");
      return false;
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.08fr_.72fr]">
      <form
        className="space-y-9 rounded-[2rem] border border-white bg-white/70 p-6 shadow-[0_20px_60px_rgba(11,36,71,.07)] sm:p-9"
        onSubmit={handleSubmit}
      >
        <p className="text-sm text-[#647087]">
          Comprando como{" "}
          <strong className="text-[#0b2447]">{customer.name}</strong>
        </p>
        <section>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#b88a3b] font-serif text-sm text-[#b88a3b]">
              1
            </span>
            <h2 className="font-serif text-2xl font-normal">Seus dados</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {!editingContact && <div role="group" aria-label="Dados de contato" className="flex items-start gap-3 rounded-2xl border border-[#b88a3b] bg-white/80 p-5 sm:col-span-2 sm:gap-4 sm:p-6">
              <UserRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#b88a3b]" />
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold leading-6 sm:text-base">{customerName}</p>
                <p className="mt-1 break-all text-xs leading-5 text-[#647087]">{customer.email}</p>
                <p className="text-xs leading-5 text-[#647087]">{customerPhone}</p>
                <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-[#0b2447] underline decoration-[#b88a3b]/60 underline-offset-4 hover:text-[#9a722e] disabled:opacity-50" disabled={submitting} onClick={() => setEditingContact(true)}>Alterar dados</button>
              </div>
            </div>}
            {editingContact && <><label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold">
                Nome completo
              </span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="customerName"
                value={customerName}
                onChange={event => setCustomerName(event.target.value)}
                disabled={savingContact || submitting}
                autoComplete="name"
                minLength={3}
                pattern=".*\S\s+\S.*"
                title="Informe nome e sobrenome."
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">E-mail</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                type="email"
                name="customerEmail"
                value={customer.email}
                autoComplete="email"
                readOnly
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold">Telefone</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                type="tel"
                name="customerPhone"
                autoComplete="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                maxLength={15}
                value={customerPhone}
                disabled={savingContact || submitting}
                onChange={(event) =>
                  setCustomerPhone(formatPhone(event.target.value))
                }
                required
              />
            </label>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <button type="button" className="min-h-11 rounded-full bg-[#0b2447] px-5 text-xs font-semibold text-white disabled:opacity-50" disabled={savingContact || submitting} onClick={() => void saveContact()}>{savingContact ? "Salvando…" : "Salvar dados"}</button>
              {savedContact && <button type="button" className="min-h-11 text-xs font-semibold" disabled={savingContact || submitting} onClick={() => { setCustomerName(savedContact.name); setCustomerPhone(savedContact.phone); setContactError(""); setEditingContact(false); }}>Cancelar alteração</button>}
            </div>
            <p className="text-xs leading-5 text-[#647087] sm:col-span-2">Seu telefone será salvo na conta para facilitar as próximas compras.</p>
            </>}
            {contactError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{contactError}</p>}
            <label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold">
                CPF para emissão da etiqueta
              </span>
              <input
                ref={documentInput}
                className={`h-12 w-full rounded-xl border bg-[#f7f3ea] px-4 outline-none transition focus:ring-2 ${documentError ? "border-red-500 focus:border-red-500 focus:ring-red-500/15" : "border-[#0b2447]/15 focus:border-[#b88a3b] focus:ring-[#b88a3b]/15"}`}
                name="customerDocument"
                aria-invalid={Boolean(documentError)}
                aria-describedby={`checkout-document-help${documentError ? " checkout-document-error" : ""}`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                maxLength={14}
                value={customerDocument}
                onChange={event => {
                  setCustomerDocument(formatCpf(event.target.value));
                  setDocumentError("");
                }}
                onBlur={() => {
                  if (customerDocument && !isValidCpf(customerDocument)) setDocumentError("Informe um CPF válido com 11 dígitos.");
                }}
                onInvalid={() => setDocumentError("Informe um CPF válido com 11 dígitos.")}
                required
              />
              {documentError && <span id="checkout-document-error" role="alert" className="mt-2 block text-xs font-medium text-red-700">{documentError}</span>}
              <span id="checkout-document-help" className="mt-2 block text-[0.7rem] leading-4 text-[#647087]">
                Usado somente no processamento do pedido e da entrega.
              </span>
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#b88a3b] font-serif text-sm text-[#b88a3b]">
              2
            </span>
            <h2 className="font-serif text-2xl font-normal">Entrega</h2>
          </div>
          {selectedAddressId && <div aria-label="Endereço de entrega" role="group" className="mt-5 flex items-start gap-3 rounded-2xl border border-[#b88a3b] bg-white/80 p-5 sm:gap-4 sm:p-6">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#b88a3b]" />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold leading-6 sm:text-base">{address.streetAddress}, {address.addressNumber}{address.addressComplement && ` · ${address.addressComplement}`}</p>
              <p className="mt-1 break-words text-xs leading-5 text-[#647087]">{address.neighborhood} · {address.city}/{address.state} · CEP {formatPostalCode(postalCode)}</p>
              <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-[#0b2447] underline decoration-[#b88a3b]/60 underline-offset-4 hover:text-[#9a722e] disabled:opacity-50" aria-expanded={choosingAddress} aria-controls="checkout-address-options" onClick={() => setChoosingAddress(!choosingAddress)} disabled={submitting}>Alterar endereço</button>
            </div>
          </div>}
          {!selectedAddressId && addresses.length > 0 && <button type="button" className="mt-5 min-h-11 text-sm font-semibold underline underline-offset-4" aria-expanded={choosingAddress} aria-controls="checkout-address-options" onClick={() => setChoosingAddress(!choosingAddress)} disabled={submitting}>Usar um endereço salvo</button>}
          {choosingAddress && <div id="checkout-address-options" className="mt-4 space-y-3 rounded-2xl border border-[#0b2447]/10 bg-white/60 p-4">
            <p className="text-sm font-semibold">Onde você quer receber?</p>
            {addresses.map(saved => <button key={saved.id} type="button" aria-pressed={selectedAddressId === saved.id} onClick={() => selectAddress(saved.id)} disabled={submitting} className={`block w-full rounded-xl border p-4 text-left transition disabled:opacity-50 ${selectedAddressId === saved.id ? "border-[#b88a3b] bg-[#d8bc7b]/10" : "border-[#0b2447]/15 hover:border-[#b88a3b]"}`}>
              <span className="block break-words text-sm font-semibold">{saved.label || saved.streetAddress}{saved.isDefault ? " · Padrão" : ""}</span>
              <span className="mt-1 block break-words text-xs leading-5 text-[#647087]">{saved.streetAddress}, {saved.addressNumber}{saved.addressComplement && ` · ${saved.addressComplement}`}<br />{saved.neighborhood} · {saved.city}/{saved.state} · CEP {formatPostalCode(saved.postalCode)}</span>
            </button>)}
            <button type="button" onClick={() => selectAddress("")} disabled={submitting} className="flex min-h-11 items-center gap-2 text-sm font-semibold disabled:opacity-50"><Plus aria-hidden="true" className="size-4" />Cadastrar novo endereço</button>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <Link className="py-2 underline underline-offset-4" href="/conta">Gerenciar meus endereços</Link>
              <button type="button" className="min-h-11 font-semibold" onClick={() => setChoosingAddress(false)}>Cancelar</button>
            </div>
          </div>}
          <div className="mt-5 grid gap-4 sm:grid-cols-6">
            {!selectedAddressId && <label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold">CEP</span>
              <input
                className="h-12 w-full rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] px-4 outline-none transition focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/15"
                name="postalCode"
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="00000-000"
                value={formatPostalCode(postalCode)}
                maxLength={9}
                pattern="[0-9]{5}-?[0-9]{3}"
                readOnly={Boolean(selectedAddressId)}
                onChange={(event) => handlePostalCodeChange(event.target.value)}
                required
              />
            </label>}
            {quoting ? <p role="status" className="sm:col-span-6 flex items-center gap-2 text-sm text-[#647087]">
              <span className="ui-spinner" aria-hidden="true" />
              Calculando entrega…
            </p> : shippingError ? <div className={`flex items-end ${selectedAddressId ? "sm:col-span-6" : "sm:col-span-4"}`}>
              <button
                className="flex h-12 items-center gap-2 rounded-full border border-[#0b2447]/20 px-5 text-xs font-semibold transition hover:border-[#b88a3b] disabled:opacity-60"
                type="button"
                onClick={calculateQuote}
                disabled={quoting || submitting}
                aria-busy={quoting}
              >
                Tentar calcular novamente
              </button>
            </div> : null}

            {shippingError && (
              <p
                className="sm:col-span-6 rounded-xl border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {shippingError}
              </p>
            )}

            {shippingOptions.length > 0 && (
              <fieldset className="sm:col-span-6 space-y-2">
                <legend className="mb-2 text-xs font-semibold">
                  Escolha a modalidade
                </legend>
                {shippingOptions.map((option) => (
                  <label
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition ${
                      selectedServiceId === option.serviceId
                        ? "border-[#b88a3b] bg-[#d8bc7b]/10"
                        : "border-[#0b2447]/10 bg-[#f7f3ea] hover:border-[#0b2447]/25"
                    }`}
                    key={option.serviceId}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        className="accent-[#0b2447]"
                        type="radio"
                        name="shippingOption"
                        value={option.serviceId}
                        checked={selectedServiceId === option.serviceId}
                        onChange={() => setSelectedServiceId(option.serviceId)}
                      />
                      <span>
                        <strong className="block text-sm">
                          {option.companyName} · {option.serviceName}
                        </strong>
                        <span className="mt-1 block text-xs text-[#647087]">
                          Até {option.deliveryTimeDays} dias úteis após a
                          postagem
                        </span>
                      </span>
                    </span>
                    <strong className="shrink-0 text-sm">
                      {option.priceCents === 0 ? "Grátis" : formatBrl(option.priceCents)}
                    </strong>
                  </label>
                ))}
              </fieldset>
            )}

            {!selectedAddressId && <AddressFields value={address} onChange={setAddress} includePostalCode={false} includeLabel={saveNewAddress} />}
            {!selectedAddressId && <label className="sm:col-span-6 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 accent-[#0b2447]" checked={saveNewAddress} disabled={addresses.length >= 20} onChange={event => setSaveNewAddress(event.target.checked)} />
              <span>Salvar este endereço na minha conta.{!addresses.length && <span className="mt-1 block text-xs text-[#647087]">Seu primeiro endereço salvo será o padrão.</span>}{addresses.length >= 20 && <span className="mt-1 block text-xs text-[#647087]">Você já tem 20 endereços salvos. Este será usado apenas neste pedido.</span>}</span>
            </label>}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#b88a3b] font-serif text-sm text-[#b88a3b]">
              3
            </span>
            <h2 className="font-serif text-2xl font-normal">Pagamento</h2>
          </div>
          <div className="mt-5 rounded-2xl border border-[#b88a3b]/25 bg-[#f7f3ea] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d8bc7b]/30">
                <LockKeyhole size={17} aria-hidden="true" />
              </span>
              <div>
                <strong className="text-sm">
                  Seu pagamento, aqui na Artgian
                </strong>
                <p className="mt-1 text-xs leading-5 text-[#647087]">
                  Na próxima etapa, escolha como prefere pagar. Tudo com a segurança do Mercado Pago.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#0b2447]/10 pt-4 text-xs font-semibold">
              <span className="inline-flex items-center gap-2"><CreditCard size={17} aria-hidden="true" /> Cartão</span>
              <span className="inline-flex items-center gap-2"><QrCode size={17} aria-hidden="true" /> Pix</span>
              <span className="inline-flex items-center gap-2"><Barcode size={17} aria-hidden="true" /> Boleto</span>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="coupon-title"
          className="rounded-2xl border border-[#b88a3b]/25 bg-[#f7f3ea] p-5"
        >
          <h2 id="coupon-title" className="font-serif text-2xl">
            Cupom de desconto
          </h2>
          <label
            className="mt-4 block text-xs font-semibold"
            htmlFor="coupon-code"
          >
            Código do cupom
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="coupon-code"
              autoComplete="off"
              maxLength={40}
              disabled={submitting}
              value={couponCode}
              placeholder="Digite seu cupom"
              className="h-12 min-w-0 flex-1 rounded-xl border border-[#0b2447]/20 bg-white px-4 text-sm uppercase"
              onChange={(event) => {
                couponVersion.current += 1;
                setApplyingCoupon(false);
                setCouponCode(event.target.value.toUpperCase());
                setCoupon(null);
                setCouponError("");
              }}
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={applyingCoupon || submitting || !couponCode.trim()}
              className="rounded-full bg-[#0b2447] px-5 text-xs font-bold text-white disabled:opacity-60"
            >
              {applyingCoupon ? "Aplicando…" : "Aplicar cupom"}
            </button>
            {couponCode && (
              <button
                type="button"
                disabled={submitting}
                className="text-xs font-semibold underline"
                onClick={() => {
                  couponVersion.current += 1;
                  setCouponCode("");
                  setCoupon(null);
                  setCouponError("");
                  setApplyingCoupon(false);
                }}
              >
                Remover cupom
              </button>
            )}
          </div>
          {appliedCoupon && (
            <p
              role="status"
              className="mt-3 break-words text-sm text-emerald-800"
            >
              Cupom {appliedCoupon.code} aplicado: −
              {formatBrl(appliedCoupon.discountCents)}.
            </p>
          )}
          {couponError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {couponError}
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-[#647087]">
            Um cupom por pedido. O desconto vale para os produtos; o frete
            permanece igual. A disponibilidade será confirmada ao iniciar o
            pagamento.
          </p>
        </section>

        <label className="flex items-start gap-3 text-xs leading-5 text-[#647087]">
          <input className="mt-1 accent-[#0b2447]" type="checkbox" required />
          Confirmo que os dados pessoais e de entrega estão corretos.
        </label>

        {error && (
          <p
            className="rounded-xl border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          className="flex h-14 w-full items-center justify-between rounded-full bg-[#0b2447] pr-2 pl-6 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#173b68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          type="submit"
          disabled={submitting || savingContact || applyingCoupon || !selectedShipping}
          aria-busy={submitting}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="ui-spinner" aria-hidden="true" />
              Preparando seu pagamento…
            </span>
          ) : selectedShipping ? (
            "Continuar para pagamento"
          ) : (
            "Calcule a entrega para continuar"
          )}
          <span className="grid size-10 place-items-center rounded-full bg-[#d8bc7b] text-xl text-[#0b2447]">
            →
          </span>
        </button>
      </form>

      <aside className="rounded-[2rem] bg-[#0b2447] p-5 text-white shadow-[0_24px_70px_rgba(11,36,71,.16)] lg:sticky lg:top-6">
        <div className="px-2 pt-3 pb-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#d8bc7b]">
            Resumo do pedido
          </span>
          <div className="mt-5 space-y-5">
            {selections.map((selection, index) => (
              <div key={index} className="flex items-start gap-4">
                <ProductColorImage
                  className="size-16 shrink-0 rounded-xl object-cover"
                  product={selection.productId}
                  src={selection.product.image}
                  alt={`${selection.product.name} — ${selection.color}`}
                  initialColor={selection.colorKey}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-xl font-normal">
                    {selection.product.name}
                  </h2>
                  <p className="mt-1 text-xs text-white/65">
                    Cor {selection.color} · Quantidade {selection.quantity}
                  </p>
                  {selection.personalization && (
                    <p className="mt-1 break-words text-xs text-[#d8bc7b]">
                      Personalização: “{selection.personalization}”
                    </p>
                  )}
                  <p className="mt-2 text-sm font-semibold">
                    {formatBrl(selection.subtotalCents)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <dl className="mt-7 space-y-3 border-y border-white/15 py-5 text-xs">
            <div className="flex justify-between">
              <dt className="text-white/55">Subtotal</dt>
              <dd>{formatBrl(subtotalCents)}</dd>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between gap-4 text-[#d8bc7b]">
                <dt className="min-w-0 break-all">
                  Desconto · {appliedCoupon.code}
                </dt>
                <dd className="shrink-0">
                  −{formatBrl(appliedCoupon.discountCents)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Entrega</dt>
              <dd className="text-right">
                {selectedShipping
                  ? selectedShipping.priceCents === 0 ? "Grátis" : formatBrl(selectedShipping.priceCents)
                  : "Calcule pelo CEP"}
              </dd>
            </div>
            {selectedShipping && (
              <div className="flex justify-between gap-4">
                <dt className="text-white/55">Modalidade</dt>
                <dd className="text-right">
                  {selectedShipping.companyName} ·{" "}
                  {selectedShipping.serviceName}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex items-end justify-between">
            <span className="text-xs text-white/55">Total</span>
            <strong className="font-serif text-3xl font-normal text-[#d8bc7b]">
              {selectedShipping ? formatBrl(totalCents) : "—"}
            </strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
