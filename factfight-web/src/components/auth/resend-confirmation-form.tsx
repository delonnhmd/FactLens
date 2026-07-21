"use client";

import { useActionState } from "react";

import {
  resendConfirmationAction,
  type PasswordActionState,
} from "@/app/(auth)/password-actions";

const initialState: PasswordActionState = { message: "", success: false };

export function ResendConfirmationForm() {
  const [state, action, pending] = useActionState(
    resendConfirmationAction,
    initialState,
  );
  const emailError = state.fieldErrors?.email?.[0];

  return (
    <form action={action} className="mx-auto mt-6 max-w-md text-left" noValidate>
      <label className="block text-sm font-medium text-[var(--ff-text)]" htmlFor="resend-email">
        Email
      </label>
      <input
        aria-describedby={emailError ? "resend-email-error" : undefined}
        aria-invalid={Boolean(emailError)}
        autoComplete="email"
        className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3 text-[var(--ff-text)] disabled:cursor-wait disabled:bg-[var(--ff-surface)]"
        disabled={pending}
        id="resend-email"
        inputMode="email"
        name="email"
        placeholder="you@example.com"
        required
        type="email"
      />
      {emailError ? (
        <p className="mt-2 text-sm text-[var(--ff-fake)]" id="resend-email-error">
          {emailError}
        </p>
      ) : null}
      {state.message ? (
        <p
          aria-live="polite"
          className={`mt-3 rounded-[var(--ff-radius-card)] border px-4 py-3 text-sm leading-6 ${
            state.success
              ? "border-[color-mix(in_srgb,var(--ff-true)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-true)_7%,white)]"
              : "border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_7%,white)]"
          }`}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="mt-4 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-white px-4 py-3 font-medium text-[var(--ff-navy)] disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        {pending ? "Sending…" : "Resend confirmation email"}
      </button>
    </form>
  );
}
