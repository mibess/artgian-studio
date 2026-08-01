export const colorNames: Record<string, string> = {
  areia: "Areia",
  preto: "Preto",
  branco: "Branco",
  rosa: "Rosa",
  terracota: "Terracota",
  "rosa-marfim": "Rosa & Marfim",
  "marrom-branco": "Marrom & Branco",
  "areia-branco": "Areia & Branco",
};

export const products = {
  "kit-dia-dos-pais": {
    name: "Kit Especial Dia dos Pais",
    href: "/dia-dos-pais",
    image: "/dia-dos-pais-capa-uhd.jpg",
    alt: "Kit de Dia dos Pais com suporte para lata, chaveiro, cartão e caixa presente",
    unitPriceCents: 3_990,
    shippingCents: 1_990,
    defaultColor: "Preto",
    customizable: false,
  },
  "bandeja-aurora": {
    name: "Bandeja Aurora",
    href: "/bandeja-aurora",
    image: "/bandeja-aurora-capa.png",
    alt: "Bandeja Aurora na cor areia",
    unitPriceCents: 2_990,
    shippingCents: 2_490,
    defaultColor: "Areia",
    customizable: false,
  },
  "organizador-arco": {
    name: "Organizador Arco",
    href: "/organizador-arco",
    image: "/organizador-arco-capa.png",
    alt: "Organizador Arco rosa com gavetas em marfim",
    unitPriceCents: 5_490,
    shippingCents: 2_990,
    defaultColor: "Rosa & Marfim",
    customizable: false,
  },
  "porta-palhetas-solo": {
    name: "Porta-Palhetas Solo",
    href: "/porta-palhetas-solo",
    image: "/porta-palhetas-solo-capa.png",
    alt: "Porta-Palhetas Solo terracota personalizado com o texto Seu Nome",
    unitPriceCents: 2_990,
    shippingCents: 1_990,
    defaultColor: "Terracota",
    customizable: true,
  },
  "suporte-pocket": {
    name: "Suporte Pocket",
    href: "/suporte-pocket",
    image: "/suporte-pocket-capa.png",
    alt: "Suporte Pocket preto nas posições aberta e fechada",
    unitPriceCents: 599,
    shippingCents: 1_690,
    defaultColor: "Preto",
    customizable: false,
  },
} as const;

export type ProductId = keyof typeof products;

export function isProductId(value: string): value is ProductId {
  return value in products;
}

export function getProductSelection(input: {
  productId?: string;
  color?: string;
  quantity?: number | string;
  personalization?: string;
}) {
  if (!input.productId || !isProductId(input.productId)) {
    return null;
  }

  const product = products[input.productId];
  const parsedQuantity = Number(input.quantity);
  const quantity = Math.min(
    9,
    Math.max(1, Number.isFinite(parsedQuantity) ? Math.trunc(parsedQuantity) : 1),
  );
  const colorKey = input.color?.trim() ?? "";
  const color = colorNames[colorKey] ?? product.defaultColor;
  const personalization = product.customizable
    ? input.personalization?.trim().slice(0, 18) || "Seu Nome"
    : null;
  const subtotalCents = product.unitPriceCents * quantity;

  return {
    productId: input.productId,
    product,
    quantity,
    color,
    colorKey,
    personalization,
    subtotalCents,
    shippingCents: product.shippingCents,
    totalCents: subtotalCents + product.shippingCents,
  };
}

export function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
