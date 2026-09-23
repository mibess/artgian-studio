"use client";
import { useEffect, useRef } from "react";

export default function BankChallenge({ url, creq }: { url: string; creq: string }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.submit(); }, [url, creq]);
  return <div className="mt-6">
    <p className="mb-4 text-sm leading-6 text-[#647087]">Seu banco pediu uma confirmação. Siga as instruções abaixo; o pedido será atualizado automaticamente.</p>
    <iframe name="artgian-bank-challenge" title="Confirmação de pagamento pelo banco" className="h-[500px] w-full rounded-xl border border-[#0b2447]/15 bg-white" />
    <form ref={form} method="POST" action={url} target="artgian-bank-challenge" className="hidden"><input type="hidden" name="creq" value={creq} /></form>
  </div>;
}
