"use client";
import { useState, useRef } from "react";
import type { ProductInput } from "../../../../lib/products/schema";
import type { Storefront } from "../../../../lib/catalog";
import { formatBrl } from "../../../../lib/catalog";
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
const tabs = ["Dados e venda", "Variantes", "Página e imagens", "Atendimento"];
function TextField({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-[#526873]">
      {label}
      {multiline ? (
        <textarea
          value={value}
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
}: {
  initialProducts: ProductInput[];
}) {
  const editorRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState(initialProducts);
  const [draft, setDraft] = useState<ProductInput | null>(null);
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  function edit(p: ProductInput) {
    setDraft(structuredClone(p));
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
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
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
      const saved = { ...draft, id: data.id, version: data.version };
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
                  · {p.active ? "Ativo" : "Arquivado"}
                </span>
                <span className="mt-1 block text-xs text-[#718088]">
                  {p.storefront?.listed
                    ? "Vitrine e atendimento"
                    : "Atendimento"}
                  {p.storefront?.purchasable ? " · Compra direta" : ""}
                </span>
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
            {s && draft.id && (
              <a
                target="_blank"
                rel="noreferrer"
                href={`/produtos/${s.slug}`}
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
                label="Descrição do produto"
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
                label="Prazo de produção confirmado"
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
                onChange={(v) => set("storefront", v ? blankStore() : null)}
              />
              {s && (
                <>
                  <TextField
                    label="Endereço do produto"
                    disabled={Boolean(
                      products.find((p) => p.id === draft.id)?.storefront,
                    )}
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
                    value={Boolean(s.shippingPackage)}
                    onChange={(v) =>
                      store({
                        shippingPackage: v
                          ? {
                              widthCm: 1,
                              heightCm: 1,
                              lengthCm: 1,
                              weightKg: 0.1,
                            }
                          : null,
                      })
                    }
                  />
                  {s.shippingPackage && (
                    <fieldset className="grid gap-4 sm:grid-cols-2">
                      <legend className="mb-3 text-sm font-bold">
                        Medidas da embalagem para frete
                      </legend>
                      {(
                        [
                          ["widthCm", "Largura (cm)"],
                          ["heightCm", "Altura (cm)"],
                          ["lengthCm", "Comprimento (cm)"],
                          ["weightKg", "Peso embalado (kg)"],
                        ] as const
                      ).map(([key, label]) => (
                        <TextField
                          key={key}
                          label={label}
                          value={s.shippingPackage![key]}
                          onChange={(v) =>
                            store({
                              shippingPackage: {
                                ...s.shippingPackage!,
                                [key]: Number(v.replace(",", ".")),
                              },
                            })
                          }
                        />
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
                      const reference = products.find(
                        (p) => p.storefront?.presentation.template === template,
                      )?.storefront;
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
                          products.find(
                            (p) => p.storefront?.presentation.template === t,
                          )?.name
                        }
                      </option>
                    ))}
                  </select>
                </label>
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
                <p className="text-xs text-[#718088]">
                  A primeira imagem é a capa. Use um caminho da loja ou uma URL
                  HTTPS. Nos estilos existentes, mantenha as posições das
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
                    Benefícios e especificações
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
