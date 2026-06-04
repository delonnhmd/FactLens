// PHASE 5 STEP 1
export type TrustTier = "LOW_TRUST" | "BASIC" | "TRUSTED" | "HIGH_TRUST";

export interface ReputationBadge {
  id: string;
  name: string;
  earned_at: string;
}

export interface ReputationProfile {
  trustScore?: number | null;
  trustTier?: string | null;
  rankTitle?: string | null;
  highestRankAchieved?: string | null;
  reputationPoints?: number | null;
  monthlyReputationPoints?: number | null;
  correctVotes?: number | null;
  incorrectVotes?: number | null;
  evidenceCount?: number | null;
  helpfulEvidenceCount?: number | null;
  badgeList?: ReputationBadge[] | null;
}

export interface RankInfo {
  title: string;
  tier: TrustTier;
  minScore: number;
  nextTitle: string | null;
  nextScore: number | null;
  weight: number;
}

const RANKS: RankInfo[] = [
  { title: "New Scout", tier: "LOW_TRUST", minScore: 0, nextTitle: "Claim Checker", nextScore: 30, weight: 0.75 },
  { title: "Claim Checker", tier: "BASIC", minScore: 30, nextTitle: "Trusted Verifier", nextScore: 55, weight: 1 },
  { title: "Trusted Verifier", tier: "TRUSTED", minScore: 55, nextTitle: "Source Hunter", nextScore: 75, weight: 1.2 },
  { title: "Source Hunter", tier: "HIGH_TRUST", minScore: 75, nextTitle: "FactLens Guardian", nextScore: 90, weight: 1.4 },
  { title: "FactLens Guardian", tier: "HIGH_TRUST", minScore: 90, nextTitle: null, nextScore: null, weight: 1.6 },
];

const RANK_ORDER = new Map(RANKS.map((rank, index) => [rank.title, index]));

export function clampTrustScore(score: number | null | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getRankInfoForTrustScore(score: number | null | undefined): RankInfo {
  const trustScore = clampTrustScore(score);
  return [...RANKS].reverse().find((rank) => trustScore >= rank.minScore) ?? RANKS[1];
}

export function getRankInfoByTitle(title: string | null | undefined): RankInfo | null {
  if (!title) {
    return null;
  }

  return RANKS.find((rank) => rank.title === title) ?? null;
}

export function getDisplayRankTitle(profile: ReputationProfile | null | undefined): string {
  const currentRank = getRankInfoForTrustScore(profile?.trustScore);
  const storedRank =
    getRankInfoByTitle(profile?.highestRankAchieved) ??
    getRankInfoByTitle(profile?.rankTitle);

  if (!storedRank) {
    return currentRank.title;
  }

  return (RANK_ORDER.get(storedRank.title) ?? 0) > (RANK_ORDER.get(currentRank.title) ?? 0)
    ? storedRank.title
    : currentRank.title;
}

export function getDisplayRankInfo(profile: ReputationProfile | null | undefined): RankInfo {
  const displayTitle = getDisplayRankTitle(profile);
  return getRankInfoByTitle(displayTitle) ?? getRankInfoForTrustScore(profile?.trustScore);
}

export function getTrustTierForScore(score: number | null | undefined): TrustTier {
  return getRankInfoForTrustScore(score).tier;
}

export function getVoteTrustWeight(profile: ReputationProfile | null | undefined): number {
  return getRankInfoForTrustScore(profile?.trustScore).weight;
}

export function getRankProgress(profile: ReputationProfile | null | undefined): {
  currentScore: number;
  nextTitle: string | null;
  progress: number;
} {
  const currentScore = clampTrustScore(profile?.trustScore);
  const currentRank = getRankInfoForTrustScore(currentScore);

  if (currentRank.nextScore === null) {
    return {
      currentScore,
      nextTitle: null,
      progress: 1,
    };
  }

  const span = Math.max(1, currentRank.nextScore - currentRank.minScore);
  return {
    currentScore,
    nextTitle: currentRank.nextTitle,
    progress: Math.max(0, Math.min(1, (currentScore - currentRank.minScore) / span)),
  };
}

export function parseBadgeList(value: unknown): ReputationBadge[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((badge) => {
        if (badge && typeof badge === "object") {
          const row = badge as Partial<ReputationBadge>;
          return row.id && row.name
            ? {
                id: String(row.id),
                name: String(row.name),
                earned_at: String(row.earned_at ?? new Date().toISOString()),
              }
            : null;
        }

        return null;
      })
      .filter((badge): badge is ReputationBadge => Boolean(badge));
  }

  if (typeof value === "string") {
    try {
      return parseBadgeList(JSON.parse(value));
    } catch {
      return [];
    }
  }

  return [];
}

export function formatPoints(value: number | null | undefined): string {
  return `${Math.max(0, Math.round(value ?? 0)).toLocaleString()} pts`;
}

export function getTopBadges(badges: ReputationBadge[] | null | undefined, limit = 3): ReputationBadge[] {
  return (badges ?? []).slice(0, limit);
}
