import PaymentResult from "../PaymentResult";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  return <PaymentResult orderId={pedido} returnState="success" />;
}
