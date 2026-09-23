type MercadoPagoCardFormData = {
  token: string;
  paymentMethodId: string;
  issuerId: string;
  installments: string;
  identificationNumber: string;
};
type MercadoPagoCardForm = {
  unmount(): void;
  getCardFormData(): MercadoPagoCardFormData;
};
type MercadoPagoField = { id: string; placeholder?: string; style?: Record<string, string> };
interface Window {
  MP_DEVICE_SESSION_ID?: string;
  MercadoPago?: new (key: string, options: { locale: "pt-BR" }) => {
    cardForm(options: {
      amount: string;
      iframe: true;
      form: { id: string } & Record<string, string | MercadoPagoField>;
      callbacks: {
        onFormMounted(error?: unknown): void;
        onReady(): void;
        onSubmit(event: Event): void;
        onError(error: unknown): void;
        onFetching?(resource: string): (() => void) | void;
      };
    }): MercadoPagoCardForm;
  };
}
