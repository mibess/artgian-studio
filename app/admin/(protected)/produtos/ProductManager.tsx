"use client";
import { useState, useRef } from "react";
import type { ProductInput } from "../../../../lib/products/schema";
import type { ShippingPackage, Storefront } from "../../../../lib/catalog";
import { formatBrl } from "../../../../lib/catalog";
import { fulfillmentSummary } from "../../../../lib/product-fulfillment";
const blankStore = (): Storefront => ({
  slug: "",
  listed: false,
  featured: false,
  purchasable: false,
  variants: [
    {
      key: "padrao",
      name: "Padrão",
      swatches: ["#193244"],
      image: "",
      priceCents: null,
    },
  ],
  shippingPackage: null,
  fulfillment: null,
  personalization: {
    enabled: false,
    required: false,
    maxLength: 18,
    label: "Nome na peça",
  },
  presentation: {
    template: "standard",
    accent: "#b88a3b",
    background: "#f7f3ea",
    copy: {},
    media: [],
    features: [],
    specifications: [],
    contactUrl: "",
    sections: [],
  },
  seoTitle: "",
  seoDescription: "",
});
const blank = (): ProductInput => ({
  version: 0,
  name: "",
  category: "",
  description: "",
  active: true,
  pricingType: "quote",
  basePriceCents: null,
  priceFromCents: null,
  productionTime: "",
  minimumQuantity: 1,
  maximumQuantity: 9,
  aliases: [],
  materials: [],
  availableColors: [],
  availableSizes: [],
  customizationOptions: [],
  verifiedClaims: [],
  notes: "",
  storefront: null,
});
const input =
  "mt-1.5 w-full rounded-xl border border-[#dcded9] bg-white px-3 py-2.5 text-sm text-[#193244] outline-none focus:border-[#ee6e4f]";
const button =
  "rounded-xl bg-[#193244] px-4 py-3 text-xs font-bold text-white disabled:opacity-50";
const tabs = ["Dados e venda", "Variantes", "Página e imagens", "Ficha técnica", "Atendimento"];
const shippingFields = [
  { key: "lengthCm", label: "Comprimento (cm)", hint: "Lado mais longo da base da caixa." },
  { key: "widthCm", label: "Largura (cm)", hint: "Lado mais curto da base da caixa." },
  { key: "heightCm", label: "Altura (cm)", hint: "Da base até o topo da caixa." },
  { key: "weightKg", label: "Peso total (kg)", hint: "Pese o pacote com o produto, a caixa e a proteção." },
] as const;
const shippingNumberFormat = new Intl.NumberFormat("pt-BR", {
  useGrouping: false,
  maximumSignificantDigits: 21,
});

