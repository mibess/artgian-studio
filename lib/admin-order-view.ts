// Shared by the admin orders page (server) and its interactive workspace (client).
import { fulfillmentSteps, type FulfillmentStatus } from "./fulfillment-status";

export const ORDER_QUEUES = [
  { id: "a-enviar", label: "A enviar", empty: "Nenhum pedido pago aguardando envio. Tudo em dia." },
  { id: "em-transito", label: "Em trânsito", empty: "Nenhum pedido a caminho do cliente agora." },
  { id: "entregues", label: "Entregues", empty: "Nenhum pedido entregue ainda." },
  { id: "aguardando-pagamento", label: "Aguardando pagamento", empty: "Nenhum checkout aguardando pagamento." },
  { id: "cancelados", label: "Cancelados", empty: "Nenhum pagamento recusado, cancelado ou estornado." },
  { id: "todos", label: "Todos", empty: "Nenhum pedido encontrado." },
] as const;

export type OrderQueue = typeof ORDER_QUEUES[number]["id"];
export type OrderQueueCounts = Record<OrderQueue, number>;

export function parseOrderQueue(value: unknown): OrderQueue {
  return ORDER_QUEUES.some(queue => queue.id === value) ? value as OrderQueue : "a-enviar";
}

const paymentStatuses: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Pago", tone: "positive" },
  pending: { label: "Aguardando pagamento", tone: "warning" },
  rejected: { label: "Pagamento recusado", tone: "critical" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  refunded: { label: "Estornado", tone: "neutral" },
  charged_back: { label: "Contestado", tone: "critical" },
};

export type Tone = "positive" | "warning" | "critical" | "neutral" | "info" | "progress";

export function paymentStatus(status: string) {
  return paymentStatuses[status] ?? { label: status, tone: "neutral" as Tone };
}

const stepTones: Record<FulfillmentStatus, Tone> = {
  preparing: "warning",
  ready_to_ship: "info",
  shipped: "progress",
  out_for_delivery: "progress",
  delivered: "positive",
};

/** One badge per order: delivery progress once paid, payment state otherwise. */
export function orderSituation(order: { status: string; fulfillment: { status: FulfillmentStatus } }) {
  if (order.status !== "paid") return paymentStatus(order.status);
  const step = fulfillmentSteps.find(item => item.id === order.fulfillment.status) ?? fulfillmentSteps[0];
  return { label: step.label, tone: stepTones[step.id] };
}

export type AdminOrderItem = {
  id: number;
  name: string;
  color: string;
  personalization: string | null;
  quantity: number;
  unitPriceCents: number;
  unread: number;
};

export type AdminOrderEvent = {
  id: string;
  status: FulfillmentStatus;
  note: string | null;
  trackingCode: string | null;
  createdAt: string;
  createdLabel: string;
};

export type AdminOrder = {
  id: string;
  shortId: string;
  status: string;
  createdAt: string;
  createdLabel: string;
  createdRelative: string;
  paymentExpiresLabel: string | null;
  paymentId: string | null;
  customer: {
    name: string;
    email: string;
    phoneLabel: string;
    phoneHref: string | null;
    whatsappHref: string | null;
    cpfMasked: string;
    hasCpf: boolean;
    hasFullName: boolean;
  };
  address: { street: string; complement: string | null; district: string; city: string; postalCode: string; copyText: string };
  items: AdminOrderItem[];
  itemCount: number;
  hasPersonalization: boolean;
  unread: number;
  totals: { subtotalCents: number; discountCents: number; couponCode: string | null; shippingCents: number; totalCents: number };
  shipping: { providerName: string; company: string | null; service: string | null; deliveryDays: number | null; sandbox: boolean; superFrete: boolean };
  label: { state: "unavailable" | "missing-cpf" | "to-buy" | "bought" | "ready"; canceled: boolean; url: string | null; error: string | null; canSync: boolean };
  fulfillment: { status: FulfillmentStatus; revision: number; note: string | null; trackingCode: string | null; updatedLabel: string | null };
  events: AdminOrderEvent[];
};

/** What the seller should do next, shown on list rows so the queue reads as a to-do list. */
export function nextStepHint(order: AdminOrder): { label: string; tone: Tone } | null {
  if (order.status !== "paid") return null;
  if (order.label.error) return { label: "Erro na etiqueta", tone: "critical" };
  const step = order.fulfillment.status;
  if (step === "preparing") return { label: "Produzir e embalar", tone: "neutral" };
  if (step === "ready_to_ship") {
    if (order.label.state === "missing-cpf") return { label: "Etiqueta manual", tone: "warning" };
    if (order.label.state === "to-buy") return { label: "Comprar etiqueta", tone: "neutral" };
    if (order.label.state === "bought") return { label: "Gerar etiqueta", tone: "neutral" };
    return { label: "Postar e informar rastreio", tone: "neutral" };
  }
  return null;
}
