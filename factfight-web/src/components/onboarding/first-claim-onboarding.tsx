"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { mapLocaleToAppLanguage, type AppLanguage } from "@/lib/utils/detect-user-language";
import { onboardingStrings } from "@/lib/utils/onboarding-strings";

interface FirstClaimOnboardingProps {
  readonly userId: string;
  readonly visible: boolean;
}

export function FirstClaimOnboarding({ userId, visible }: FirstClaimOnboardingProps) {
  const router = useRouter();
  const [language] = useState<AppLanguage>(() =>
    typeof window === "undefined" ? "en" : mapLocaleToAppLanguage(window.navigator.language),
  );
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const copy = useMemo(() => onboardingStrings[language], [language]);

  useEffect(() => {
    if (!visible || typeof window === "undefined") return;
    const key = `factfight:onboarding:seen:${userId}`;
    if (window.localStorage.getItem(key) === "1") return;
    window.localStorage.setItem(key, "1");
    window.setTimeout(() => {
      setStep(0);
      setOpen(true);
    }, 0);
  }, [userId, visible]);

  const close = () => {
    setOpen(false);
    router.replace("/feed");
  };

  if (!open) return null;

  return (
    <div aria-labelledby="onboarding-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(13,27,62,0.62)] p-4" role="dialog">
      <div className="w-full max-w-lg rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 text-[var(--ff-text)] shadow-none sm:p-7">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--ff-ai)]">{step + 1} / 3</span>
          <button aria-label={copy.done} className="rounded-sm px-2 py-1 text-2xl leading-none text-[var(--ff-text-secondary)]" onClick={close} type="button">×</button>
        </div>
        <div aria-hidden="true" className="mt-3 flex gap-1">
          {[0, 1, 2].map((item) => <span className={`h-1 flex-1 rounded-full ${item === step ? "bg-[var(--ff-ai)]" : "bg-[var(--ff-border)]"}`} key={item} />)}
        </div>

        {step === 0 ? (
          <div className="mt-8">
            <p className="text-sm font-medium text-[var(--ff-ai)]">FactFight</p>
            <h2 className="mt-2 text-2xl font-medium text-[var(--ff-navy)]" id="onboarding-title">{copy.welcomeTitle}</h2>
            <p className="mt-4 leading-7 text-[var(--ff-text-secondary)]">{copy.welcomeBody}</p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-8">
            <h2 className="text-2xl font-medium text-[var(--ff-navy)]" id="onboarding-title">{copy.howItWorksTitle}</h2>
            <p className="mt-4 leading-7 text-[var(--ff-text-secondary)]">{copy.howItWorksBody}</p>
            <ol className="mt-5 space-y-2">
              {copy.howItWorksSteps.map((label, index) => <li className="flex items-center gap-3 rounded-[10px] bg-[var(--ff-surface)] px-3 py-3" key={label}><span className="flex size-7 items-center justify-center rounded-full bg-[var(--ff-ai)] text-sm font-medium text-white">{index + 1}</span><span>{label}</span></li>)}
            </ol>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-8">
            <h2 className="text-2xl font-medium text-[var(--ff-navy)]" id="onboarding-title">{copy.firstClaimTitle}</h2>
            <p className="mt-4 leading-7 text-[var(--ff-text-secondary)]">{copy.firstClaimBody}</p>
            <Link className="mt-7 flex min-h-12 items-center justify-center rounded-[10px] bg-[var(--ff-navy)] px-4 font-medium text-white" href="/create" onClick={() => setOpen(false)}>{copy.createClaim}</Link>
            <button className="mt-2 flex min-h-11 w-full items-center justify-center rounded-[10px] px-4 font-medium text-[var(--ff-text-secondary)]" onClick={close} type="button">{copy.exploreFirst}</button>
          </div>
        ) : null}

        {step < 2 ? (
          <div className="mt-8 flex items-center justify-between">
            <button className="min-h-11 rounded-[10px] px-3 font-medium text-[var(--ff-navy)] disabled:text-[var(--ff-text-muted)]" disabled={step === 0} onClick={() => setStep((current) => current - 1)} type="button">{copy.back}</button>
            <button className="min-h-11 rounded-[10px] bg-[var(--ff-navy)] px-5 font-medium text-white" onClick={() => setStep((current) => current + 1)} type="button">{copy.next}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
