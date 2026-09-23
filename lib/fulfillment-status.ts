export const fulfillmentSteps = [
  { id: "preparing", label: "Em preparação", description: "Estamos preparando sua peça com cuidado, para que ela chegue até você do jeito que imaginou." },
  { id: "ready_to_ship", label: "Pronto para envio", description: "Seu pedido está pronto e aguardando o envio." },
  { id: "shipped", label: "Enviado", description: "Seu pedido foi enviado e está a caminho do endereço escolhido." },
  { id: "out_for_delivery", label: "Saiu para entrega", description: "Seu pedido está na etapa final da entrega. Fique de olho na chegada." },
  { id: "delivered", label: "Entregue", description: "Seu pedido foi entregue. Obrigado por deixar a Artgian fazer parte do seu dia." },
] as const;

export type FulfillmentStatus = typeof fulfillmentSteps[number]["id"];

export function fulfillmentStep(status: string) {
  return fulfillmentSteps.find(step => step.id === status) ?? fulfillmentSteps[0];
}

export function fulfillmentDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
  return new Date(normalized).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
