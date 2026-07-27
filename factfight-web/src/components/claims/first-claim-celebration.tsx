"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { mapLocaleToAppLanguage, type AppLanguage } from "@/lib/utils/detect-user-language";
import { onboardingStrings } from "@/lib/utils/onboarding-strings";

interface FirstClaimCelebrationProps {
  readonly claimId: string;
  readonly claimTitle: string;
  readonly shareUrl: string;
  readonly userId: string | null;
  readonly visible: boolean;
}

export function FirstClaimCelebration({ claimId, claimTitle, shareUrl, userId, visible }: FirstClaimCelebrationProps) {
  const router = useRouter();
  const [language] = useState<AppLanguage>(() =>
    typeof window === "undefined" ? "en" : mapLocaleToAppLanguage(window.navigator.language),
  );
  const [open, setOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    if (!visible || !userId || typeof window === "undefined") return;
    const key = `factfight:first-claim:seen:${userId}:${claimId}`;
    if (window.localStorage.getItem(key) === "1") return;
    window.localStorage.setItem(key, "1");
    window.setTimeout(() => setOpen(true), 0);
  }, [claimId, userId, visible]);

  const copy = onboardingStrings[language];
  const close = () => {
    setOpen(false);
    router.replace(`/claim/${claimId}`);
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: claimTitle, text: claimTitle, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("Link copied.");
        return;
      }
    } catch {
      // Share cancellation is not an error that needs to interrupt the user.
    }
    close();
  };

  if (!open) return null;

  return (
    <div aria-labelledby="first-claim-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(13,27,62,0.62)] p-4" role="dialog">
      <div className="w-full max-w-md rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 text-center sm:p-8">
        <div aria-hidden="true" className="text-5xl">🎉</div>
        <h2 className="mt-4 text-2xl font-medium text-[var(--ff-navy)]" id="first-claim-title">{copy.firstClaimLiveTitle.replace("🎉 ", "")}</h2>
        <p className="mt-4 leading-7 text-[var(--ff-text-secondary)]">{copy.firstClaimLiveBody}</p>
        <button className="mt-7 min-h-12 w-full rounded-[10px] bg-[var(--ff-navy)] px-4 font-medium text-white" onClick={() => void share()} type="button">{copy.shareIt}</button>
        {shareMessage ? <p aria-live="polite" className="mt-3 text-sm text-[var(--ff-true)]">{shareMessage}</p> : null}
        <button className="mt-2 min-h-11 w-full rounded-[10px] px-4 font-medium text-[var(--ff-text-secondary)]" onClick={close} type="button">{copy.done}</button>
      </div>
    </div>
  );
}
