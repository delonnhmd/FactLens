import { Download } from "lucide-react";

import { APP_STORE_URL } from "@/lib/constants/public-site";

interface AppStoreLinkProps {
  readonly compact?: boolean;
  readonly label?: string;
}

export function AppStoreLink({ compact = false, label = "Get the app" }: AppStoreLinkProps) {
  return (
    <a
      className={
        compact
          ? "inline-flex items-center gap-2 rounded-[var(--ff-radius-card)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--ff-navy)]"
          : "inline-flex items-center justify-center gap-2 rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-5 py-3 text-sm font-medium text-white"
      }
      href={APP_STORE_URL}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Download aria-hidden="true" size={compact ? 15 : 17} strokeWidth={1.8} />
      {label}
    </a>
  );
}
