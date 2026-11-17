// Custom (made-to-order) requests are quoted over WhatsApp. This module only
// composes the message: nothing typed in the form is sent to the store's server.

export const WHATSAPP_URL = "https://wa.me/5516997432741";

export const customPieceTypes = [
  { value: "presente", label: "Presente com nome ou frase" },
  { value: "festa", label: "Lembrancinhas e datas especiais" },
  { value: "miniatura", label: "Miniatura ou colecionável" },
  { value: "negocio", label: "Peça para o meu negócio" },
  { value: "outra", label: "Outra ideia" },
] as const;
export type CustomPieceType = (typeof customPieceTypes)[number]["value"];

// From config/business.json "customizationOptions"; quantity has its own field.
export const customizationChoices = ["Texto ou nome", "Cores", "Tamanho", "Modelo ou formato"] as const;

export const CUSTOM_IDEA_MAX = 1000;

export function isCustomPieceType(value: string): value is CustomPieceType {
  return customPieceTypes.some((type) => type.value === value);
}

export type CustomOrder = {
  type: CustomPieceType | "";
  idea: string;
  customizations: string[];
  quantity: number;
  /** ISO date (yyyy-mm-dd) from a date input, or empty. */
  neededBy: string;
  name: string;
};

function formatDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

export function customOrderMessage(order: CustomOrder) {
  const type = customPieceTypes.find((t) => t.value === order.type)?.label;
  const date = formatDate(order.neededBy);
  const name = order.name.trim();
  // null marks a field left blank; the empty string is the intended blank line.
  const lines = [
    "Olá, Artgian! Quero um orçamento para uma peça personalizada.",
    "",
    type ? `• Tipo: ${type}` : null,
    `• Ideia: ${order.idea.trim().slice(0, CUSTOM_IDEA_MAX)}`,
    order.customizations.length ? `• Personalizar: ${order.customizations.join(", ")}` : null,
    order.quantity > 1 ? `• Quantidade: ${order.quantity}` : null,
    date ? `• Preciso para: ${date}` : null,
    name ? `• Meu nome: ${name}` : null,
  ];
  return lines.filter((line) => line !== null).join("\n");
}

export function whatsappHref(message: string) {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}
