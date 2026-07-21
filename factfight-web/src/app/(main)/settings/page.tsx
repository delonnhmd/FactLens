import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/(auth)/actions";
import { SettingsForms } from "@/components/profile/settings-forms";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { getPublicProfile } from "@/lib/api/discovery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings | FactFight" };

export default async function SettingsPage() {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/settings");
  const profile = await getPublicProfile(session.userId);
  if (!profile) return <p className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5">Settings are temporarily unavailable.</p>;

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-6"><p className="text-sm font-medium text-[var(--ff-ai)]">Account</p><h1 className="mt-1 text-3xl font-medium text-[var(--ff-navy)]">Settings</h1><p className="mt-2 text-[var(--ff-text-secondary)]">Manage public profile details and account security.</p></header>
      <SettingsForms profile={profile} />
      <section className="mt-5 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-7" aria-labelledby="account-actions-heading"><h2 className="text-xl font-medium text-[var(--ff-navy)]" id="account-actions-heading">Account actions</h2><div className="mt-4 flex flex-wrap gap-3"><form action={logoutAction}><button className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] px-4 py-2.5 text-sm font-medium text-[var(--ff-navy)]" type="submit">Log out</button></form><Link className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] px-4 py-2.5 text-sm font-medium text-[var(--ff-navy)]" href="/privacy">Privacy</Link><Link className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] px-4 py-2.5 text-sm font-medium text-[var(--ff-navy)]" href="/terms">Terms</Link></div></section>
    </div>
  );
}
