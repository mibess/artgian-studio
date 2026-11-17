import { describe, expect, it } from "vitest";
import type { Product } from "../lib/catalog";
import {
  highlightParts,
  productPrice,
  searchProducts,
  searchSuggestions,
  sortProducts,
  storefrontProducts,
} from "../lib/product-listing";

function product(overrides: Partial<Product> & Pick<Product, "id" | "name">): Product {
  return {
    recordId: overrides.id,
    category: "",
    description: "",
    href: `/produtos/${overrides.id}`,
    image: "/x.png",
    alt: overrides.name,
    unitPriceCents: 1000,
    basePriceCents: 1000,
    priceFromCents: null,
    pricingType: "fixed",
    active: true,
    productionTime: null,
    variants: [],
    shippingPackage: null,
    customizable: false,
    personalization: { enabled: false, required: false, maxLength: 20, label: "Nome" },
    listed: true,
    featured: false,
    purchasable: true,
    presentation: {
      template: "standard",
      accent: "#000000",
      background: "#ffffff",
      copy: {},
      media: [],
      features: [],
      specifications: [],
      contactUrl: "",
      sections: [],
    },
    seoTitle: "",
    seoDescription: "",
    minimumQuantity: 1,
    maximumQuantity: 9,
    ...overrides,
  };
}

const variant = (key: string, name: string, priceCents: number | null = null) => ({
  key,
  name,
  swatches: ["#000000"],
  image: "/x.png",
  priceCents,
});

const bandeja = product({
  id: "bandeja",
  name: "Bandeja Aurora",
  category: "Casa",
  description: "Peça decorativa de linhas facetadas.",
  basePriceCents: 2990,
  featured: true,
  variants: [variant("areia", "Areia"), variant("preto", "Preto")],
});
const organizador = product({
  id: "organizador",
  name: "Organizador Arco",
  category: "Organização",
  basePriceCents: 5490,
  featured: true,
  variants: [variant("rosa", "Rosa & Marfim")],
});
const palhetas = product({
  id: "palhetas",
  name: "Porta-Palhetas Solo",
  category: "Música",
  basePriceCents: 2990,
  customizable: true,
  variants: [variant("preto", "Preto", 2990), variant("branco", "Branco", 3490)],
});
const suporte = product({ id: "suporte", name: "Suporte Pocket", category: "Mobilidade", basePriceCents: 599 });
const orcamento = product({
  id: "orcamento",
  name: "Miniatura personalizada",
  category: "Colecionáveis",
  pricingType: "quote",
  basePriceCents: null,
  purchasable: false,
});
const catalog = [suporte, palhetas, bandeja, organizador];

describe("busca de produtos", () => {
  it("ignora acentos, maiúsculas e plurais", () => {
    expect(searchProducts(catalog, "ORGANIZACAO").map((p) => p.id)).toEqual(["organizador"]);
    expect(searchProducts(catalog, "bandejas").map((p) => p.id)).toEqual(["bandeja"]);
    expect(searchProducts(catalog, "música").map((p) => p.id)).toEqual(["palhetas"]);
  });

  it("encontra por cor e por personalização, exigindo todas as palavras", () => {
    expect(searchProducts(catalog, "preto").map((p) => p.id).sort()).toEqual(["bandeja", "palhetas"]);
    expect(searchProducts(catalog, "personalizável").map((p) => p.id)).toEqual(["palhetas"]);
    expect(searchProducts(catalog, "bandeja preto").map((p) => p.id)).toEqual(["bandeja"]);
    expect(searchProducts(catalog, "bandeja rosa")).toEqual([]);
  });

  it("pontua todas as cores igualmente e desempata pelos destaques", () => {
    const pretoPrimeiro = product({ id: "preto-primeiro", name: "Peça A", variants: [variant("preto", "Preto")] });
    expect(searchProducts([pretoPrimeiro, bandeja], "pre").map((p) => p.id)).toEqual(["bandeja", "preto-primeiro"]);
  });

  it("prioriza o nome do produto sobre a descrição", () => {
    const decor = product({ id: "decor", name: "Vaso Decorativo", category: "Casa" });
    expect(searchProducts([bandeja, decor], "decorativ")[0].id).toBe("decor");
  });

  it("devolve o catálogo inteiro para busca vazia", () => {
    expect(searchProducts(catalog, "   ")).toEqual(catalog);
  });
});

describe("sugestões", () => {
  it("completa termos do catálogo a partir do que foi digitado", () => {
    expect(searchSuggestions(catalog, "pre")).toEqual([{ term: "Preto", kind: "Cor" }]);
    expect(searchSuggestions(catalog, "org").map((s) => s.term)).toEqual(["Organização", "Organizador Arco"]);
    expect(searchSuggestions(catalog, "pers")).toEqual([{ term: "Personalizáveis", kind: "Estilo" }]);
    expect(searchSuggestions(catalog, "")).toEqual([]);
  });

  it("marca o trecho digitado mesmo com acento no texto", () => {
    expect(highlightParts("Organização", "organiza")).toEqual([
      { text: "Organiza", match: true },
      { text: "ção", match: false },
    ]);
  });
});

describe("vitrine", () => {
  it("mostra destaques primeiro e esconde produtos fora da vitrine", () => {
    const hidden = product({ id: "oculto", name: "Oculto", listed: false });
    expect(storefrontProducts([suporte, hidden, bandeja]).map((p) => p.id)).toEqual(["bandeja", "suporte"]);
  });

  it("calcula o preço a partir da variante mais barata", () => {
    expect(productPrice(palhetas)).toMatchObject({ prefix: "A partir de", cents: 2990 });
    expect(productPrice(bandeja).prefix).toBeUndefined();
    expect(productPrice(orcamento)).toEqual({ value: "Sob orçamento", cents: null });
  });

  it("ordena por preço deixando peças sob orçamento por último", () => {
    const list = [orcamento, organizador, suporte, bandeja];
    expect(sortProducts(list, "menor-preco").map((p) => p.id)).toEqual(["suporte", "bandeja", "organizador", "orcamento"]);
    expect(sortProducts(list, "maior-preco").map((p) => p.id)).toEqual(["organizador", "bandeja", "suporte", "orcamento"]);
    expect(sortProducts(list, "destaques")).toBe(list);
  });
});
