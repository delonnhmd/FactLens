import type { PublicClaim } from "@/lib/types/claim";

export type LeaderboardScope = "monthly" | "all_time";

export interface LeaderboardUser {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly profileSlug: string;
  readonly rankPosition: number;
  readonly rankTitle: string;
  readonly points: number;
  readonly trustScore: number;
  readonly badges: readonly string[];
}

export interface LeaderboardData {
  readonly users: readonly LeaderboardUser[];
  readonly nextMonthlyResetAt: string | null;
}

export interface PublicProfileDetail {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly publicProfileSlug: string;
  readonly profileVisibility: "public" | "private";
  readonly rankTitle: string;
  readonly reputationPoints: number;
  readonly monthlyReputationPoints: number;
  readonly badges: readonly string[];
  readonly claimsCount: number;
  readonly repliesCount: number;
  readonly evidenceCount: number;
  readonly correctVotes: number;
  readonly totalVotes: number;
  readonly finalizedVotes: number;
  readonly accuracyPercentage: number | null;
  readonly createdAt: string | null;
  readonly isDeleted: boolean;
}

export interface ProfileSearchResult {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
}

export interface TopicSearchResult {
  readonly id: string;
  readonly label: string;
  readonly slug: string;
  readonly verdict: string;
  readonly totalVotes: number;
  readonly claimCount: number;
}

export interface SearchResults {
  readonly claims: readonly PublicClaim[];
  readonly profiles: readonly ProfileSearchResult[];
  readonly topics: readonly TopicSearchResult[];
}
