"use client";

import Link, { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";

function NavigationLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className="inline-flex items-center gap-1.5" aria-live="polite">
    {pending && <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />}
    {pending ? "Carregando…" : children}
  </span>;
}

export function PaginationLink({ children, ...props }: {
  children: React.ReactNode;
  href: string;
  scroll: boolean;
  className: string;
}) {
  return <Link {...props} prefetch={false}><NavigationLabel>{children}</NavigationLabel></Link>;
}
