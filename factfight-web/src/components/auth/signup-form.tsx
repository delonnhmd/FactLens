"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signupAction, type AuthActionState } from "@/app/(auth)/actions";
import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
} from "@/lib/validation/auth";

const initialState: AuthActionState = { message: "" };

function fieldMessage(messages: string[] | undefined) {
  return messages?.[0];
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const errors = state.fieldErrors;

  return (
    <section
      aria-labelledby="signup-title"
      className="w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-8"
    >
      <p className="text-sm font-medium text-[var(--ff-ai)]">FactFight account</p>
      <h1
        className="mt-2 text-3xl font-medium tracking-[-0.025em] text-[var(--ff-navy)]"
        id="signup-title"
      >
        Create account
      </h1>
      <p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">
        Set up your identity to participate in the FactFight community.
      </p>

      {state.message ? (
        <p
          aria-live="polite"
          className="mt-5 rounded-[var(--ff-radius-card)] border border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_7%,white)] px-4 py-3 text-sm leading-6 text-[var(--ff-text)]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="mt-6 space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="username">
              Username
            </label>
            <input
              aria-describedby="username-help username-error"
              aria-invalid={Boolean(errors?.username)}
              autoCapitalize="none"
              autoComplete="username"
              className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] px-3.5 py-3"
              id="username"
              maxLength={USERNAME_MAX_LENGTH + 1}
              name="username"
              required
              type="text"
            />
            <p className="mt-2 text-xs leading-5 text-[var(--ff-text-muted)]" id="username-help">
              3–20 letters, numbers, or underscores.
            </p>
            {fieldMessage(errors?.username) ? (
              <p className="mt-1 text-sm text-[var(--ff-fake)]" id="username-error">
                {fieldMessage(errors?.username)}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="displayName">
              Display name
            </label>
            <input
              aria-describedby={errors?.displayName ? "display-name-error" : undefined}
              aria-invalid={Boolean(errors?.displayName)}
              autoComplete="name"
              className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] px-3.5 py-3"
              id="displayName"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              name="displayName"
              required
              type="text"
            />
            {fieldMessage(errors?.displayName) ? (
              <p className="mt-2 text-sm text-[var(--ff-fake)]" id="display-name-error">
                {fieldMessage(errors?.displayName)}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="signup-email">
            Email
          </label>
          <input
            aria-describedby={errors?.email ? "signup-email-error" : undefined}
            aria-invalid={Boolean(errors?.email)}
            autoComplete="email"
            className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] px-3.5 py-3"
            id="signup-email"
            inputMode="email"
            name="email"
            required
            type="email"
          />
          {fieldMessage(errors?.email) ? (
            <p className="mt-2 text-sm text-[var(--ff-fake)]" id="signup-email-error">
              {fieldMessage(errors?.email)}
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="signup-password">
              Password
            </label>
            <input
              aria-describedby="password-help signup-password-error"
              aria-invalid={Boolean(errors?.password)}
              autoComplete="new-password"
              className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] px-3.5 py-3"
              id="signup-password"
              minLength={PASSWORD_MIN_LENGTH}
              name="password"
              required
              type="password"
            />
            <p className="mt-2 text-xs text-[var(--ff-text-muted)]" id="password-help">
              At least {PASSWORD_MIN_LENGTH} characters.
            </p>
            {fieldMessage(errors?.password) ? (
              <p className="mt-1 text-sm text-[var(--ff-fake)]" id="signup-password-error">
                {fieldMessage(errors?.password)}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              aria-describedby={errors?.confirmPassword ? "confirm-password-error" : undefined}
              aria-invalid={Boolean(errors?.confirmPassword)}
              autoComplete="new-password"
              className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] px-3.5 py-3"
              id="confirmPassword"
              minLength={PASSWORD_MIN_LENGTH}
              name="confirmPassword"
              required
              type="password"
            />
            {fieldMessage(errors?.confirmPassword) ? (
              <p className="mt-2 text-sm text-[var(--ff-fake)]" id="confirm-password-error">
                {fieldMessage(errors?.confirmPassword)}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="flex items-start gap-3 text-sm leading-6 text-[var(--ff-text-secondary)]">
            <input
              aria-describedby={errors?.termsAccepted ? "terms-error" : undefined}
              aria-invalid={Boolean(errors?.termsAccepted)}
              className="mt-1 size-4 shrink-0 accent-[var(--ff-navy)]"
              name="termsAccepted"
              required
              type="checkbox"
            />
            <span>
              I agree to the{" "}
              <Link className="font-medium text-[var(--ff-ai)] underline-offset-4 hover:underline" href="/terms">
                Terms of Use
              </Link>
              .
            </span>
          </label>
          {fieldMessage(errors?.termsAccepted) ? (
            <p className="mt-2 text-sm text-[var(--ff-fake)]" id="terms-error">
              {fieldMessage(errors?.termsAccepted)}
            </p>
          ) : null}
        </div>

        <button
          className="w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-[var(--ff-navy)] px-4 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-65"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--ff-text-secondary)]">
        Already have an account?{" "}
        <Link className="font-medium text-[var(--ff-ai)] underline-offset-4 hover:underline" href="/login">
          Log in
        </Link>
      </p>
    </section>
  );
}
