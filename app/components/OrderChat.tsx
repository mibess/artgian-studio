"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { ORDER_MESSAGE_MAX_LENGTH, type OrderMessage, type OrderMessageThread } from "../../lib/order-message-types";
import { fulfillmentDate } from "../../lib/fulfillment-status";

function mergeMessages(current: OrderMessage[], incoming: OrderMessage[]) {
  const messages = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => messages.set(message.id, message));
  return [...messages.values()].sort((a, b) => a.id - b.id);
}

async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível carregar a conversa. Tente novamente.");
  return data;
}

export default function OrderChat({ initialThread, endpoint, viewer }: {
  initialThread: OrderMessageThread;
  endpoint: string;
  viewer: "customer" | "seller";
}) {
  const [messages, setMessages] = useState(initialThread.messages);
  const [hasMore, setHasMore] = useState(initialThread.hasMore);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [sent, setSent] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const acknowledged = useRef(0);
  const latestKnownId = useRef(initialThread.messages.at(-1)?.id ?? 0);
  const pending = useRef<{ body: string; clientId: string } | null>(null);
  const submitting = useRef(false);
  const lastMessageId = messages.at(-1)?.id;

  const acknowledge = useCallback(async (incoming: OrderMessage[], signal: AbortSignal) => {
    const throughId = incoming.filter(message => message.sender !== viewer && !message.readAt).at(-1)?.id;
    if (!throughId || throughId <= acknowledged.current || document.visibilityState !== "visible") return;
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", throughId }), signal,
    });
    if (response.ok) acknowledged.current = Math.max(acknowledged.current, throughId);
  }, [endpoint, viewer]);

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      try {
        const previousTail = latestKnownId.current;
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const data = await responseData<OrderMessageThread>(response);
        let incoming = data.messages;
        let oldestPage = data;
        // Returning to a hidden tab can reveal more than one page of replies.
        // Bridge that interval before merging so the middle remains accessible.
        while (previousTail > 0 && oldestPage.hasMore && oldestPage.messages[0]?.id > previousTail) {
          const olderResponse = await fetch(`${endpoint}?before=${oldestPage.messages[0].id}`, { cache: "no-store", signal: controller.signal });
          oldestPage = await responseData<OrderMessageThread>(olderResponse);
          incoming = mergeMessages(oldestPage.messages, incoming);
        }
        if (controller.signal.aborted) return;
        if (previousTail === 0) setHasMore(data.hasMore);
        latestKnownId.current = Math.max(latestKnownId.current, incoming.at(-1)?.id ?? 0);
        setMessages(current => mergeMessages(current, incoming));
        setConnectionError("");
        await acknowledge(incoming, controller.signal);
      } catch (cause) {
        if (!controller.signal.aborted) setConnectionError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "A conexão foi interrompida. Tentaremos novamente em alguns segundos.");
      } finally { refreshing = false; }
    }
    void refresh();
    const interval = window.setInterval(refresh, 5_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [endpoint, acknowledge]);

  useEffect(() => {
    if (logRef.current && followLatest.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lastMessageId]);

  async function loadOlder() {
    if (loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    setError("");
    const previousHeight = logRef.current?.scrollHeight ?? 0;
    const previousTop = logRef.current?.scrollTop ?? 0;
    try {
      const response = await fetch(`${endpoint}?before=${messages[0].id}`, { cache: "no-store" });
      const data = await responseData<OrderMessageThread>(response);
      setMessages(current => mergeMessages(current, data.messages));
      setHasMore(data.hasMore);
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = previousTop + logRef.current.scrollHeight - previousHeight;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as mensagens anteriores.");
    } finally { setLoadingOlder(false); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || body.length > ORDER_MESSAGE_MAX_LENGTH || submitting.current) return;
    submitting.current = true;
    setSending(true);
    setError("");
    setSent(false);
    // Preserve the ID after a failed response: retrying must not duplicate a message.
    if (pending.current?.body !== body) pending.current = { body, clientId: crypto.randomUUID() };
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.current),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await responseData<{ message: OrderMessage }>(response);
      followLatest.current = true;
      setMessages(current => mergeMessages(current, [data.message]));
      setDraft("");
      pending.current = null;
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error && !(cause instanceof TypeError) && cause.name !== "TimeoutError" ? cause.message : "Não foi possível enviar. Sua mensagem foi mantida; tente novamente.");
    } finally { setSending(false); submitting.current = false; }
  }

  return <section aria-label="Conversa sobre a compra" className="min-w-0 overflow-hidden rounded-[1.5rem] border border-[#0b2447]/10 bg-white text-[#0b2447] shadow-[0_8px_32px_rgba(11,36,71,.04)]">
    <header className="flex items-center gap-3 border-b border-[#0b2447]/10 px-5 py-4 sm:px-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#d8bc7b]/20 text-[#9a722e]"><MessageCircle size={20} /></span>
      <div className="min-w-0"><p className="break-words text-sm font-semibold">{viewer === "customer" ? "Atendimento Artgian" : initialThread.order.customerName}</p><p className="mt-1 text-xs leading-5 text-[#647087]">{viewer === "customer" ? "Envie sua dúvida. A resposta ficará salva aqui." : "Responda ao cliente sobre este item da compra."}</p></div>
    </header>
    {connectionError && <p role="status" className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">{connectionError} A conversa será atualizada automaticamente.</p>}
    <div ref={logRef} role="log" aria-label="Histórico da conversa" aria-live="polite" aria-relevant="additions" tabIndex={0}
      onScroll={() => { const log = logRef.current; if (log) followLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80; }}
      className="h-[min(52dvh,32rem)] min-h-64 overflow-y-auto overscroll-contain bg-[#faf8f4] px-4 py-5 focus-visible:outline-2 focus-visible:outline-[#b88a3b] sm:px-6">
      {hasMore && <div className="mb-5 text-center"><button type="button" onClick={loadOlder} disabled={loadingOlder} className="min-h-11 rounded-full border border-[#0b2447]/15 bg-white px-4 text-xs font-semibold disabled:opacity-50">{loadingOlder ? "Carregando…" : "Ver mensagens anteriores"}</button></div>}
      {!messages.length ? <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center text-center">
        <MessageCircle size={30} strokeWidth={1.3} className="text-[#b88a3b]" />
        <h3 className="mt-4 font-serif text-2xl">Vamos conversar?</h3>
        <p className="mt-2 text-sm leading-6 text-[#647087]">{viewer === "customer" ? "Pergunte sobre a personalização, o preparo ou a entrega deste produto." : "As mensagens sobre este produto aparecerão aqui."}</p>
      </div> : <ol className="space-y-4">{messages.map(message => {
        const own = message.sender === viewer;
        return <li key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${own ? "rounded-br-sm bg-[#0b2447] text-white" : "rounded-bl-sm border border-[#0b2447]/10 bg-white"}`}>
            <p className={`text-[0.65rem] font-semibold ${own ? "text-white/65" : "text-[#647087]"}`}>{own ? "Você" : message.sender === "seller" ? "Artgian · Vendedor" : initialThread.order.customerName}</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{message.body}</p>
            <div className={`mt-2 flex flex-wrap items-center justify-end gap-2 text-[0.6rem] ${own ? "text-white/65" : "text-[#647087]"}`}>
              <time dateTime={message.createdAt}>{fulfillmentDate(message.createdAt)}</time>
              {own && <span className="inline-flex items-center gap-1"><Check size={11} />{message.readAt ? "Lida" : "Enviada"}</span>}
            </div>
          </div>
        </li>;
      })}</ol>}
    </div>
    <form onSubmit={send} className="border-t border-[#0b2447]/10 p-4 sm:p-6">
      <label htmlFor="order-message" className="text-xs font-semibold">Sua mensagem</label>
      <textarea id="order-message" value={draft} onChange={event => { setDraft(event.target.value); setSent(false); }} disabled={sending} maxLength={ORDER_MESSAGE_MAX_LENGTH} rows={3}
        placeholder={viewer === "customer" ? "Olá! Gostaria de saber…" : "Escreva sua resposta…"}
        aria-describedby="order-message-help" required
        className="mt-2 block w-full resize-y rounded-2xl border border-[#0b2447]/20 bg-white px-4 py-3 text-base leading-6 placeholder:text-[#647087]/70 focus:border-[#b88a3b] focus:outline-none focus:ring-2 focus:ring-[#d8bc7b]/30 disabled:opacity-60 sm:text-sm" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p id="order-message-help" className="text-[0.65rem] text-[#647087]">{draft.length}/2.000 caracteres</p>
        <button type="submit" disabled={sending || !draft.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0b2447] px-5 py-3 text-xs font-semibold text-white hover:bg-[#19385e] disabled:cursor-not-allowed disabled:opacity-50">
          {sending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}{sending ? "Enviando…" : "Enviar mensagem"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{error}</p>}
      <p role="status" className="mt-2 text-xs text-emerald-800">{sent ? "Mensagem enviada." : ""}</p>
    </form>
  </section>;
}
