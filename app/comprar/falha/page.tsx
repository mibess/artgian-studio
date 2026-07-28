import PaymentResult from "../PaymentResult";

export default async function FailurePage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  return <PaymentResult orderId={pedido} returnState="failure" />;
}
