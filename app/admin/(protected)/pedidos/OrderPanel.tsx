"use client";

import Link from "next/link";
import { useActionState, useState, type Ref } from "react";
import {
  AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Clock3, ExternalLink, FileText, FlaskConical, Mail, MessageCircleMore, Phone, Printer, RefreshCw, Tag, X,
} from "lucide-react";
import { formatBrl } from "../../../../lib/catalog";
import { fulfillmentSteps, type FulfillmentStatus } from "../../../../lib/fulfillment-status";
import { orderSituation, paymentStatus, type AdminOrder } from "../../../../lib/admin-order-view";
import { saveFulfillment, updateShippingLabel, updateTestMark, type OrderActionState } from "./actions";
import { Badge, CopyButton, Feedback, Section } from "./ui";

type PanelProps = {
  order: AdminOrder;
  headingRef: Ref<HTMLHeadingElement>;
  position: string | null;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onOrderChange: (order: AdminOrder) => void;
};

const iconButton = "grid size-10 place-items-center rounded-xl text-[#415967] transition hover:bg-[#193244]/6 hover:text-[#193244] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#b88a3b] disabled:pointer-events-none disabled:opacity-30";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#193244] px-5 text-sm font-semibold text-white transition hover:bg-[#0f2433] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:cursor-wait disabled:opacity-70";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#193244]/15 bg-white px-4 text-sm font-semibold text-[#193244] transition hover:border-[#193244]/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] disabled:cursor-wait disabled:opacity-60";
const fieldClass = "mt-1.5 w-full rounded-xl border border-[#d9dbd5] bg-white px-3 text-sm font-normal text-[#193244] outline-none transition placeholder:text-[#9aa5aa] focus:border-[#b88a3b] focus:ring-2 focus:ring-[#b88a3b]/20";

