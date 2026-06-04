// PHASE 5 STEP 1
import { supabase } from "../lib/supabase";
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
  const orderColumn = scope === "monthly" ? "monthly_reputation_points" : "reputation_points";
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,username,display_name,trust_score,rank_title,highest_rank_achieved,reputation_points,monthly_reputation_points,badge_list",
    )
    .order(orderColumn, { ascending: false })
    .order("trust_score", { ascending: false })
    .limit(limit);

  if (error) {
    console.log("[leaderboard] load error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      users: [],
      error: "Could not load leaderboard right now.",
    };
  }

  return {
    users: ((data ?? []) as LeaderboardRow[]).map((row) => mapLeaderboardRow(row, scope)),
  };
}
