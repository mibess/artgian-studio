"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import {
  CUSTOM_IDEA_MAX,
  customizationChoices,
  customOrderMessage,
  customPieceTypes,
  isCustomPieceType,
  whatsappHref,
  type CustomPieceType,
} from "../../lib/custom-order";

const PICK_EVENT = "artgian:custom-piece-type";

/** Lets the idea cards above the form preselect the kind of piece. */
export function announceCustomPieceType(type: CustomPieceType) {
  window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: type }));
}

const label = "text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#b88a3b]";
const field =
  "w-full rounded-2xl border border-[#0b2447]/15 bg-white/70 px-4 text-[0.95rem] text-[#0b2447] outline-none transition placeholder:text-[#0b2447]/40 focus:border-[#b88a3b] focus:bg-white focus:ring-2 focus:ring-[#b88a3b]/25";
const pill =
  "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#b88a3b]";

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function CustomQuoteForm({
  initialIdea = "",
  initialType = "",
}: {
  initialIdea?: string;
  initialType?: string;
}) {
  const id = useId();
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const [type, setType] = useState<CustomPieceType | "">(
    isCustomPieceType(initialType) ? initialType : "",
  );
  const [idea, setIdea] = useState(initialIdea.slice(0, CUSTOM_IDEA_MAX));
  const [customizations, setCustomizations] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [neededBy, setNeededBy] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onPick = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (isCustomPieceType(value)) setType(value);
    };
    window.addEventListener(PICK_EVENT, onPick);
    return () => window.removeEventListener(PICK_EVENT, onPick);
  }, []);

  const href = whatsappHref(
    customOrderMessage({ type, idea, customizations, quantity, neededBy, name }),
  );

  function toggle(choice: string) {
    setCustomizations((current) =>
      current.includes(choice) ? current.filter((c) => c !== choice) : [...current, choice],
    );
  }

  return (
    <form
      className="grid gap-7"
      noValidate
      onSubmit={(event) => event.preventDefault()}
      aria-describedby={`${id}-privacidade`}
    >
      <fieldset>
        <legend className={label}>Que tipo de peça?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {customPieceTypes.map((option) => {
            const selected = type === option.value;
            return (
              <label
                className={`${pill} ${
                  selected
                    ? "border-[#0b2447] bg-[#0b2447] text-[#fffdf8]"
                    : "border-[#0b2447]/15 bg-white/60 hover:border-[#0b2447]/35 hover:bg-white"
                }`}
                key={option.value}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  name="tipo"
                  onChange={() => setType(option.value)}
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <label className={label} htmlFor={`${id}-ideia`}>
            Conte a sua ideia
          </label>
          <span className="text-[0.65rem] text-[#647087]" aria-hidden="true">
            {idea.length}/{CUSTOM_IDEA_MAX}
          </span>
        </div>
        <textarea
          aria-describedby={`${id}-ideia-dica${error ? ` ${id}-erro` : ""}`}
          aria-invalid={Boolean(error)}
          className={`${field} mt-3 min-h-32 resize-y py-3 leading-6 ${error ? "border-red-700/60" : ""}`}
          id={`${id}-ideia`}
          maxLength={CUSTOM_IDEA_MAX}
          onChange={(event) => {
            setIdea(event.target.value);
            if (error && event.target.value.trim().length >= 3) setError("");
          }}
          placeholder="Ex.: chaveiro com o nome da minha filha nas cores do quarto dela, para o aniversário."
          ref={ideaRef}
          required
          value={idea}
        />
        <p className="mt-2 text-xs text-[#647087]" id={`${id}-ideia-dica`}>
          Fotos e referências você pode mandar direto na conversa.
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-800" id={`${id}-erro`} role="alert">
            {error}
          </p>
        )}
      </div>

      <fieldset>
        <legend className={label}>O que você quer personalizar?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {customizationChoices.map((choice) => {
            const selected = customizations.includes(choice);
            return (
              <label
                className={`${pill} ${
                  selected
                    ? "border-[#b88a3b] bg-[#f3e7cf] text-[#0b2447]"
                    : "border-[#0b2447]/15 bg-white/60 hover:border-[#0b2447]/35 hover:bg-white"
                }`}
                key={choice}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  onChange={() => toggle(choice)}
                  type="checkbox"
                  value={choice}
                />
                <span
                  className={`grid size-4 place-items-center rounded-full border transition ${
                    selected ? "border-[#b88a3b] bg-[#b88a3b] text-white" : "border-[#0b2447]/30"
                  }`}
                  aria-hidden="true"
                >
                  {selected && <Check size={11} strokeWidth={3} />}
                </span>
                {choice}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <span className={label} id={`${id}-quantidade`}>
            Quantidade
          </span>
          <div
            className="mt-3 flex h-12 items-center justify-between rounded-2xl border border-[#0b2447]/15 bg-white/70 px-1.5"
            role="group"
            aria-labelledby={`${id}-quantidade`}
          >
            <button
              aria-label="Diminuir quantidade"
              className="grid size-9 place-items-center rounded-xl transition hover:bg-[#ebe4d8] disabled:opacity-30"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              type="button"
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <input
              aria-label="Quantidade de peças"
              className="w-16 bg-transparent text-center font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              inputMode="numeric"
              max={9999}
              min={1}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                setQuantity(Number.isFinite(value) ? Math.min(9999, Math.max(1, value)) : 1);
              }}
              type="number"
              value={quantity}
            />
            <button
              aria-label="Aumentar quantidade"
              className="grid size-9 place-items-center rounded-xl transition hover:bg-[#ebe4d8]"
              onClick={() => setQuantity((q) => Math.min(9999, q + 1))}
              type="button"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div>
          <label className={label} htmlFor={`${id}-data`}>
            Precisa para quando?
          </label>
          <input
            className={`${field} mt-3 h-12`}
            id={`${id}-data`}
            min={today()}
            onChange={(event) => setNeededBy(event.target.value)}
            type="date"
            value={neededBy}
          />
        </div>
        <div>
          <label className={label} htmlFor={`${id}-nome`}>
            Seu nome
          </label>
          <input
            autoComplete="given-name"
            className={`${field} mt-3 h-12`}
            id={`${id}-nome`}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Opcional"
            type="text"
            value={name}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-[#0b2447]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-[#647087]" id={`${id}-privacidade`}>
          A mensagem abre no seu WhatsApp para você revisar e enviar. Nada do que
          você escreve aqui fica salvo no site.
        </p>
        <a
          className="inline-flex w-fit shrink-0 items-center gap-4 rounded-full bg-[#0b2447] py-2 pr-2 pl-6 text-sm font-semibold text-white shadow-lg shadow-[#0b2447]/15 transition hover:-translate-y-0.5 hover:bg-[#143866] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b88a3b]"
          href={href}
          onClick={(event) => {
            if (idea.trim().length < 3) {
              event.preventDefault();
              setError("Conte em poucas palavras o que você imaginou para continuarmos.");
              ideaRef.current?.focus();
            }
          }}
          rel="noopener noreferrer"
          target="_blank"
        >
          Continuar no WhatsApp
          <span className="grid size-10 place-items-center rounded-full bg-[#d8bc7b] text-lg text-[#0b2447]" aria-hidden="true">
            →
          </span>
        </a>
      </div>
    </form>
  );
}
