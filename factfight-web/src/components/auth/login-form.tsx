"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthActionState } from "@/app/(auth)/actions";

const initialState: AuthActionState = { message: "" };

function fieldMessage(messages: string[] | undefined) {
  return messages?.[0];
}

export function LoginForm({ callbackMessage }: { callbackMessage?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const emailError = fieldMessage(state.fieldErrors?.email);
  const passwordError = fieldMessage(state.fieldErrors?.password);
  const message = state.message || callbackMessage;

  return (
    <section
      aria-labelledby="login-title"
      className="w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-8"
    >
      <p className="text-sm font-medium text-[var(--ff-ai)]">FactFight account</p>
      <h1
        className="mt-2 text-3xl font-medium tracking-[-0.025em] text-[var(--ff-navy)]"
        id="login-title"
      >
        Log in
      </h1>
      <p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">
        Continue to the authentication preview. The community feed is not migrated yet.
      </p>

      {message ? (
        <p
          aria-live="polite"
          className="mt-5 rounded-[var(--ff-radius-card)] border border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_7%,white)] px-4 py-3 text-sm leading-6 text-[var(--ff-text)]"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <form action={formAction} className="mt-6 space-y-5" noValidate>
        <div>
          <label className="block text-sm font-medium text-[var(--ff-text)]" htmlFor="email">
            Email
          </label>
          <input
            aria-describedby={emailError ? "email-error" : undefined}
            aria-invalid={Boolean(emailError)}
            autoComplete="email"
            className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3 text-[var(--ff-text)] placeholder:text-[var(--ff-text-muted)]"
            id="email"
            inputMode="email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
          {emailError ? (
            <p className="mt-2 text-sm text-[var(--ff-fake)]" id="email-error">
              {emailError}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--ff-text)]" htmlFor="password">
            Password
          </label>
          <input
            aria-describedby={passwordError ? "password-error" : undefined}
            aria-invalid={Boolean(passwordError)}
            autoComplete="current-password"
            className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3 text-[var(--ff-text)]"
            id="password"
            name="password"
            required
            type="password"
          />
          {passwordError ? (
            <p className="mt-2 text-sm text-[var(--ff-fake)]" id="password-error">
              {passwordError}
            </p>
          ) : null}
        </div>

        <button
          className="w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-[var(--ff-navy)] px-4 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-65"
          disabled={pending}
          type="submit"
        >
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--ff-text-secondary)]">
        Need an account?{" "}
        <Link className="font-medium text-[var(--ff-ai)] underline-offset-4 hover:underline" href="/signup">
          Create account
        </Link>
      </p>
    </section>
  );
}
