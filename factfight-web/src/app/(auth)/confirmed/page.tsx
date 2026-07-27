import { MailCheck } from "lucide-react";
import Link from "next/link";

import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";

interface ConfirmedPageProps {
  readonly searchParams: Promise<{ onboarding?: string }>;
}

export default async function ConfirmedPage({ searchParams }: ConfirmedPageProps) {
  const parameters = await searchParams;
  const loginHref = parameters.onboarding === "1" ? "/login?next=%2Ffeed%3Fonboarding%3D1" : "/login";

  return (
    <section
      aria-labelledby="confirmation-title"
      className="w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 text-center sm:p-8"
    >
      <span
        aria-hidden="true"
        className="mx-auto flex size-12 items-center justify-center rounded-[var(--ff-radius-card)] bg-[color-mix(in_srgb,var(--ff-ai)_10%,white)] text-[var(--ff-ai)]"
      >
        <MailCheck size={24} strokeWidth={1.8} />
      </span>
      <h1 className="mt-5 text-3xl font-medium text-[var(--ff-navy)]" id="confirmation-title">
        Check your email
      </h1>
      <p className="mx-auto mt-4 max-w-md leading-7 text-[var(--ff-text-secondary)]">
        Use the verification link in your email to continue. Your FactFight profile will be prepared only after that link completes successfully.
      </p>
      <ResendConfirmationForm />
      <Link
        className="mt-7 inline-flex rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-[var(--ff-navy)] px-5 py-3 font-medium text-white"
        href={loginHref}
      >
        Back to login
      </Link>
    </section>
  );
}
