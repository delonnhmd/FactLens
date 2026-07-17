import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateClaimForm } from "@/components/claims/create-claim-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create claim | FactFight",
  description: "Submit a source-backed claim for community verification on FactFight.",
};

export default async function CreateClaimPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login?next=/create");
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-6 sm:mb-8">
        <p className="text-sm font-medium text-[var(--ff-ai)]">Community submission</p>
        <h1 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">
          Create a claim
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--ff-text-secondary)]">
          Share one checkable claim and its source. FactFight uses AI only as a risk signal; the community remains responsible for the verdict.
        </p>
      </header>

      <section className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-7">
        <CreateClaimForm />
      </section>
    </div>
  );
}
