"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { ArrowRight, Barcode, Check, CheckCircle2, Clock3, Copy, CreditCard, LockKeyhole, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { canRetryPayment, paymentFailureMessage, type CardPaymentData, type PaymentMethod, type PaymentState } from "../../../lib/payment-types";
import { formatBrl } from "../../../lib/catalog";
import ClearPurchasedCart from "../ClearPurchasedCart";
import CardForm from "./CardForm";
import BankChallenge from "./BankChallenge";

const methods = [
  { id: "card", label: "Cartão", caption: "À vista ou parcelado", icon: CreditCard },
  { id: "pix", label: "Pix", caption: "Prático e rápido", icon: QrCode },
  { id: "boleto", label: "Boleto", caption: "Pague no seu banco", icon: Barcode },
] as const;
const buttonClass = "mt-7 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#0b2447] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#173b68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:opacity-60";

function CopyCode({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return <div className="mt-6">
    <label className="block text-xs font-semibold" htmlFor="payment-code">{label}</label>
    <textarea id="payment-code" readOnly value={code} onFocus={event => event.currentTarget.select()} rows={3} className="mt-2 w-full resize-none break-all rounded-xl border border-[#0b2447]/15 bg-[#f7f3ea] p-3 font-mono text-xs leading-5 outline-none focus:border-[#b88a3b]" />
    <button type="button" className={`${buttonClass} mt-3`} onClick={async () => {
      try { await navigator.clipboard.writeText(code); setCopied(true); setError(false); }
      catch { setError(true); }
    }}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Código copiado" : `Copiar ${label.toLowerCase()}`}</button>
    <p role="status" className="mt-2 text-center text-xs text-[#647087]">{error ? "Selecione o código acima e copie manualmente." : copied ? "Agora é só colar no aplicativo do seu banco." : ""}</p>
  </div>;
}

function paymentDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PaymentPanel({ initialState, publicKey, payer }: {
  initialState: PaymentState; publicKey: string;
  payer: { name: string; email: string; document: string };
}) {
  const [state, setState] = useState(initialState);
  const [method, setMethod] = useState<PaymentMethod>(initialState.payment?.method ?? "card");
  const [busy, setBusy] = useState(false);
  const [tokenizing, setTokenizing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const sending = useRef(false);
  const lastSubmission = useRef<Record<string, unknown> | null>(null);
  const endpoint = `/api/checkout/${state.orderId}/payment`;
  const payment = state.payment;
  const canPay = state.orderStatus === "pending" && canRetryPayment(state.attemptStatus) && !uncertain;
  const closed = ["cancelled", "setup_failed"].includes(state.orderStatus);
  const expired = Boolean(now && state.expiresAt && Date.parse(state.expiresAt) <= now && canPay);
  const pending = state.orderStatus === "pending" && !canRetryPayment(state.attemptStatus);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async (showError = false) => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setState(result);
      if (result.attemptId) setUncertain(false);
      if (showError) setError("");
    } catch (error) { if (showError) setError(error instanceof Error ? error.message : "Não foi possível atualizar. Tente novamente."); }
  }, [endpoint]);
  useEffect(() => {
    if (!pending && !uncertain) return;
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 10_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [pending, uncertain, refresh]);

  async function send(body: Record<string, unknown>) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    lastSubmission.current = body;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status >= 500) setUncertain(true);
        throw new Error(result.error || "Não foi possível concluir o pagamento.");
      }
      setState(result); setUncertain(false); lastSubmission.current = null;
    } catch (error) {
      if (error instanceof TypeError || error instanceof SyntaxError) setUncertain(true);
      setError(error instanceof TypeError || error instanceof SyntaxError ? "A conexão foi interrompida. Verifique o pagamento antes de tentar novamente." : error instanceof Error ? error.message : "Não foi possível concluir o pagamento.");
    } finally { sending.current = false; setBusy(false); }
  }

  async function submit(card?: CardPaymentData) {
    if (!canPay || expired || sending.current) return;
    await send({ requestId: crypto.randomUUID(), method, ...(card ? { card } : {}), ...(window.MP_DEVICE_SESSION_ID ? { deviceId: window.MP_DEVICE_SESSION_ID } : {}) });
  }

  const settled = ["paid", "refunded", "charged_back"].includes(state.orderStatus);
  return <section className="min-w-0 rounded-[2rem] border border-white bg-white/80 p-5 shadow-[0_20px_60px_rgba(11,36,71,.06)] sm:p-8 lg:p-10" aria-labelledby="payment-title">
    <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdkReady(true)} onError={() => setSdkFailed(true)} />
    {state.orderStatus === "paid" && <ClearPurchasedCart orderId={state.orderId} />}
    <div className="mb-7 flex items-start justify-between gap-3">
      <div>
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#b88a3b]">{settled ? "Seu pedido" : "Última etapa"}</p>
        <h2 id="payment-title" className="mt-2 font-serif text-3xl font-normal tracking-tight sm:text-4xl">{state.orderStatus === "paid" ? "Pagamento confirmado." : closed || expired ? "Revise seu pedido." : settled || pending || uncertain ? "Acompanhe seu pagamento." : "Como prefere pagar?"}</h2>
      </div>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f7f3ea] text-[#b88a3b]"><ShieldCheck size={23} aria-hidden="true" /></span>
    </div>

    {settled ? <div className="py-7 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#d8bc7b]/25 text-[#0b2447]"><CheckCircle2 size={32} /></span>
      <h3 className="mt-5 font-serif text-2xl">{state.orderStatus === "paid" ? "Tudo certo com a sua compra." : state.orderStatus === "refunded" ? "Pagamento estornado." : "Pagamento em contestação."}</h3>
      <p className="mt-3 text-sm leading-6 text-[#647087]">{state.orderStatus === "paid" ? "Seu pedido foi confirmado. Obrigado por escolher a Artgian Studio." : "O status deste pedido foi atualizado pelo Mercado Pago."}</p>
      {state.orderStatus === "paid" && <Link className={buttonClass} href={`/conta/pedidos/${state.orderId}`}>Acompanhar pedido <ArrowRight size={17} /></Link>}
      <Link className={state.orderStatus === "paid" ? "mt-5 inline-flex text-sm underline underline-offset-4" : buttonClass} href="/produtos">Continuar explorando</Link>
    </div> : <>
      {canPay && !expired && <>
        <div role="group" aria-label="Forma de pagamento" className="grid grid-cols-3 gap-2 sm:gap-3">
          {methods.map(({ id, label, caption, icon: Icon }) => <button type="button" key={id} aria-pressed={method === id} disabled={busy || tokenizing} onClick={() => { setMethod(id); setError(""); }} className={`relative flex min-h-24 flex-col items-center justify-center rounded-2xl border px-2 py-4 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:opacity-60 ${method === id ? "border-[#b88a3b] bg-[#f7f3ea] shadow-[inset_0_0_0_1px_#b88a3b]" : "border-[#0b2447]/15 bg-white hover:border-[#b88a3b]/60"}`}>
            {method === id && <span className="absolute top-2 right-2 grid size-4 place-items-center rounded-full bg-[#b88a3b] text-white"><Check size={10} /></span>}
            <Icon size={22} strokeWidth={1.5} aria-hidden="true" /><span className="mt-2 text-sm font-semibold">{label}</span><span className="mt-1 hidden text-[0.6rem] text-[#647087] sm:block">{caption}</span>
          </button>)}
        </div>
        {state.attemptStatus && canRetryPayment(state.attemptStatus) && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{state.attemptStatus === "failed" ? "Não foi possível iniciar a cobrança. Confira os dados e tente novamente ou escolha outro meio de pagamento." : paymentFailureMessage(payment?.statusDetail ?? "")}</p>}
        {method === "card" ? sdkFailed ? <p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar os campos do cartão. Recarregue a página ou escolha Pix ou boleto.</p> : <CardForm key={state.attemptId ?? "new"} publicKey={publicKey} sdkReady={sdkReady} totalCents={state.totalCents} payer={payer} busy={busy} onBusy={setTokenizing} onSubmit={submit} /> : <div className="mt-7">
          <h3 className="font-serif text-2xl">{method === "pix" ? "Pague com Pix." : "Seu boleto, sem complicação."}</h3>
          <p className="mt-3 text-sm leading-6 text-[#647087]">{method === "pix" ? "Gere o QR Code e escaneie com o aplicativo do seu banco. Se estiver no celular, use o Pix Copia e Cola." : "Gere o boleto e pague pelo aplicativo do seu banco ou em um local autorizado. A confirmação pode levar até 3 dias úteis."}</p>
          <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#f7f3ea] p-4 text-xs leading-5 text-[#647087]"><Clock3 size={17} className="mt-0.5 shrink-0 text-[#b88a3b]" />{method === "pix" ? "A validade aparece junto ao código Pix. Assim que o pagamento for confirmado, atualizaremos esta página." : "Confira o vencimento após gerar o boleto. Seu pedido será confirmado quando o pagamento for compensado."}</div>
          <button type="button" onClick={() => void submit()} disabled={busy} aria-busy={busy} className={buttonClass}>{busy ? <><span className="ui-spinner" /> Gerando pagamento…</> : <>{method === "pix" ? "Gerar Pix" : "Gerar boleto"} · {formatBrl(state.totalCents)} <ArrowRight size={17} /></>}</button>
        </div>}
      </>}

      {(expired || closed) && <div className="rounded-2xl bg-[#f7f3ea] p-6"><h3 className="font-serif text-2xl">Vamos revisar seu pedido?</h3><p className="mt-3 text-sm leading-6 text-[#647087]">{closed ? "Este pedido foi encerrado." : "O prazo para iniciar este pagamento terminou."} Volte ao checkout para confirmar os valores e a entrega.</p><Link className={buttonClass} href="/comprar">Revisar pedido <ArrowRight size={17} /></Link></div>}

      {(pending || uncertain) && <div>
        {payment?.challenge ? <BankChallenge key={payment.id} {...payment.challenge} /> : payment?.method === "pix" && payment.pixCode ? <>
          <h3 className="font-serif text-2xl">Seu Pix está pronto.</h3>
          <p className="mt-3 text-sm leading-6 text-[#647087]">Escaneie o QR Code ou copie o código para pagar no aplicativo do seu banco.</p>
          {payment.pixImage && <div className="mx-auto mt-6 w-fit rounded-2xl border border-[#0b2447]/10 bg-white p-4">{/* The image comes directly from the authenticated payment response. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${payment.pixImage}`} width={208} height={208} alt="QR Code Pix deste pedido" className="size-52 max-w-full" />
          </div>}
          <CopyCode code={payment.pixCode} label="Código Pix" />
        </> : payment?.method === "boleto" ? <>
          <span className="mb-4 inline-flex rounded-full bg-[#f7f3ea] p-4 text-[#b88a3b]"><Barcode size={30} /></span>
          <h3 className="font-serif text-2xl">Seu boleto foi gerado.</h3>
          <p className="mt-3 text-sm leading-6 text-[#647087]">Pague no aplicativo do seu banco usando o código abaixo. A confirmação pode levar até 3 dias úteis.</p>
          {payment.boletoCode && <CopyCode code={payment.boletoCode} label="Código de barras" />}
          {payment.boletoUrl && <a href={payment.boletoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm font-semibold underline underline-offset-4">Ver ou imprimir boleto</a>}
        </> : <div className="rounded-2xl bg-[#f7f3ea] p-6 text-center"><Clock3 className="mx-auto text-[#b88a3b]" size={30} /><h3 className="mt-4 font-serif text-2xl">Confirmando seu pagamento.</h3><p className="mt-3 text-sm leading-6 text-[#647087]">Estamos verificando a tentativa com o Mercado Pago. Aguarde a confirmação antes de fazer um novo pagamento.</p></div>}
        {payment?.expiresAt && <p className="mt-4 text-xs leading-5 text-[#647087]">{now && Date.parse(payment.expiresAt) <= now ? "O prazo deste código terminou. Estamos aguardando a atualização do pagamento." : `Válido até ${paymentDate(payment.expiresAt)} (horário de Brasília).`}</p>}
        <p role="status" className="mt-6 flex items-center gap-2 text-xs text-[#647087]"><span className="ui-spinner" /> Aguardando confirmação automática</p>
        <button type="button" disabled={busy} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4 disabled:opacity-60" onClick={() => {
          if (uncertain && lastSubmission.current) void send(lastSubmission.current);
          else if (state.attemptId && ["processing", "unknown"].includes(state.attemptStatus ?? "")) void send({ retryAttemptId: state.attemptId });
          else void refresh(true);
        }}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />{busy ? "Verificando…" : "Verificar pagamento"}</button>
      </div>}
    </>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</p>}
    <div className="mt-8 flex items-center justify-center gap-2 border-t border-[#0b2447]/10 pt-5 text-[0.65rem] text-[#647087]"><LockKeyhole size={13} aria-hidden="true" /> Pagamento seguro processado pelo Mercado Pago</div>
  </section>;
}