function TextField({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  disabled = false,
  maxLength,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block text-xs font-semibold text-[#526873]">
      {label}
      {multiline ? (
        <textarea
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={input}
          rows={3}
        />
      ) : (
        <input
          type={type}
          step={type === "number" ? "any" : undefined}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={`${input} ${type === "color" ? "h-12 p-1" : ""}`}
        />
      )}
    </label>
  );
}
function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function ProductManager({
  initialProducts,
  initialDraftIds,
}: {
  initialProducts: ProductInput[];
  initialDraftIds: string[];
}) {
  const editorRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState(initialProducts);
  const [draftIds, setDraftIds] = useState(() => new Set(initialDraftIds));
  const [draft, setDraft] = useState<ProductInput | null>(null);
  const [shippingEdits, setShippingEdits] = useState<
    Partial<Record<keyof ShippingPackage, string>>
  >({});
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  function referenceForTemplate(template: Storefront["presentation"]["template"]) {
    const examples = products.filter(p => p.storefront?.presentation.template === template);
    return examples.find(p => p.storefront?.slug === template) ?? examples[0];
  }
  function edit(p: ProductInput) {
    setDraft(structuredClone(p));
    setShippingEdits({});
    setTab(0);
    setMessage("");
    setError("");
    if (window.innerWidth < 1280)
      requestAnimationFrame(() =>
        editorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
  }
  function set<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  function store(next: Partial<Storefront>) {
    if (draft?.storefront) set("storefront", { ...draft.storefront, ...next });
  }
  function presentation(next: Partial<Storefront["presentation"]>) {
    if (draft?.storefront)
      store({ presentation: { ...draft.storefront.presentation, ...next } });
  }
  async function uploadImage(file: File) {
    setUploading(true); setError("");
    try {
      const response = await fetch("/api/admin/products/images", { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error_description || result.error || "Falha ao enviar imagem.");
      setDraft(d => {
        if (!d?.storefront) return d;
        const s = d.storefront;
        return { ...d, storefront: { ...s,
          variants: s.variants.map(v => v.image ? v : { ...v, image: result.url }),
          presentation: { ...s.presentation, media: [...s.presentation.media.filter(m => m.src), { src: result.url, alt: d.name }] },
        } };
      });
      setMessage("Imagem enviada. Salve o produto para aplicar.");
    } catch (error) { setError(error instanceof Error ? error.message : "Falha ao enviar imagem."); }
    finally { setUploading(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const storefront = draft.storefront ? { ...draft.storefront } : null;
      if (storefront?.technicalDetails) {
        const details = storefront.technicalDetails.map(({ label, value }) => ({
          label: label.trim(),
          value: value.trim(),
        }));
        if (details.some(({ label, value }) => !label || !value)) {
          setTab(3);
          throw new Error("Preencha a característica e o detalhe de cada item da ficha técnica.");
        }
        storefront.technicalDetails = details;
      }
      if (storefront?.shippingPackage) {
        const shippingPackage = { ...storefront.shippingPackage };
        for (const { key, label } of shippingFields) {
          const rawValue = shippingEdits[key];
          if (rawValue === undefined) continue;
          const text = rawValue.trim();
          const value = Number(text.replace(",", "."));
          if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text) || !Number.isFinite(value) || value <= 0) {
            setTab(0);
            throw new Error(
              `Informe um valor maior que zero no campo “${label}”. Use vírgula ou ponto para os decimais.`,
            );
          }
          shippingPackage[key] = value;
        }
        storefront.shippingPackage = shippingPackage;
      }
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          storefront,
          aliases: draft.aliases.filter((v) => v.trim()),
          materials: draft.materials.filter((v) => v.trim()),
          verifiedClaims: draft.verifiedClaims.filter((v) => v.trim()),
          availableColors: draft.availableColors.filter((v) => v.trim()),
          availableSizes: draft.availableSizes.filter((v) => v.trim()),
          customizationOptions: draft.customizationOptions.filter((v) =>
            v.trim(),
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      const saved = { ...draft, storefront, id: data.id, version: data.version };
      if (saved.active && draftIds.has(saved.id)) {
        setDraftIds(previous => {
          const remaining = new Set(previous);
          remaining.delete(saved.id);
          return remaining;
        });
      }
      setDraft(saved);
      setProducts((list) =>
        [...list.filter((p) => p.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  const s = draft?.storefront;
  const technicalDetails = s?.technicalDetails ?? [];
  const shippingPackage = s?.shippingPackage;
  const fulfillmentPreview = draft ? fulfillmentSummary({ fulfillment: s?.fulfillment, productionTime: draft.productionTime }) : null;
  const selectedProduct = draft?.id ? products.find(p => p.id === draft.id) : undefined;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <button onClick={() => edit(blank())} className={`${button} w-full`}>
          + Novo produto
        </button>
        <TextField label="Buscar produto" value={query} onChange={setQuery} />
        <div className="space-y-2">
          {products
            .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
            .map((p) => (
              <button
                key={p.id}
                onClick={() => edit(p)}
                className={`w-full rounded-2xl border p-4 text-left ${draft?.id === p.id ? "border-[#ee6e4f] bg-[#fff3ee]" : "border-[#e1e1db] bg-white"}`}
              >
                <strong className="block text-sm">{p.name}</strong>
                <span className="mt-2 block text-xs text-[#718088]">
                  {p.pricingType === "fixed"
                    ? formatBrl(p.basePriceCents || 0)
                    : p.pricingType === "from"
                      ? `A partir de ${formatBrl(p.priceFromCents || 0)}`
                      : "Sob orçamento"}{" "}
                  · {p.active ? "Ativo" : p.id && draftIds.has(p.id) ? "Rascunho" : "Arquivado"}
                </span>
                {p.active && <span className="mt-1 block text-xs text-[#718088]">
                  {p.storefront?.listed
                    ? "Vitrine e atendimento"
                    : "Atendimento"}
                  {p.storefront?.purchasable ? " · Compra direta" : ""}
                </span>}
              </button>
            ))}
        </div>
      </aside>
      {!draft ? (
        <div className="rounded-3xl border border-dashed border-[#dcded9] p-12 text-center text-sm text-[#718088]">
          Selecione um produto para editar ou crie um novo cadastro.
        </div>
      ) : (
        <form
          ref={editorRef}
          key={draft.id || "new"}
          onSubmit={save}
          className="min-w-0 rounded-3xl border border-[#e1e1db] bg-white p-5 sm:p-7"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {draft.id ? draft.name : "Novo produto"}
            </h2>
            {selectedProduct?.active && selectedProduct.storefront && (
              <a
                target="_blank"
                rel="noreferrer"
                href={`/produtos/${selectedProduct.storefront.slug}`}
                className="text-xs font-bold underline"
              >
                Ver página ↗
              </a>
            )}
          </div>
          <div
            role="tablist"
            aria-label="Cadastro do produto"
            className="mb-7 flex flex-wrap gap-2"
          >
            {tabs.map((name, i) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === i}
                onClick={() => setTab(i)}
                key={name}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${tab === i ? "bg-[#193244] text-white" : "bg-[#f3f1eb]"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {tab === 0 && (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Nome"
                  value={draft.name}
                  onChange={(v) => set("name", v)}
                />
                <TextField
                  label="Categoria"
                  value={draft.category}
                  onChange={(v) => set("category", v)}
                />
              </div>
              <TextField
                label="Descrição do produto (comercial)"
                multiline
                value={draft.description}
                onChange={(v) => set("description", v)}
              />
              <Check
                label="Produto ativo"
                value={draft.active}
                onChange={(v) => set("active", v)}
              />
              <p className="text-xs text-[#718088]">
                Arquivar interrompe novas ofertas e compras. Os pedidos
                anteriores são preservados.
              </p>
              <label className="block text-xs font-semibold">
                Tipo de preço
                <select
                  className={input}
                  value={draft.pricingType}
                  onChange={(e) =>
                    set(
                      "pricingType",
                      e.target.value as ProductInput["pricingType"],
                    )
                  }
                >
                  <option value="fixed">Preço fixo</option>
                  <option value="from">A partir de</option>
                  <option value="quote">Sob orçamento</option>
                </select>
              </label>
              {draft.pricingType !== "quote" && (
                <TextField
                  type="number"
                  label={
                    draft.pricingType === "fixed"
                      ? "Preço (R$)"
                      : "Preço inicial (R$)"
                  }
                  value={
                    (draft.pricingType === "fixed"
                      ? draft.basePriceCents
                      : draft.priceFromCents) === null
                      ? ""
                      : ((draft.pricingType === "fixed"
                          ? draft.basePriceCents
                          : draft.priceFromCents) || 0) / 100
                  }
                  onChange={(v) =>
                    set(
                      draft.pricingType === "fixed"
                        ? "basePriceCents"
                        : "priceFromCents",
                      v === ""
                        ? null
                        : Math.round(Number(v.replace(",", ".")) * 100),
                    )
                  }
                />
              )}
              <TextField
                label="Observação de produção (cadastros anteriores)"
                value={draft.productionTime}
                onChange={(v) => set("productionTime", v)}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  type="number"
                  label="Quantidade mínima"
                  value={draft.minimumQuantity}
                  onChange={(v) => set("minimumQuantity", Number(v))}
                />
                <TextField
                  type="number"
                  label="Quantidade máxima por item"
                  value={draft.maximumQuantity}
                  onChange={(v) => set("maximumQuantity", Number(v))}
                />
              </div>
              <Check
                label="Criar página na loja"
                value={Boolean(s)}
                onChange={(v) => {
                  setShippingEdits({});
                  set("storefront", v ? blankStore() : null);
                }}
              />
              {s && (
                <>
                  <fieldset className="space-y-4 rounded-2xl border border-[#dcded9] bg-[#f7f5ee] p-4">
                    <legend className="px-1 text-sm font-semibold text-[#193244]">Disponibilidade e prazo para envio</legend>
                    <label className="block text-xs font-semibold text-[#526873]">
                      Disponibilidade
                      <select
                        className={input}
                        value={s.fulfillment ? (s.fulfillment.readyToShip ? "ready" : "order") : "unknown"}
                        onChange={(event) => store({ fulfillment: event.target.value === "unknown" ? null : {
                          readyToShip: event.target.value === "ready",
                          preparationDays: s.fulfillment?.preparationDays ?? Number.NaN,
                        } })}
                      >
                        <option value="unknown">Não informado</option>
                        <option value="ready">Pronta entrega</option>
                        <option value="order">Sob encomenda</option>
                      </select>
                    </label>
                    {s.fulfillment && (
                      <label className="block text-xs font-semibold text-[#526873]">
                        Prazo para envio (dias úteis)
                        <input
                          className={input}
                          type="number"
                          min={s.fulfillment.readyToShip ? 0 : 1}
                          max={365}
                          step={1}
                          required
                          value={Number.isFinite(s.fulfillment.preparationDays) ? s.fulfillment.preparationDays : ""}
                          onChange={(event) => store({ fulfillment: {
                            ...s.fulfillment!,
                            preparationDays: event.target.value === "" ? Number.NaN : Number(event.target.value),
                          } })}
                          aria-describedby="fulfillment-help"
                        />
                      </label>
                    )}
                    <p id="fulfillment-help" className="text-xs leading-5 text-[#526873]">
                      Informe o prazo máximo entre a confirmação do pagamento e a postagem, incluindo preparo e embalagem. O transporte será somado conforme o CEP. Pronta entrega significa que a peça já está produzida; confirme que isso vale para todas as opções e quantidades oferecidas.
                    </p>
                    {s.fulfillment && Number.isInteger(s.fulfillment.preparationDays) && s.fulfillment.preparationDays >= (s.fulfillment.readyToShip ? 0 : 1) && s.fulfillment.preparationDays <= 365 && (
                      <p className="rounded-xl bg-white p-3 text-sm text-[#193244]">
                        <span className="block text-xs text-[#526873]">Como aparece na loja</span>
                        <strong>{fulfillmentPreview?.label}</strong>
                        {" · "}{fulfillmentPreview?.detail}
                        <span className="mt-1 block text-xs text-[#526873]">O prazo de transporte depende do CEP.</span>
                      </p>
                    )}
                    {!s.fulfillment && <p className="text-xs leading-5 text-[#526873]">Sem um prazo confirmado, a loja orienta o cliente a consultar o preparo. Nenhum número de dias será preenchido automaticamente.</p>}
                  </fieldset>
                  <TextField
                    label="Endereço do produto"
                    disabled={Boolean(selectedProduct?.storefront)}
                    value={s.slug}
                    onChange={(v) => store({ slug: v })}
                  />
                  <Check
                    label="Exibir na vitrine"
                    value={s.listed}
                    onChange={(v) => store({ listed: v })}
                  />
                  <Check
                    label="Destacar na página inicial"
                    value={s.featured}
                    onChange={(v) => store({ featured: v })}
                  />
                  <Check
                    label="Permitir compra direta"
                    value={s.purchasable}
                    onChange={(v) => store({ purchasable: v })}
                  />
                  <Check
                    label="Embalagem de envio cadastrada"
                    value={Boolean(shippingPackage)}
                    onChange={(v) => {
                      setShippingEdits({});
                      store({
                        shippingPackage: v
                          ? {
                              widthCm: 1,
                              heightCm: 1,
                              lengthCm: 1,
                              weightKg: 0.1,
                            }
                          : null,
                      });
                    }}
                  />
                  {shippingPackage && (
                    <fieldset className="grid gap-4 sm:grid-cols-2">
                      <legend className="mb-3 text-sm font-bold">
                        Medidas da embalagem para frete
                      </legend>
                      <p id="shipping-package-help" className="text-xs leading-5 text-[#526873] sm:col-span-2">
                        Meça por fora da caixa fechada, na posição de envio. Use vírgula ou ponto para os decimais, como 12,5 cm ou 0.35 kg.
                      </p>
                      {shippingFields.map(({ key, label, hint }) => (
                        <div key={key}>
                          <label htmlFor={key} className="block text-xs font-semibold text-[#526873]">
                            {label}
                          </label>
                          <input
                            id={key}
                            type="text"
                            inputMode="decimal"
                            className={input}
                            value={shippingEdits[key] ?? shippingNumberFormat.format(shippingPackage[key])}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setShippingEdits((previous) => ({ ...previous, [key]: value }));
                            }}
                            aria-describedby={`${key}-hint shipping-package-help`}
                          />
                          <p id={`${key}-hint`} className="mt-1.5 text-xs text-[#526873]">{hint}</p>
                        </div>
                      ))}
                    </fieldset>
                  )}
                </>
              )}
            </div>
          )}
          {tab === 1 &&
            (!s ? (
              <p className="text-sm">
                Ative a página na loja em Dados e venda para cadastrar variantes
                e personalização.
              </p>
            ) : (
              <div className="space-y-6">
                {s.variants.map((v, i) => (
                  <fieldset
                    key={i}
                    className="space-y-4 rounded-2xl bg-[#f7f5ef] p-4"
                  >
                    <legend className="text-sm font-bold">Opção {i + 1}</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(["key", "name", "image"] as const).map((key) => (
                        <TextField
                          key={key}
                          label={
                            {
                              key: "Identificador da opção",
                              name: "Nome da opção",
                              image: "Imagem da opção (URL)",
                            }[key]
                          }
                          value={v[key]}
                          onChange={(value) =>
                            store({
                              variants: s.variants.map((a, j) =>
                                j === i ? { ...a, [key]: value } : a,
                              ),
                            })
                          }
                        />
                      ))}
                      <TextField
                        type="number"
                        label="Preço da opção (R$, vazio usa o preço do produto)"
                        value={v.priceCents === null ? "" : v.priceCents / 100}
                        onChange={(value) =>
                          store({
                            variants: s.variants.map((a, j) =>
                              j === i
                                ? {
                                    ...a,
                                    priceCents:
                                      value === ""
                                        ? null
                                        : Math.round(
                                            Number(value.replace(",", ".")) *
                                              100,
                                          ),
                                  }
                                : a,
                            ),
                          })
                        }
                      />
                      <TextField
                        label="Cores da amostra (hexadecimal, separadas por vírgula)"
                        value={v.swatches.join(", ")}
                        onChange={(value) =>
                          store({
                            variants: s.variants.map((a, j) =>
                              j === i
                                ? {
                                    ...a,
                                    swatches: value
                                      .split(",")
                                      .map((c) => c.trim()),
                                  }
                                : a,
                            ),
                          })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-700"
                      onClick={() =>
                        store({
                          variants: s.variants.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Remover opção
                    </button>
                  </fieldset>
                ))}
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    store({
                      variants: [
                        ...s.variants,
                        {
                          key: "",
                          name: "",
                          image: "",
                          swatches: ["#193244"],
                          priceCents: null,
                        },
                      ],
                    })
                  }
                >
                  Adicionar opção
                </button>
                <Check
                  label="Permitir texto personalizado"
                  value={s.personalization.enabled}
                  onChange={(enabled) =>
                    store({
                      personalization: {
                        ...s.personalization,
                        enabled,
                        required: enabled ? s.personalization.required : false,
                      },
                    })
                  }
                />
                {s.personalization.enabled && (
                  <>
                    <TextField
                      label="Nome do campo de personalização"
                      value={s.personalization.label}
                      onChange={(label) =>
                        store({
                          personalization: { ...s.personalization, label },
                        })
                      }
                    />
                    <TextField
                      label="Limite de caracteres"
                      type="number"
                      value={s.personalization.maxLength}
                      onChange={(max) =>
                        store({
                          personalization: {
                            ...s.personalization,
                            maxLength: Number(max),
                          },
                        })
                      }
                    />
                    <Check
                      label="Personalização obrigatória"
                      value={s.personalization.required}
                      onChange={(required) =>
                        store({
                          personalization: { ...s.personalization, required },
                        })
                      }
                    />
                  </>
                )}
              </div>
            ))}
          {tab === 2 &&
            (!s ? (
              <p className="text-sm">
                Ative a página na loja em Dados e venda.
              </p>
            ) : (
              <div className="space-y-6">
                <label className="block text-xs font-semibold">
                  Modelo da página
                  <select
                    className={input}
                    value={s.presentation.template}
                    onChange={(e) => {
                      const template = e.target
                        .value as Storefront["presentation"]["template"];
                      const reference = referenceForTemplate(template)?.storefront;
                      presentation(
                        template === "standard"
                          ? { template }
                          : {
                              ...structuredClone(reference!.presentation),
                              template,
                            },
                      );
                    }}
                  >
                    <option value="standard">Padrão personalizável</option>
                    {Array.from(
                      new Set(
                        products
                          .map((p) => p.storefront?.presentation.template)
                          .filter(
                            (t): t is Storefront["presentation"]["template"] =>
                              Boolean(t) && t !== "standard",
                          ),
                      ),
                    ).map((t) => (
                      <option key={t} value={t}>
                        Estilo{" "}
                        {
                          referenceForTemplate(t)?.name
                        }
                      </option>
                    ))}
                  </select>
                </label>
                {s.presentation.template === "porta-palhetas-solo" && (
                  <Check
                    label="Molduras quadradas para a capa e a foto de ambiente"
                    value={s.presentation.imageAspect === "square"}
                    onChange={checked => presentation({ imageAspect: checked ? "square" : undefined })}
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    type="color"
                    label="Cor de destaque"
                    value={s.presentation.accent}
                    onChange={(accent) => presentation({ accent })}
                  />
                  <TextField
                    type="color"
                    label="Cor de fundo"
                    value={s.presentation.background}
                    onChange={(background) => presentation({ background })}
                  />
                </div>
                <TextField
                  label="Título para busca e compartilhamento"
                  value={s.seoTitle}
                  onChange={(seoTitle) => store({ seoTitle })}
                />
                <TextField
                  multiline
                  label="Descrição para busca e compartilhamento"
                  value={s.seoDescription}
                  onChange={(seoDescription) => store({ seoDescription })}
                />
                <TextField
                  label="Link de atendimento / orçamento (HTTPS)"
                  value={s.presentation.contactUrl}
                  onChange={(contactUrl) => presentation({ contactUrl })}
                />
                <h3 className="font-bold">Imagens da página</h3>
                <label className="block rounded-xl border border-[#dcded9] p-4 text-sm">
                  Enviar imagem do produto (obrigatória para cadastrar)
                  <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || busy} className="mt-3 block w-full"
                    onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void uploadImage(file); e.currentTarget.value = ""; }} />
                  <span className="mt-2 block text-xs">{uploading ? "Enviando imagem…" : "PNG, JPEG ou WebP estático, até 2 MB. A imagem fica salva na loja."}</span>
                </label>
                <p className="text-xs text-[#718088]">
                  A primeira imagem é a capa. Use um caminho da loja ou uma URL
                  de imagem já enviada. Nos estilos existentes, mantenha as posições das
                  imagens.
                </p>
                {s.presentation.media.map((m, i) => (
                  <div
                    key={i}
                    className="grid gap-3 rounded-2xl bg-[#f7f5ef] p-4 sm:grid-cols-2"
                  >
                    <TextField
                      label={`Imagem ${i + 1} (URL)`}
                      value={m.src}
                      onChange={(src) =>
                        presentation({
                          media: s.presentation.media.map((a, j) =>
                            j === i ? { ...a, src } : a,
                          ),
                        })
                      }
                    />
                    <TextField
                      label={`Descrição da imagem ${i + 1}`}
                      value={m.alt}
                      onChange={(alt) =>
                        presentation({
                          media: s.presentation.media.map((a, j) =>
                            j === i ? { ...a, alt } : a,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="text-left text-xs text-red-700"
                      onClick={() =>
                        presentation({
                          media: s.presentation.media.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Remover imagem
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    presentation({
                      media: [...s.presentation.media, { src: "", alt: "" }],
                    })
                  }
                >
                  Adicionar imagem
                </button>
                <details>
                  <summary className="cursor-pointer font-bold">
                    Textos do modelo
                  </summary>
                  <div className="mt-4 space-y-4">
                    {Object.entries(s.presentation.copy).map(([key, c]) => (
                      <TextField
                        key={key}
                        label={c.label}
                        multiline
                        value={c.value}
                        onChange={(value) =>
                          presentation({
                            copy: {
                              ...s.presentation.copy,
                              [key]: { ...c, value },
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                </details>
                <details>
                  <summary className="cursor-pointer font-bold">
                    Benefícios e especificações do modelo
                  </summary>
                  <div className="mt-4 space-y-4">
                    {s.presentation.features.map((f, i) => (
                      <div
                        key={i}
                        className="space-y-3 rounded-xl bg-[#f7f5ef] p-4"
                      >
                        {f.map((v, k) => (
                          <TextField
                            key={k}
                            label={
                              [
                                "Número",
                                "Título do benefício",
                                "Descrição do benefício",
                              ][k]
                            }
                            value={v}
                            onChange={(value) =>
                              presentation({
                                features: s.presentation.features.map((a, j) =>
                                  j === i
                                    ? a.map((x, n) => (n === k ? value : x))
                                    : a,
                                ),
                              })
                            }
                          />
                        ))}
                        <button
                          type="button"
                          className="text-xs text-red-700"
                          onClick={() =>
                            presentation({
                              features: s.presentation.features.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          Remover benefício
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={button}
                      onClick={() =>
                        presentation({
                          features: [
                            ...s.presentation.features,
                            [
                              String(s.presentation.features.length + 1),
                              "",
                              "",
                            ],
                          ],
                        })
                      }
                    >
                      Adicionar benefício
                    </button>
                    {s.presentation.specifications.map(([name, value], i) => (
                      <div key={i} className="grid gap-3 sm:grid-cols-2">
                        <TextField
                          label="Especificação da peça"
                          value={name}
                          onChange={(v) =>
                            presentation({
                              specifications: s.presentation.specifications.map(
                                (a, j) => (j === i ? [v, a[1]] : a),
                              ),
                            })
                          }
                        />
                        <TextField
                          label="Medida ou detalhe"
                          value={value}
                          onChange={(v) =>
                            presentation({
                              specifications: s.presentation.specifications.map(
                                (a, j) => (j === i ? [a[0], v] : a),
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          className="text-left text-xs text-red-700"
                          onClick={() =>
                            presentation({
                              specifications:
                                s.presentation.specifications.filter(
                                  (_, j) => j !== i,
                                ),
                            })
                          }
                        >
                          Remover especificação
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={button}
                      onClick={() =>
                        presentation({
                          specifications: [
                            ...s.presentation.specifications,
                            ["", ""],
                          ],
                        })
                      }
                    >
                      Adicionar especificação
                    </button>
                  </div>
                </details>
                <h3 className="font-bold">Seções adicionais</h3>
                {s.presentation.sections.map((section, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-xl bg-[#f7f5ef] p-4"
                  >
                    {(["title", "text", "image"] as const).map((key) => (
                      <TextField
                        key={key}
                        multiline={key === "text"}
                        label={
                          {
                            title: "Título da seção",
                            text: "Texto da seção",
                            image: "Imagem da seção (URL)",
                          }[key]
                        }
                        value={section[key]}
                        onChange={(value) =>
                          presentation({
                            sections: s.presentation.sections.map((a, j) =>
                              j === i ? { ...a, [key]: value } : a,
                            ),
                          })
                        }
                      />
                    ))}
                    <div className="flex gap-4">
                      <button
                        type="button"
                        disabled={i === 0}
                        className="text-xs disabled:opacity-30"
                        onClick={() => {
                          const a = [...s.presentation.sections];
                          [a[i - 1], a[i]] = [a[i], a[i - 1]];
                          presentation({ sections: a });
                        }}
                      >
                        Mover para cima
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-700"
                        onClick={() =>
                          presentation({
                            sections: s.presentation.sections.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        Remover seção
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    presentation({
                      sections: [
                        ...s.presentation.sections,
                        { title: "", text: "", image: "" },
                      ],
                    })
                  }
                >
                  Adicionar seção
                </button>
              </div>
            ))}
          {tab === 3 && (
            s ? (
              <div className="space-y-5">
                <p className="text-sm leading-6 text-[#526873]">
                  Cadastre medidas, materiais, conteúdo da embalagem e cuidados.
                  Essas informações aparecem no card Ficha técnica ao final da página do produto.
                </p>
                {technicalDetails.map((detail, index) => (
                  <fieldset
                    key={index}
                    aria-label={`Informação técnica ${index + 1}`}
                    className="space-y-3 rounded-xl bg-[#f7f5ef] p-4"
                  >
                    <TextField
                      label="Característica"
                      value={detail.label}
                      maxLength={100}
                      onChange={(label) => store({
                        technicalDetails: technicalDetails.map((item, i) =>
                          i === index ? { ...item, label } : item,
                        ),
                      })}
                    />
                    <TextField
                      label="Valor ou detalhe"
                      value={detail.value}
                      multiline
                      maxLength={2000}
                      onChange={(value) => store({
                        technicalDetails: technicalDetails.map((item, i) =>
                          i === index ? { ...item, value } : item,
                        ),
                      })}
                    />
                    <button
                      type="button"
                      className="text-xs text-red-700"
                      onClick={() => store({
                        technicalDetails: technicalDetails.filter((_, i) => i !== index),
                      })}
                    >
                      Remover informação técnica
                    </button>
                  </fieldset>
                ))}
                <button
                  type="button"
                  className={button}
                  disabled={technicalDetails.length >= 30}
                  onClick={() => store({
                    technicalDetails: [...technicalDetails, { label: "", value: "" }],
                  })}
                >
                  Adicionar informação técnica
                </button>
              </div>
            ) : (
              <p className="text-sm">Ative a página na loja em Dados e venda.</p>
            )
          )}
          {tab === 4 && (
            <div className="space-y-5">
              {(
                [
                  ["aliases", "Outros nomes usados pelos clientes"],
                  ["materials", "Materiais confirmados"],
                  ["availableColors", "Cores para projetos sob orçamento"],
                  ["availableSizes", "Tamanhos disponíveis"],
                  [
                    "customizationOptions",
                    "Possibilidades de projetos sob orçamento",
                  ],
                  [
                    "verifiedClaims",
                    "Características confirmadas para o atendimento",
                  ],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  multiline
                  label={`${label} (um por linha)`}
                  value={draft[key].join("\n")}
                  onChange={(v) => set(key, v.split("\n"))}
                />
              ))}
              <TextField
                multiline
                label="Observações internas"
                value={draft.notes}
                onChange={(v) => set("notes", v)}
              />
              <p className="text-xs leading-6 text-[#718088]">
                A IA consulta preço, variantes, materiais, personalização e
                fatos confirmados deste cadastro. Frete depende do CEP; prazos
                ou possibilidades não confirmados continuam sujeitos à avaliação
                humana.
              </p>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              {message}
            </p>
          )}
          <div className="mt-8 border-t border-[#e1e1db] pt-5">
            <button
              disabled={busy}
              type="submit"
              className="rounded-xl bg-[#ee6e4f] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Salvando…" : "Salvar produto"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
