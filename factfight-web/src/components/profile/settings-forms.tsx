"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  changePasswordAction,
  deleteAccountAction,
  type SettingsActionState,
  updateProfileAction,
} from "@/app/(main)/settings/actions";
import type { PublicProfileDetail } from "@/lib/types/discovery";

const initialState: SettingsActionState = { message: "", success: false };
const inputClass = "mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3 disabled:cursor-wait disabled:bg-[var(--ff-surface)]";

function fieldError(state: SettingsActionState, name: string) {
  return state.fieldErrors?.[name]?.[0];
}

export function SettingsForms({ profile }: { readonly profile: PublicProfileDetail }) {
  const passwordFormRef = useRef<HTMLFormElement>(null);
  const [profileState, profileAction, profilePending] = useActionState(updateProfileAction, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePasswordAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAccountAction, initialState);

  useEffect(() => {
    if (passwordState.success) passwordFormRef.current?.reset();
  }, [passwordState.success]);

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-7" aria-labelledby="profile-settings-heading">
        <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="profile-settings-heading">Profile details</h2>
        <form action={profileAction} className="mt-5 space-y-5" noValidate>
          <fieldset className="space-y-5" disabled={profilePending}>
            <label className="block text-sm font-medium">Display name<input className={inputClass} defaultValue={profile.displayName} maxLength={80} name="displayName" required />{fieldError(profileState, "displayName") ? <span className="mt-2 block text-sm text-[var(--ff-fake)]">{fieldError(profileState, "displayName")}</span> : null}</label>
            <label className="block text-sm font-medium">Bio<textarea className={`${inputClass} min-h-24 resize-y`} defaultValue={profile.bio ?? ""} maxLength={160} name="bio" />{fieldError(profileState, "bio") ? <span className="mt-2 block text-sm text-[var(--ff-fake)]">{fieldError(profileState, "bio")}</span> : null}</label>
            <label className="block text-sm font-medium">Profile visibility<select className={inputClass} defaultValue={profile.profileVisibility} name="profileVisibility"><option value="public">Public</option><option value="private">Private details</option></select></label>
          </fieldset>
          <button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-5 py-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={profilePending} type="submit">{profilePending ? "Saving…" : "Save profile"}</button>
        </form>
        {profileState.message ? <p aria-live="polite" className={`mt-3 text-sm ${profileState.success ? "text-[var(--ff-true)]" : "text-[var(--ff-fake)]"}`} role={profileState.success ? "status" : "alert"}>{profileState.message}</p> : null}
      </section>

      <section className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-7" aria-labelledby="password-settings-heading">
        <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="password-settings-heading">Change password</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">Your current password is verified before a new password is accepted.</p>
        <form action={passwordAction} className="mt-5 space-y-5" noValidate ref={passwordFormRef}>
          <fieldset className="space-y-5" disabled={passwordPending}>
            <label className="block text-sm font-medium">Current password<input autoCapitalize="none" autoComplete="current-password" autoCorrect="off" className={inputClass} name="currentPassword" required type="password" />{fieldError(passwordState, "currentPassword") ? <span className="mt-2 block text-sm text-[var(--ff-fake)]">{fieldError(passwordState, "currentPassword")}</span> : null}</label>
            <label className="block text-sm font-medium">New password<input autoCapitalize="none" autoComplete="new-password" autoCorrect="off" className={inputClass} minLength={8} name="newPassword" required type="password" />{fieldError(passwordState, "newPassword") ? <span className="mt-2 block text-sm text-[var(--ff-fake)]">{fieldError(passwordState, "newPassword")}</span> : null}</label>
            <label className="block text-sm font-medium">Confirm new password<input autoCapitalize="none" autoComplete="new-password" autoCorrect="off" className={inputClass} minLength={8} name="confirmPassword" required type="password" />{fieldError(passwordState, "confirmPassword") ? <span className="mt-2 block text-sm text-[var(--ff-fake)]">{fieldError(passwordState, "confirmPassword")}</span> : null}</label>
          </fieldset>
          <button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-5 py-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={passwordPending} type="submit">{passwordPending ? "Updating…" : "Update password"}</button>
        </form>
        {passwordState.message ? <p aria-live="polite" className={`mt-3 text-sm ${passwordState.success ? "text-[var(--ff-true)]" : "text-[var(--ff-fake)]"}`} role={passwordState.success ? "status" : "alert"}>{passwordState.message}</p> : null}
      </section>

      <section className="rounded-[var(--ff-radius-card)] border border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-white p-5 sm:p-7" aria-labelledby="delete-account-heading">
        <h2 className="text-xl font-medium text-[var(--ff-fake)]" id="delete-account-heading">Delete account</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">Personal account data will be anonymized and all sessions invalidated. Public claims, votes, and evidence remain attributed to a deleted user to preserve the verification record.</p>
        <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-[var(--ff-fake)]">Continue to account deletion</summary><form action={deleteAction} className="mt-4 space-y-3"><label className="block text-sm font-medium">Type DELETE to confirm<input autoComplete="off" className={inputClass} disabled={deletePending} name="confirmation" required /></label><button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-fake)] px-5 py-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={deletePending} type="submit">{deletePending ? "Deleting…" : "Delete account"}</button>{deleteState.message ? <p className="text-sm text-[var(--ff-fake)]" role="alert">{deleteState.message}</p> : null}</form></details>
      </section>
    </div>
  );
}
