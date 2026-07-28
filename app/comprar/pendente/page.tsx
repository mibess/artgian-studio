import PaymentResult from "../PaymentResult";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  return <PaymentResult orderId={pedido} returnState="pending" />;
}
