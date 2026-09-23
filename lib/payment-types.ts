export type PaymentMethod = "card" | "pix" | "boleto";

// This allowlist is also the only provider data sent to the browser or stored in attempts.
export type PaymentDetails = {
  id: string;
  status: string;
  statusDetail: string;
  method: PaymentMethod;
  expiresAt?: string;
  pixCode?: string;
  pixImage?: string;
  boletoCode?: string;
  boletoUrl?: string;
  challenge?: { url: string; creq: string };
};

export type PaymentState = {
  orderId: string;
  orderStatus: string;
  totalCents: number;
  expiresAt: string | null;
  attemptId: string | null;
  attemptStatus: string | null;
  payment: PaymentDetails | null;
};

export type CardPaymentData = {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  identificationNumber: string;
};

export function canRetryPayment(status: string | null) {
  return status === null || ["failed", "rejected", "cancelled"].includes(status);
}

export function paymentFailureMessage(detail: string) {
  if (detail.includes("insufficient_amount")) return "O cartão não tem limite disponível para esta compra. Use outro cartão ou escolha Pix ou boleto.";
  if (detail.includes("bad_filled")) return "Confira os dados do cartão e tente novamente.";
  if (detail.includes("call_for_authorize")) return "O banco precisa autorizar esta compra. Entre em contato com ele ou escolha outro meio de pagamento.";
  if (detail.includes("duplicated_payment")) return "O Mercado Pago identificou uma tentativa duplicada. Confira seus pagamentos antes de tentar novamente.";
  if (detail.includes("pending_challenge")) return "Confirme a compra com seu banco para concluir o pagamento.";
  return "O pagamento não foi aprovado. Você pode tentar outro cartão ou escolher Pix ou boleto.";
}
