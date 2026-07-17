import type { PublicClaim } from "./claim";

export type TopicVerdict = "TRUE" | "FAKE" | "DISPUTED" | "INSUFFICIENT_DATA";

export interface PublicTopic {
  readonly id: string;
  readonly label: string;
  readonly slug: string;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  readonly keywords: readonly string[];
  readonly openGraphTitle: string | null;
  readonly verdict: TopicVerdict;
  readonly totalTrueVotes: number;
  readonly totalFakeVotes: number;
  readonly totalUnsureVotes: number;
  readonly totalVotes: number;
  readonly claimCount: number;
  readonly updatedAt: string | null;
}

export interface PublicTopicPageData {
  readonly topic: PublicTopic;
  readonly claims: readonly PublicClaim[];
}
