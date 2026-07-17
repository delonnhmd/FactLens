"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  completePasswordResetAction,
  type PasswordActionState,
  requestPasswordResetAction,
} from "@/app/(auth)/password-actions";

const initialState: PasswordActionState = { message: "", success: false };
const inputClass = "mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3 disabled:cursor-wait disabled:bg-[var(--ff-surface)]";

function Message({ state }: { state: PasswordActionState }) {
  return state.message ? <p aria-live="polite" className={`mt-5 rounded-[var(--ff-radius-card)] border px-4 py-3 text-sm leading-6 ${state.success ? "border-[color-mix(in_srgb,var(--ff-true)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-true)_7%,white)]" : "border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_7%,white)]"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);
  return <section className="w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-8"><p className="text-sm font-medium text-[var(--ff-ai)]">Account recovery</p><h1 className="mt-2 text-3xl font-medium text-[var(--ff-navy)]">Forgot password?</h1><p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">Enter your account email and we will send a secure reset link.</p><Message state={state} /><form action={action} className="mt-6" noValidate><label className="block text-sm font-medium">Email<input autoComplete="email" className={inputClass} disabled={pending || state.success} inputMode="email" name="email" required type="email" />{state.fieldErrors?.email?.[0] ? <span className="mt-2 block text-sm text-[var(--ff-fake)]">{state.fieldErrors.email[0]}</span> : null}</label><button className="mt-5 w-full rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-4 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={pending || state.success} type="submit">{pending ? "Sending…" : "Send reset link"}</button></form><p className="mt-6 text-center text-sm"><Link className="font-medium text-[var(--ff-ai)] hover:underline" href="/login">Back to login</Link></p></section>;
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(completePasswordResetAction, initialState);
  return <section className="w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-8"><p className="text-sm font-medium text-[var(--ff-ai)]">Account recovery</p><h1 className="mt-2 text-3xl font-medium text-[var(--ff-navy)]">Choose a new password</h1><p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">Use at least 8 characters. After updating, log in with the new password.</p><Message state={state} /><form action={action} className="mt-6 space-y-5" noValidate><label className="block text-sm font-medium">New password<input autoComplete="new-password" className={inputClass} disabled={pending} minLength={8} name="password" required type="password" />{state.fieldErrors?.password?.[0] ? <span className="mt-2 block text-sm text-[var(--ff-fake)]">{state.fieldErrors.password[0]}</span> : null}</label><label className="block text-sm font-medium">Confirm new password<input autoComplete="new-password" className={inputClass} disabled={pending} minLength={8} name="confirmPassword" required type="password" />{state.fieldErrors?.confirmPassword?.[0] ? <span className="mt-2 block text-sm text-[var(--ff-fake)]">{state.fieldErrors.confirmPassword[0]}</span> : null}</label><button className="w-full rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-4 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={pending} type="submit">{pending ? "Updating…" : "Update password"}</button></form></section>;
}
