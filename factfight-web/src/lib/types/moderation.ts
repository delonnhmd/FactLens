export interface AdminIdentity {
  readonly email: string;
  readonly role: string;
}

export interface AdminMetrics {
  readonly today: { readonly newUsers: number; readonly claimsPosted: number; readonly votesCast: number };
  readonly week: { readonly newUsers: number; readonly claimsPosted: number; readonly votesCast: number };
  readonly totals: { readonly users: number; readonly claims: number; readonly votes: number; readonly pendingReports: number };
}

export interface ModerationReport {
  readonly id: string;
  readonly targetType: "CLAIM" | "EVIDENCE" | "PROFILE";
  readonly claimId: string | null;
  readonly evidenceId: string | null;
  readonly profileId: string | null;
  readonly reason: string;
  readonly note: string | null;
  readonly status: string;
  readonly createdAt: string | null;
  readonly target: Readonly<Record<string, unknown>> | null;
}

export interface ModerationDashboard {
  readonly identity: AdminIdentity;
  readonly metrics: AdminMetrics | null;
  readonly reports: readonly ModerationReport[];
  readonly metricsWarning?: string;
}
