"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode;
};

function ButtonContent({
  children,
  pending,
  pendingLabel,
}: {
  children: ReactNode;
  pending: boolean;
  pendingLabel: ReactNode;
}) {
  if (!pending) return children;

  return (
    <>
      <span className="ui-spinner" aria-hidden="true" />
      <span>{pendingLabel}</span>
    </>
  );
}

export function SubmitButton({
  children,
  disabled,
  pendingLabel = "Processando…",
  type = "submit",
  ...props
}: PendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      <ButtonContent pending={pending} pendingLabel={pendingLabel}>
        {children}
      </ButtonContent>
    </button>
  );
}

export function NativeSubmitButton({
  children,
  disabled,
  onClick,
  pendingLabel = "Carregando…",
  type = "submit",
  ...props
}: PendingButtonProps) {
  const [pending, setPending] = useState(false);

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          disabled ||
          pending ||
          event.currentTarget.form?.checkValidity() === false
        ) {
          return;
        }
        // Submit while the button is still enabled: disabling in this click
        // cancels the browser's default form submission in React 19.
        const form = event.currentTarget.form;
        if (form && type === "submit") {
          event.preventDefault();
          form.requestSubmit(event.currentTarget);
          setPending(true);
        }
      }}
    >
      <ButtonContent pending={pending} pendingLabel={pendingLabel}>
        {children}
      </ButtonContent>
    </button>
  );
}
