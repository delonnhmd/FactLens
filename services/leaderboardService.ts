// PHASE 5 STEP 1
// PHASE 5 STEP 1B
import { API_CONFIG } from "../constants/apiConfig";
import { getDisplayRankTitle, parseBadgeList, type ReputationBadge } from "../utils/reputation";

export type LeaderboardScope = "monthly" | "all_time";

export interface LeaderboardUser {
  id: string;
  username: string;
  displayName: string;
  rankTitle: string;
  points: number;
  trustScore: number;
  badges: ReputationBadge[];
}

interface LeaderboardRow {
  id: string;
  username: string;
  display_name: string | null;
  trust_score: number | null;
  rank_title: string | null;
  highest_rank_achieved: string | null;
  reputation_points: number | null;
  monthly_reputation_points: number | null;
  badge_list: unknown;
}

export interface LeaderboardResult {
  users: LeaderboardUser[];
  nextMonthlyResetAt?: string | null;
  error?: string;
}

function mapLeaderboardRow(row: LeaderboardRow, scope: LeaderboardScope): LeaderboardUser {
  const trustScore = row.trust_score ?? 50;

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    rankTitle: getDisplayRankTitle({
      trustScore,
      rankTitle: row.rank_title,
      highestRankAchieved: row.highest_rank_achieved,
    }),
    points: scope === "monthly" ? row.monthly_reputation_points ?? 0 : row.reputation_points ?? 0,
    trustScore,
    badges: parseBadgeList(row.badge_list),
  };
}

export async function fetchLeaderboard(
  scope: LeaderboardScope = "monthly",
  limit = 20,
): Promise<LeaderboardResult> {
  try {
    const backendType = scope === "monthly" ? "monthly" : "alltime";
    const response = await fetch(`${API_CONFIG.BACKEND_URL}/leaderboard?type=${backendType}&limit=${limit}`);
    const json = await response.json();

    if (!response.ok || !json?.ok) {
      console.log("[leaderboard] backend load error:", json);
      return {
        users: [],
        error: "Could not load leaderboard right now.",
      };
    }

    return {
      users: (json.users ?? []).map((row: {
        rank_position?: number;
        username?: string;
        rank_title?: string;
        reputation_points?: number;
        monthly_reputation_points?: number;
        badge_count?: number;
      }) => ({
        id: `${row.rank_position ?? row.username}`,
        username: row.username ?? "unknown",
        displayName: row.username ?? "unknown",
        rankTitle: row.rank_title ?? "Claim Checker",
        points: scope === "monthly" ? row.monthly_reputation_points ?? 0 : row.reputation_points ?? 0,
        trustScore: 50,
        badges: [],
      })),
      nextMonthlyResetAt: json.next_monthly_reset_at ?? null,
    };
  } catch (error) {
    console.log("[leaderboard] load error:", error);

    return {
      users: [],
      error: "Could not load leaderboard right now.",
    };
  }
}
