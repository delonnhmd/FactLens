import { FileQuestion } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section
      aria-labelledby="empty-state-title"
      className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white px-6 py-12 text-center"
    >
      <FileQuestion aria-hidden="true" className="mx-auto text-[var(--ff-text-muted)]" size={32} strokeWidth={1.6} />
      <h2 className="mt-4 text-xl font-medium text-[var(--ff-navy)]" id="empty-state-title">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md leading-7 text-[var(--ff-text-secondary)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
