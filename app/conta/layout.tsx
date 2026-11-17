import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCustomerSession } from "../../lib/auth";
import AccountShell from "./AccountShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession(await headers());
  // As páginas mantêm seus guards para preservar o destino de retorno no login.
  return <AccountShell user={session?.user}>{children}</AccountShell>;
}