export function OrderPanel({ order, headingRef, position, onClose, onPrev, onNext, onOrderChange }: PanelProps) {
  const situation = orderSituation(order);
  const payment = paymentStatus(order.status);
  const isPaid = order.status === "paid";
  const isTest = Boolean(order.testMarkedLabel);
  // Kept here so the confirmation survives the switch between the bottom button and the top banner.
  const [testState, testAction, testPending] = useActionState(async (previous: OrderActionState, formData: FormData) => {
    const result = await updateTestMark(previous, formData);
    if (result?.order) onOrderChange(result.order);
    document.getElementById(`pedido-${order.id}-titulo`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    return result;
  }, null);

  return (
    <article aria-labelledby={`pedido-${order.id}-titulo`} className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-[#e4e3dc] bg-[#f8f7f3]/95 px-3 py-2 backdrop-blur sm:px-4">
        <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-[#193244] hover:bg-[#193244]/6 xl:hidden">
          <ArrowLeft size={17} aria-hidden="true" /> Pedidos
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          {position && <span className="mr-1 text-xs tabular-nums text-[#8a979d]">{position}</span>}
          <button type="button" className={iconButton} onClick={onPrev ?? undefined} disabled={!onPrev} aria-label="Pedido anterior" title="Pedido anterior (K)"><ChevronUp size={18} /></button>
          <button type="button" className={iconButton} onClick={onNext ?? undefined} disabled={!onNext} aria-label="Próximo pedido" title="Próximo pedido (J)"><ChevronDown size={18} /></button>
          <button type="button" className={`${iconButton} hidden xl:grid`} onClick={onClose} aria-label="Fechar pedido" title="Fechar (Esc)"><X size={18} /></button>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <header className="px-1 pb-1 pt-2">
          <div className="flex flex-wrap items-center gap-x-1 text-xs text-[#74838a]">
            <span className="font-mono font-semibold text-[#56656c]">#{order.shortId}</span>
            <CopyButton text={order.id} label="Copiar ID" className="min-h-7" />
          </div>
          <h2 id={`pedido-${order.id}-titulo`} ref={headingRef} tabIndex={-1} className="mt-0.5 break-words text-[1.4rem] font-semibold leading-tight tracking-[-0.02em] text-[#193244] outline-none">
            {order.customer.name}
          </h2>
          <p className="mt-1.5 text-sm text-[#5d6b72]">
            {order.createdLabel} · {order.itemCount} {order.itemCount === 1 ? "item" : "itens"} · <strong className="font-semibold text-[#193244]">{formatBrl(order.totals.totalCents)}</strong>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {isTest && <Badge tone="neutral">Teste</Badge>}
            <Badge tone={payment.tone}>{payment.label}</Badge>
            {isPaid && !isTest && <Badge tone={situation.tone}>{situation.label}</Badge>}
            {order.unread > 0 && <Badge tone="critical">{order.unread} {order.unread === 1 ? "mensagem nova" : "mensagens novas"}</Badge>}
          </div>
        </header>

        {testState && <Feedback state={testState} />}
        {isTest && <TestNotice order={order} formAction={testAction} pending={testPending} />}
        {!isTest && !isPaid && <PaymentNotice order={order} />}
        <ItemsSection order={order} />
        {!isTest && isPaid && <FulfillmentSection order={order} onOrderChange={onOrderChange} />}
        {!isTest && isPaid && <LabelSection order={order} onOrderChange={onOrderChange} />}
        <CustomerSection order={order} />
        <PaymentSection order={order} />
        <HistorySection order={order} />
        {!isTest && <MarkAsTest key={testState?.at ?? 0} order={order} formAction={testAction} pending={testPending} />}
      </div>
    </article>
  );
}

function TestNotice({ order, formAction, pending }: { order: AdminOrder; formAction: (formData: FormData) => void; pending: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-dashed border-[#c5cac6] bg-[#eceeec] p-4 text-sm leading-6 text-[#415967]">
      <FlaskConical size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#193244]">Pedido de teste</p>
        <p>Fica fora das filas e dos contadores, não compra etiqueta e não envia avisos ao cliente. Nada foi apagado.</p>
        <p className="mt-1 text-xs opacity-80">Marcado como teste em {order.testMarkedLabel}.</p>
        <form action={formAction} className="mt-3">
          <input type="hidden" name="orderId" value={order.id} />
          <button type="submit" name="intent" value="unmark" disabled={pending} className={secondaryButton}>
            {pending ? <><span className="ui-spinner" aria-hidden="true" /> Desmarcando…</> : "Não é teste: desmarcar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function MarkAsTest({ order, formAction, pending }: { order: AdminOrder; formAction: (formData: FormData) => void; pending: boolean }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-labelledby={`pedido-${order.id}-teste`} className="rounded-2xl border border-dashed border-[#d9d8d0] p-4 sm:p-5">
      <h3 id={`pedido-${order.id}-teste`} className="text-sm font-semibold text-[#193244]">Foi um pedido para testar a loja?</h3>
      <p className="mt-1 text-xs leading-5 text-[#74838a]">Marque como teste para tirá-lo das filas e dos contadores. Nada é apagado e dá para desmarcar depois.</p>
      {confirming ? (
        <form action={formAction} role="group" aria-label="Confirmar pedido de teste" className="mt-3 rounded-xl border border-[#193244]/15 bg-[#f8f7f3] p-3.5">
          <input type="hidden" name="orderId" value={order.id} />
          <p className="text-sm leading-6 text-[#193244]">
            Marcar <strong className="font-semibold">#{order.shortId}</strong> como teste? Até ser desmarcado, ele não aparece nas filas e não pode receber etiqueta nem atualizações de entrega.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" name="intent" value="mark" disabled={pending} className={primaryButton}>
              {pending ? <><span className="ui-spinner" aria-hidden="true" /> Marcando…</> : "Sim, é um teste"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={secondaryButton}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={`${secondaryButton} mt-3`}>
          <FlaskConical size={16} aria-hidden="true" /> Marcar como teste
        </button>
      )}
    </section>
  );
}

function PaymentNotice({ order }: { order: AdminOrder }) {
  const pending = order.status === "pending";
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 text-sm leading-6 ${pending ? "border-[#ecd9a8] bg-[#fdf7e7] text-[#6b4f12]" : "border-[#e4e3dc] bg-[#f1f1ee] text-[#4d5c63]"}`}>
      {pending ? <Clock3 size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <div>
        <p className="font-semibold">{pending ? "Aguardando o pagamento" : paymentStatus(order.status).label}</p>
        <p>
          {pending
            ? "Nada a fazer por enquanto. Assim que o Mercado Pago aprovar, o pedido entra na fila A enviar."
            : "Este pedido não foi pago, então não há nada para produzir nem enviar."}
        </p>
        {order.paymentExpiresLabel && <p className="mt-1 text-xs opacity-80">{order.paymentExpiresLabel}</p>}
      </div>
    </div>
  );
}

function ItemsSection({ order }: { order: AdminOrder }) {
  return (
    <Section title={`Itens (${order.itemCount})`} labelledBy={`pedido-${order.id}-itens`}>
      <ul className="divide-y divide-[#efeee8]">
        {order.items.map(item => (
          <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-xl bg-[#f3f1eb] px-1.5 text-xs font-bold tabular-nums text-[#415967]">{item.quantity}×</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#193244]">{item.name}</p>
                  <p className="text-xs text-[#74838a]">{item.color} · {formatBrl(item.unitPriceCents)} cada</p>
                </div>
                <Link
                  href={`/admin/mensagens/${order.id}/${item.id}`}
                  title="Mensagens sobre este item"
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#193244]/12 px-2.5 text-xs font-semibold text-[#193244] transition hover:border-[#193244]/30 sm:px-3"
                >
                  <MessageCircleMore size={15} aria-hidden="true" /><span className="sr-only sm:not-sr-only">Mensagens</span>
                  {item.unread > 0 && <span className="rounded-full bg-[#c4513b] px-1.5 py-0.5 text-[10px] leading-none text-white">{item.unread}<span className="sr-only"> {item.unread === 1 ? "nova" : "novas"}</span></span>}
                  <span className="sr-only"> sobre {item.name}</span>
                </Link>
              </div>
              {item.personalization && (
                <p className="mt-2 break-words rounded-xl border border-[#ead7ad] bg-[#fbf5e7] px-3 py-2 text-sm text-[#56400f]">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#946b28]">Personalização</span>
                  “{item.personalization}”
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const nextActionLabel: Record<FulfillmentStatus, string> = {
  preparing: "Mover para Em preparação",
  ready_to_ship: "Marcar como pronto para envio",
  shipped: "Marcar como enviado",
  out_for_delivery: "Informar saída para entrega",
  delivered: "Marcar como entregue",
};

function FulfillmentSection({ order, onOrderChange }: { order: AdminOrder; onOrderChange: (order: AdminOrder) => void }) {
  const [state, formAction, pending] = useActionState(async (previous: OrderActionState, formData: FormData) => {
    const result = await saveFulfillment(previous, formData);
    if (result?.order) onOrderChange(result.order);
    return result;
  }, null);
  const currentIndex = fulfillmentSteps.findIndex(step => step.id === order.fulfillment.status);

  return (
    <Section title="Andamento da entrega" labelledBy={`pedido-${order.id}-andamento`}>
      {order.fulfillment.updatedLabel && <p className="-mt-2 mb-3 text-[11px] text-[#8a979d]">Atualizado em {order.fulfillment.updatedLabel}</p>}
      <ol aria-label="Etapas da entrega" className="grid grid-cols-5 gap-1.5">
        {fulfillmentSteps.map((step, index) => {
          const status = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
          return (
            <li key={step.id} aria-current={status === "current" ? "step" : undefined} className="flex flex-col gap-1.5">
              <span aria-hidden="true" className={`h-1.5 rounded-full ${status === "current" ? "bg-[#b88a3b]" : status === "done" ? "bg-[#193244]" : "bg-[#e6e4dc]"}`} />
              <span className={`text-[11px] leading-tight ${status === "current" ? "font-semibold text-[#193244]" : status === "done" ? "text-[#56656c]" : "text-[#9aa5aa]"}`}>
                {step.label}
                <span className="sr-only">{status === "current" ? " (etapa atual)" : status === "done" ? " (concluída)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {/* Remount after each save so the next step and empty message become the new defaults. */}
      <FulfillmentForm key={order.fulfillment.revision} order={order} formAction={formAction} pending={pending} />
      <div className="mt-3"><Feedback state={state} /></div>
    </Section>
  );
}

function FulfillmentForm({ order, formAction, pending }: { order: AdminOrder; formAction: (formData: FormData) => void; pending: boolean }) {
  const current = order.fulfillment.status;
  const currentIndex = fulfillmentSteps.findIndex(step => step.id === current);
  const delivered = current === "delivered";
  const [target, setTarget] = useState<FulfillmentStatus>(delivered ? current : fulfillmentSteps[currentIndex + 1].id);
  const [choosing, setChoosing] = useState(false);
  const targetIndex = fulfillmentSteps.findIndex(step => step.id === target);
  const targetStep = fulfillmentSteps[targetIndex];
  const showTracking = targetIndex >= 2 || Boolean(order.fulfillment.trackingCode);
  const idPrefix = `pedido-${order.id}`;

  if (delivered && !choosing) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#eef6f1] px-3.5 py-3 text-sm text-[#1f5e46]">
        <span>Pedido entregue. Não há mais nada a fazer.</span>
        <button type="button" onClick={() => setChoosing(true)} className="text-xs font-semibold underline underline-offset-4">Corrigir etapa</button>
      </div>
    );
  }

  const buttonLabel = target === current
    ? "Salvar alterações"
    : targetIndex < currentIndex ? `Voltar para “${targetStep.label}”` : nextActionLabel[target];

  return (
    <form action={formAction} className="mt-4 space-y-3.5">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="revision" value={order.fulfillment.revision} />
      <input type="hidden" name="status" value={target} />

      {choosing ? (
        <fieldset>
          <legend className="text-xs font-semibold text-[#415967]">Mover o pedido para</legend>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {fulfillmentSteps.map(step => (
              <label key={step.id} className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm transition ${target === step.id ? "border-[#193244] bg-[#193244]/[0.04] font-semibold" : "border-[#e1e1db] hover:border-[#193244]/30"}`}>
                <input type="radio" name="etapa" value={step.id} checked={target === step.id} onChange={() => setTarget(step.id)} className="size-4 accent-[#193244]" />
                {step.label}
                {step.id === current && <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a979d]">atual</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm text-[#415967]">
          Próxima etapa: <strong className="font-semibold text-[#193244]">{targetStep.label}</strong>
          <span className="block text-xs text-[#8a979d]">O cliente verá: “{targetStep.description}”</span>
        </p>
      )}

      {showTracking ? (
        <label className="block text-xs font-semibold text-[#415967]" htmlFor={`${idPrefix}-rastreio`}>
          Código de rastreio <span className="font-normal text-[#8a979d]">(opcional)</span>
          <input id={`${idPrefix}-rastreio`} name="trackingCode" defaultValue={order.fulfillment.trackingCode ?? ""} maxLength={80} placeholder="Ex.: AA123456789BR" autoComplete="off" spellCheck={false} className={`${fieldClass} h-11 font-mono`} />
        </label>
      ) : <input type="hidden" name="trackingCode" value={order.fulfillment.trackingCode ?? ""} />}

      <label className="block text-xs font-semibold text-[#415967]" htmlFor={`${idPrefix}-mensagem`}>
        Mensagem para o cliente <span className="font-normal text-[#8a979d]">(opcional)</span>
        <textarea id={`${idPrefix}-mensagem`} name="note" maxLength={500} rows={2} placeholder="Ex.: Sua peça ficou pronta e será postada amanhã." className={`${fieldClass} resize-y py-2.5 leading-5`} />
      </label>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" disabled={pending} aria-busy={pending} className={primaryButton}>
          {pending ? <><span className="ui-spinner" aria-hidden="true" /> Salvando…</> : buttonLabel}
        </button>
        <button type="button" onClick={() => { setChoosing(value => !value); if (choosing) setTarget(delivered ? current : fulfillmentSteps[currentIndex + 1].id); }} className="text-xs font-semibold text-[#56656c] underline underline-offset-4 hover:text-[#193244]">
          {choosing ? "Usar a próxima etapa" : "Escolher outra etapa"}
        </button>
      </div>
    </form>
  );
}

function LabelSection({ order, onOrderChange }: { order: AdminOrder; onOrderChange: (order: AdminOrder) => void }) {
  const [state, formAction, pending] = useActionState(async (previous: OrderActionState, formData: FormData) => {
    const result = await updateShippingLabel(previous, formData);
    if (result?.order) onOrderChange(result.order);
    return result;
  }, null);
  const [intent, setIntent] = useState<"create" | "generate" | "sync" | null>(null);
  const { label, shipping, customer } = order;
  const stage = label.state === "ready" ? 3 : label.state === "bought" ? 2 : 1;
  const service = [shipping.company, shipping.service].filter(Boolean).join(" · ") || "Serviço não informado";
  const busy = (value: typeof intent) => pending && intent === value;

  return (
    <Section
      title="Etiqueta de envio"
      labelledBy={`pedido-${order.id}-etiqueta`}
      aside={shipping.sandbox && <Badge tone="warning">Sandbox</Badge>}
    >
      <p className="text-sm text-[#415967]">
        <Tag size={14} className="mr-1.5 inline -translate-y-px text-[#8a979d]" aria-hidden="true" />
        {service} <span className="text-[#8a979d]">via {shipping.providerName}</span>
      </p>
      <p className="mt-0.5 text-xs text-[#8a979d]">
        Frete pago pelo cliente: {order.totals.shippingCents ? formatBrl(order.totals.shippingCents) : "grátis"}
        {shipping.deliveryDays ? ` · prazo de ${shipping.deliveryDays} ${shipping.deliveryDays === 1 ? "dia útil" : "dias úteis"}` : ""}
      </p>

      {label.state !== "missing-cpf" && (
        <ol aria-label="Etapas da etiqueta" className="mt-4 flex items-center gap-2 text-xs">
          {["Comprar", "Gerar PDF", "Imprimir"].map((name, index) => {
            const done = index + 1 < stage;
            const current = index + 1 === stage;
            return (
              <li key={name} aria-current={current ? "step" : undefined} className="flex items-center gap-2">
                {index > 0 && <span aria-hidden="true" className={`h-px w-4 sm:w-6 ${done || current ? "bg-[#193244]/40" : "bg-[#e1e1db]"}`} />}
                <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${done ? "bg-[#193244] text-white" : current ? "bg-[#b88a3b] text-white" : "bg-[#ecebe5] text-[#8a979d]"}`}>{done ? "✓" : index + 1}</span>
                <span className={current ? "font-semibold text-[#193244]" : "text-[#74838a]"}>{name}</span>
              </li>
            );
          })}
        </ol>
      )}

      {label.error && (
        <p role="alert" className="mt-3 flex gap-2 rounded-xl bg-[#fbe6e1] px-3.5 py-2.5 text-sm text-[#8c3727]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span><strong className="font-semibold">Última tentativa falhou:</strong> {label.error}</span>
        </p>
      )}

      <form action={formAction} className="mt-4">
        <input type="hidden" name="orderId" value={order.id} />

        {label.state === "missing-cpf" && (
          <p className="flex gap-2 rounded-xl bg-[#fdf7e7] px-3.5 py-3 text-sm leading-6 text-[#6b4f12]">
            <AlertTriangle size={16} className="mt-1 shrink-0" aria-hidden="true" />
            Pedido antigo, sem CPF do destinatário. Compre esta etiqueta direto no site da {shipping.providerName}.
          </p>
        )}

        {label.state === "to-buy" && (
          <BuyLabel
            key={state?.at ?? 0}
            order={order}
            service={service}
            pending={busy("create")}
            disabled={pending}
            onConfirm={() => setIntent("create")}
            canceled={label.canceled}
            needsName={!customer.hasFullName}
          />
        )}

        {label.state === "bought" && (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-[#415967]">Etiqueta comprada. Quando a {shipping.providerName} liberar o pagamento, gere o PDF para imprimir.</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" name="intent" value="generate" onClick={() => setIntent("generate")} disabled={pending} className={primaryButton}>
                {busy("generate") ? <><span className="ui-spinner" aria-hidden="true" /> Gerando…</> : <><FileText size={16} aria-hidden="true" /> Gerar etiqueta</>}
              </button>
            </div>
          </div>
        )}

        {label.state === "ready" && label.url && (
          <div className="flex flex-wrap gap-2">
            <a href={label.url} target="_blank" rel="noreferrer" className={primaryButton}>
              <Printer size={16} aria-hidden="true" /> Imprimir etiqueta <ExternalLink size={13} className="opacity-70" aria-hidden="true" /><span className="sr-only">(abre em nova aba)</span>
            </a>
          </div>
        )}

        {label.canSync && (
          <div className="mt-3 border-t border-[#efeee8] pt-3">
            <button type="submit" name="intent" value="sync" onClick={() => setIntent("sync")} disabled={pending} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[#56656c] underline-offset-4 hover:text-[#193244] hover:underline disabled:opacity-60">
              <RefreshCw size={13} className={busy("sync") ? "animate-spin" : ""} aria-hidden="true" />
              {busy("sync") ? "Consultando a SuperFrete…" : "Cancelou esta etiqueta na SuperFrete? Verificar cancelamento"}
            </button>
          </div>
        )}
      </form>
      {/* A failed attempt is already shown above as the label's saved error. */}
      <div className="mt-3"><Feedback state={state && !state.ok && label.error?.slice(0, 280) === state.message ? null : state} /></div>
    </Section>
  );
}

function BuyLabel({ order, service, pending, disabled, onConfirm, canceled, needsName }: {
  order: AdminOrder; service: string; pending: boolean; disabled: boolean; onConfirm: () => void; canceled: boolean; needsName: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const environment = order.shipping.sandbox ? " (sandbox)" : "";
  return (
    <div className="space-y-3">
      {canceled && <p className="text-sm text-[#415967]">A etiqueta anterior foi cancelada. Você pode comprar outra.</p>}
      {needsName && (
        <label className="block text-xs font-semibold text-[#415967]">
          Nome e sobrenome do destinatário
          <span className="block font-normal text-[#8a979d]">A transportadora exige o nome completo.</span>
          <input name="recipientName" defaultValue={order.customer.name} required minLength={3} maxLength={120} autoComplete="off" pattern=".*\S+\s+\S+.*" title="Informe nome e sobrenome" className={`${fieldClass} h-11`} />
        </label>
      )}
      {confirming ? (
        <div role="group" aria-label="Confirmar compra da etiqueta" className="rounded-xl border border-[#193244]/15 bg-[#f8f7f3] p-3.5">
          <p className="text-sm leading-6 text-[#193244]">
            Comprar etiqueta <strong className="font-semibold">{service}</strong> na {order.shipping.providerName}{environment}
            {order.totals.shippingCents ? <> por <strong className="font-semibold">{formatBrl(order.totals.shippingCents)}</strong></> : null}?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" name="intent" value="create" onClick={onConfirm} disabled={disabled} className={primaryButton}>
              {pending ? <><span className="ui-spinner" aria-hidden="true" /> Comprando…</> : "Confirmar compra"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={disabled} className={secondaryButton}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={primaryButton}>
          <Tag size={16} aria-hidden="true" /> Comprar etiqueta{environment}
        </button>
      )}
    </div>
  );
}

function CustomerSection({ order }: { order: AdminOrder }) {
  const { customer, address } = order;
  return (
    <Section title="Cliente e endereço" labelledBy={`pedido-${order.id}-cliente`}>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-[#8a979d]">Nome</dt>
          <dd className="mt-0.5 break-words font-medium text-[#193244]">{customer.name}</dd>
          <dd className="text-xs text-[#74838a]">CPF {customer.cpfMasked}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-[#8a979d]">Contato</dt>
          <dd className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <Mail size={14} className="shrink-0 text-[#8a979d]" aria-hidden="true" />
            {customer.email ? <a href={`mailto:${customer.email}`} className="truncate underline decoration-[#b88a3b]/50 underline-offset-4 hover:text-[#946b28]">{customer.email}</a> : "Não informado"}
          </dd>
          <dd className="mt-1 flex items-center gap-1.5">
            <Phone size={14} className="shrink-0 text-[#8a979d]" aria-hidden="true" />
            {customer.phoneHref ? <a href={customer.phoneHref} className="underline decoration-[#b88a3b]/50 underline-offset-4 hover:text-[#946b28]">{customer.phoneLabel}</a> : customer.phoneLabel || "Não informado"}
          </dd>
          {customer.whatsappHref && (
            <dd className="mt-2">
              <a href={customer.whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#e3f4ea] px-3 text-xs font-semibold text-[#1d6b45] transition hover:bg-[#d3eddd]">
                <MessageCircleMore size={14} aria-hidden="true" /> Abrir WhatsApp<span className="sr-only"> de {customer.name} (nova aba)</span>
              </a>
            </dd>
          )}
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="flex items-center justify-between gap-2 text-xs text-[#8a979d]">
            Endereço de entrega
            <CopyButton text={address.copyText} label="Copiar endereço" />
          </dt>
          <dd className="mt-0.5 break-words leading-6 text-[#193244]">
            {address.street}<br />
            {address.district} · {address.city}<br />
            CEP {address.postalCode}
          </dd>
        </div>
      </dl>
    </Section>
  );
}

function PaymentSection({ order }: { order: AdminOrder }) {
  const { totals } = order;
  const row = "flex items-baseline justify-between gap-3";
  return (
    <Section title="Pagamento" labelledBy={`pedido-${order.id}-pagamento`} aside={order.paymentId && <span className="text-[11px] text-[#8a979d]">Mercado Pago #{order.paymentId}</span>}>
      <dl className="space-y-1.5 text-sm text-[#415967]">
        <div className={row}><dt>Produtos</dt><dd className="tabular-nums">{formatBrl(totals.subtotalCents)}</dd></div>
        {totals.discountCents > 0 && <div className={row}><dt>Cupom {totals.couponCode}</dt><dd className="tabular-nums text-[#22654c]">−{formatBrl(totals.discountCents)}</dd></div>}
        <div className={row}><dt>Frete</dt><dd className="tabular-nums">{totals.shippingCents ? formatBrl(totals.shippingCents) : "Grátis"}</dd></div>
        <div className={`${row} border-t border-[#efeee8] pt-2 font-semibold text-[#193244]`}><dt>Total</dt><dd className="tabular-nums">{formatBrl(totals.totalCents)}</dd></div>
      </dl>
    </Section>
  );
}

function HistorySection({ order }: { order: AdminOrder }) {
  return (
    <Section title="Histórico" labelledBy={`pedido-${order.id}-historico`}>
      <ol className="relative space-y-4 border-l border-[#e6e4dc] pl-4">
        {order.events.map(event => (
          <li key={event.id} className="relative">
            <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-[#193244]" />
            <p className="text-sm font-semibold text-[#193244]">{fulfillmentSteps.find(step => step.id === event.status)?.label}</p>
            <p className="text-xs text-[#8a979d]"><time dateTime={event.createdAt}>{event.createdLabel}</time>{event.trackingCode ? ` · rastreio ${event.trackingCode}` : ""}</p>
            {event.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#56656c]">“{event.note}”</p>}
          </li>
        ))}
        <li className="relative">
          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-[#b9c0c3]" />
          <p className="text-sm font-semibold text-[#193244]">Pedido feito</p>
          <p className="text-xs text-[#8a979d]"><time dateTime={order.createdAt}>{order.createdLabel}</time></p>
        </li>
      </ol>
    </Section>
  );
}
