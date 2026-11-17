import { formatBrl, type Product } from "./catalog";

// Shared by the header search (client) and the /produtos listing (server).

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Plural queries ("bandejas", "organizadores") still match singular names.
function tokenForms(token: string) {
  const forms = new Set([token]);
  if (token.length > 4 && token.endsWith("es")) forms.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith("s")) forms.add(token.slice(0, -1));
  return [...forms];
}

function queryTokens(query: string) {
  return normalizeSearch(query).split(" ").filter(Boolean);
}

function fieldScore(field: string, token: string, weight: number) {
  const forms = tokenForms(token);
  if (forms.some((form) => field.startsWith(form))) return weight * 2;
  if (forms.some((form) => field.includes(` ${form}`))) return weight * 1.5;
  if (forms.some((form) => field.includes(form))) return weight;
  return 0;
}

// Each colour is its own field, so "preto" scores the same whether it is the first or last variant.
function searchFields(product: Product): [string, number][] {
  return [
    [normalizeSearch(product.name), 50],
    [normalizeSearch(product.category), 30],
    ...product.variants.map((v): [string, number] => [normalizeSearch(v.name), 20]),
    [product.customizable ? "personalizavel personalizado personalizada nome" : "", 15],
    [normalizeSearch(product.description), 5],
  ];
}

/** Products matching every word of the query, best matches first. */
export function searchProducts(products: Product[], query: string) {
  const tokens = queryTokens(query);
  if (!tokens.length) return products;
  return products
    .map((product, order) => {
      const fields = searchFields(product);
      let score = 0;
      for (const token of tokens) {
        const best = Math.max(...fields.map(([field, weight]) => fieldScore(field, token, weight)));
        if (!best) return null;
        score += best;
      }
      return { product, score: score + (product.featured ? 1 : 0), order };
    })
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((match) => match.product);
}

export type SearchSuggestion = {
  term: string;
  kind: "Produto" | "Categoria" | "Cor" | "Estilo";
};

/** Pinterest-style completions: terms from the catalog that the query is building towards. */
export function searchSuggestions(products: Product[], query: string, limit = 6) {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const candidates = new Map<string, SearchSuggestion>();
  const add = (term: string, kind: SearchSuggestion["kind"]) => {
    const key = normalizeSearch(term);
    if (key && !candidates.has(key)) candidates.set(key, { term, kind });
  };
  for (const product of products) {
    add(product.category, "Categoria");
    add(product.name, "Produto");
    for (const variant of product.variants) add(variant.name, "Cor");
  }
  if (products.some((p) => p.customizable)) add("Personalizáveis", "Estilo");

  return [...candidates.entries()]
    .map(([key, suggestion]) => {
      const words = key.split(" ");
      // Every finished word must appear; the last one may still be half typed.
      const matches = tokens.every((token, index) => {
        const forms = tokenForms(token);
        return index === tokens.length - 1
          ? words.some((word) => forms.some((form) => word.startsWith(form)))
          : words.some((word) => forms.includes(word) || word.startsWith(token));
      });
      if (!matches) return null;
      const rank = key.startsWith(tokens.join(" ")) ? 0 : 1;
      return { suggestion, rank, key };
    })
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .sort((a, b) => a.rank - b.rank || a.key.length - b.key.length)
    .slice(0, limit)
    .map((match) => match.suggestion);
}

/** Ranges of `text` matched by the query, for bolding the typed part of a suggestion. */
export function highlightParts(text: string, query: string) {
  const tokens = queryTokens(query);
  const plain = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR");
  // NFD stripping keeps one character per letter for Portuguese text, so indexes line up.
  if (plain.length !== text.length || !tokens.length) return [{ text, match: false }];
  const marked = new Array<boolean>(text.length).fill(false);
  for (const form of tokens.flatMap(tokenForms)) {
    let from = 0;
    while (from < plain.length) {
      const at = plain.indexOf(form, from);
      if (at < 0) break;
      if (at === 0 || !/[a-z0-9]/.test(plain[at - 1])) marked.fill(true, at, at + form.length);
      from = at + form.length;
    }
  }
  const parts: { text: string; match: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) last.text += text[i];
    else parts.push({ text: text[i], match: marked[i] });
  }
  return parts;
}

export function productPrice(product: Product) {
  if (product.pricingType === "quote") return { value: "Sob orçamento", cents: null };
  if (product.pricingType === "from") {
    const cents = product.priceFromCents || 0;
    return { prefix: "A partir de", value: formatBrl(cents), cents };
  }
  const prices = product.variants.map((v) => v.priceCents ?? product.basePriceCents ?? 0);
  const cents = prices.length ? Math.min(...prices) : (product.basePriceCents ?? 0);
  return {
    prefix: new Set(prices).size > 1 ? "A partir de" : undefined,
    value: formatBrl(cents),
    cents,
  };
}

/** Featured pieces first, then the rest of the listed catalog. */
export function storefrontProducts(products: Product[]) {
  const listed = products.filter((p) => p.listed);
  return [...listed.filter((p) => p.featured), ...listed.filter((p) => !p.featured)];
}

export const productSorts = {
  destaques: "Destaques",
  "menor-preco": "Menor preço",
  "maior-preco": "Maior preço",
  "a-z": "Nome (A–Z)",
} as const;
export type ProductSort = keyof typeof productSorts;

export function sortProducts(products: Product[], sort: ProductSort) {
  if (sort === "destaques") return products;
  const priced = (p: Product) => productPrice(p).cents;
  return [...products].sort((a, b) => {
    if (sort === "a-z") return a.name.localeCompare(b.name, "pt-BR");
    // Quote-only pieces have no price, so they always come last.
    const pa = priced(a);
    const pb = priced(b);
    if (pa === null || pb === null) return pa === null ? (pb === null ? 0 : 1) : -1;
    return sort === "menor-preco" ? pa - pb : pb - pa;
  });
}
