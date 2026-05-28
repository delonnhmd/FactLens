// PHASE 3 VERIFICATION ENGINE
import type {
  AiScanOutput,
  VerificationEngineResult,
  VerificationInput,
  VerificationMode,
  VerificationVerdict,
  VerificationVote,
} from "../types/verification";
import type { Claim } from "../types/claim";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

const DEFAULT_AI_CONFIDENCE = 0.5;

interface ModeConfig {
  aiScanMs: number;
  phase1EndMs: number;
  phase2EndMs: number;
  phase3EndMs: number;
  phase4StartMs: number;
  publishMs: number;
  minVotes: number;
  expectedParticipation: number;
  suspiciousWindowMs: number;
  testMode: boolean;
}

const MODE_CONFIG: Record<VerificationMode, ModeConfig> = {
  production: {
    aiScanMs: 15 * MINUTE_MS,
    phase1EndMs: 6 * HOUR_MS,
    phase2EndMs: 12 * HOUR_MS,
    phase3EndMs: 20 * HOUR_MS,
    phase4StartMs: 20 * HOUR_MS,
    publishMs: 24 * HOUR_MS,
    minVotes: 15,
    expectedParticipation: 30,
    suspiciousWindowMs: 30 * MINUTE_MS,
    testMode: false,
  },
  test: {
    aiScanMs: 1 * MINUTE_MS,
    phase1EndMs: 3 * MINUTE_MS,
    phase2EndMs: 7 * MINUTE_MS,
    phase3EndMs: 10 * MINUTE_MS,
    phase4StartMs: 10 * MINUTE_MS,
    publishMs: 15 * MINUTE_MS,
    minVotes: 5,
    expectedParticipation: 10,
    suspiciousWindowMs: 2 * MINUTE_MS,
    testMode: true,
  },
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_AI_CONFIDENCE;
  }

  return Math.min(1, Math.max(0, value));
}

function normalizeAiConfidence(aiConfidence: number | null | undefined): number {
  if (aiConfidence === null || aiConfidence === undefined) {
    return DEFAULT_AI_CONFIDENCE;
  }

  return clampScore(aiConfidence > 1 ? aiConfidence / 100 : aiConfidence);
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function getVerificationConfig(mode: VerificationMode): ModeConfig {
  return MODE_CONFIG[mode];
}

export function getVerificationPhase(submittedAt: string, mode: VerificationMode, now = new Date()): number {
  const elapsedMs = now.getTime() - new Date(submittedAt).getTime();
  const config = getVerificationConfig(mode);

  if (elapsedMs < config.phase1EndMs) {
    return 1;
  }

  if (elapsedMs < config.phase2EndMs) {
    return 2;
  }

  if (elapsedMs < config.phase3EndMs) {
    return 3;
  }

  return 4;
}

export function getVotingClosesAt(submittedAt: string, mode: VerificationMode): string {
  return new Date(new Date(submittedAt).getTime() + getVerificationConfig(mode).phase4StartMs).toISOString();
}

export function getVerdictPublishesAt(submittedAt: string, mode: VerificationMode): string {
  return new Date(new Date(submittedAt).getTime() + getVerificationConfig(mode).publishMs).toISOString();
}

export function isPhase4Locked(submittedAt: string, mode: VerificationMode, now = new Date()): boolean {
  return now.getTime() - new Date(submittedAt).getTime() >= getVerificationConfig(mode).phase4StartMs;
}

export function isVerdictPublished(submittedAt: string, mode: VerificationMode, now = new Date()): boolean {
  return now.getTime() - new Date(submittedAt).getTime() >= getVerificationConfig(mode).publishMs;
}

export function canAcceptVerificationVote(submittedAt: string, mode: VerificationMode, now = new Date()): boolean {
  return now.getTime() - new Date(submittedAt).getTime() < getVerificationConfig(mode).phase4StartMs;
}

export function getTimeRemainingSeconds(submittedAt: string, mode: VerificationMode, now = new Date()): number {
  const publishAt = new Date(submittedAt).getTime() + getVerificationConfig(mode).publishMs;
  return Math.max(0, Math.ceil((publishAt - now.getTime()) / SECOND_MS));
}

export function getUserTrustWeight(vote: VerificationVote, mode: VerificationMode): number {
  if (mode === "test") {
    return vote.manualTrustWeight ?? 1;
  }

  if ((vote.sameDirectionStreak ?? 0) >= 20) {
    return 0.3;
  }

  if (vote.manualTrustWeight !== null && vote.manualTrustWeight !== undefined) {
    return vote.manualTrustWeight;
  }

  if ((vote.accuracyRate ?? 0) >= 0.85 || vote.userRole === "expert") {
    return 3;
  }

  if ((vote.accuracyRate ?? 0) >= 0.7 || vote.userRole === "high_accuracy") {
    return 2;
  }

  if (vote.emailConfirmed || vote.userRole === "verified") {
    return 1.5;
  }

  if ((vote.votesCast ?? 0) < 10 || vote.userRole === "new") {
    return 0.5;
  }

  return 1;
}

function getUniqueVotes(votes: VerificationVote[]): VerificationVote[] {
  const votesByUser = new Map<string, VerificationVote>();

  votes.forEach((vote) => {
    if (!votesByUser.has(vote.userId)) {
      votesByUser.set(vote.userId, vote);
    }
  });

  return Array.from(votesByUser.values());
}

function getVoteKey(vote: VerificationVote): string {
  return vote.id ?? `${vote.userId}-${vote.createdAt}`;
}

function getRecentAccountVoteIds(votes: VerificationVote[], mode: VerificationMode, now: Date): Set<string> {
  const config = getVerificationConfig(mode);
  const suspiciousVoteIds = new Set<string>();
  const sortedVotes = votes
    .filter((vote) => vote.userCreatedAt)
    .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());

  sortedVotes.forEach((vote) => {
    const windowStart = new Date(vote.createdAt).getTime();
    const windowEnd = windowStart + config.suspiciousWindowMs;
    const windowVotes = votes.filter((candidate) => {
      const voteTime = new Date(candidate.createdAt).getTime();
      return voteTime >= windowStart && voteTime <= windowEnd;
    });

    if (windowVotes.length === 0) {
      return;
    }

    const recentAccountVotes = windowVotes.filter((candidate) => {
      if (!candidate.userCreatedAt) {
        return false;
      }

      return now.getTime() - new Date(candidate.userCreatedAt).getTime() <= 24 * HOUR_MS;
    });

    if (recentAccountVotes.length / windowVotes.length >= 0.8) {
      windowVotes.forEach((candidate) => suspiciousVoteIds.add(getVoteKey(candidate)));
    }
  });

  return suspiciousVoteIds;
}

function adjustSessionWeights(votes: VerificationVote[], weight: number, vote: VerificationVote): number {
  if (!vote.ipAddress || !vote.sessionId) {
    return weight;
  }

  const sameSessionCount = votes.filter(
    (candidate) => candidate.ipAddress === vote.ipAddress && candidate.sessionId === vote.sessionId,
  ).length;

  return sameSessionCount > 1 ? Math.min(weight, 0.5) : weight;
}

export function calculateWeightedCommunityScore(
  votes: VerificationVote[],
  mode: VerificationMode,
  now = new Date(),
): { score: number; voteCount: number; suspiciousActivity: boolean } {
  const uniqueVotes = getUniqueVotes(votes);
  const suspiciousVoteIds = getRecentAccountVoteIds(uniqueVotes, mode, now);
  const acceptedVotes = uniqueVotes.filter((vote) => !suspiciousVoteIds.has(getVoteKey(vote)));

  const weightedTotals = acceptedVotes.reduce(
    (totals, vote) => {
      const baseWeight = getUserTrustWeight(vote, mode);
      const trustWeight = adjustSessionWeights(acceptedVotes, baseWeight, vote);
      const voteValue = vote.vote === "TRUE" ? 1 : 0;

      return {
        score: totals.score + voteValue * trustWeight,
        weight: totals.weight + trustWeight,
      };
    },
    { score: 0, weight: 0 },
  );

  return {
    score: weightedTotals.weight > 0 ? weightedTotals.score / weightedTotals.weight : DEFAULT_AI_CONFIDENCE,
    voteCount: uniqueVotes.length,
    suspiciousActivity: suspiciousVoteIds.size > 0,
  };
}

function getVerdict(finalScore: number, voteCount: number, minVotes: number, publishReady: boolean): VerificationVerdict {
  if (!publishReady) {
    return "pending";
  }

  if (voteCount < minVotes) {
    return "unsure";
  }

  if (finalScore >= 0.65) {
    return "true";
  }

  if (finalScore <= 0.34) {
    return "fake";
  }

  return "unsure";
}

export function calculateVerificationResult(input: VerificationInput): VerificationEngineResult {
  const now = input.now ?? new Date();
  const config = getVerificationConfig(input.mode);
  const phase = getVerificationPhase(input.submittedAt, input.mode, now);
  const community = calculateWeightedCommunityScore(input.votes, input.mode, now);
  const aiConfidence = normalizeAiConfidence(input.aiScan?.ai_confidence);
  const finalScore = clampScore(aiConfidence * 0.4 + community.score * 0.6);
  const earlyVoteThreshold = Math.ceil((input.expectedParticipation ?? config.expectedParticipation) * 0.5);
  const earlyVerdictFired =
    phase === 2 &&
    community.voteCount >= earlyVoteThreshold &&
    (finalScore >= 0.85 || finalScore <= 0.15);
  const phase4Locked = isPhase4Locked(input.submittedAt, input.mode, now);
  const publishReady = earlyVerdictFired || isVerdictPublished(input.submittedAt, input.mode, now);
  const verdict = getVerdict(finalScore, community.voteCount, config.minVotes, publishReady);

  return {
    article_id: input.articleId,
    mode: input.mode,
    current_phase: phase,
    time_remaining_seconds: getTimeRemainingSeconds(input.submittedAt, input.mode, now),
    vote_count: community.voteCount,
    min_votes_met: community.voteCount >= config.minVotes,
    ai_confidence: roundScore(aiConfidence),
    weighted_community_score: roundScore(community.score),
    final_score: roundScore(finalScore),
    verdict,
    early_verdict_fired: earlyVerdictFired,
    suspicious_activity: community.suspiciousActivity,
    phase4_locked: phase4Locked,
  };
}

export function createAggregateVotesFromClaim(claim: Pick<Claim, "id" | "createdAt" | "votesTrue" | "votesFake">): VerificationVote[] {
  const votes: VerificationVote[] = [];

  for (let index = 0; index < claim.votesTrue; index += 1) {
    votes.push({
      id: `${claim.id}-true-${index}`,
      userId: `${claim.id}-true-user-${index}`,
      vote: "TRUE",
      createdAt: claim.createdAt,
      userRole: "regular",
    });
  }

  for (let index = 0; index < claim.votesFake; index += 1) {
    votes.push({
      id: `${claim.id}-fake-${index}`,
      userId: `${claim.id}-fake-user-${index}`,
      vote: "FAKE",
      createdAt: claim.createdAt,
      userRole: "regular",
    });
  }

  return votes;
}

export function calculateClaimVerificationResult(
  claim: Pick<Claim, "id" | "createdAt" | "aiCheck" | "votesTrue" | "votesFake" | "votesUnsure">,
  mode: VerificationMode = "test",
  now = new Date(),
): VerificationEngineResult {
  const aggregateVotes = createAggregateVotesFromClaim(claim);
  const unsureVotes = Array.from({ length: claim.votesUnsure }, (_, index): VerificationVote => ({
    id: `${claim.id}-unsure-${index}`,
    userId: `${claim.id}-unsure-user-${index}`,
    vote: "FAKE",
    createdAt: claim.createdAt,
    userRole: "regular",
    manualTrustWeight: 0,
  }));
  const aiScan: AiScanOutput = {
    ai_confidence: normalizeAiConfidence(claim.aiCheck.confidence),
    source_count: 0,
    source_quality: "unknown",
    red_flags: [],
    summary: claim.aiCheck.reason ?? "AI scan pending.",
  };

  return calculateVerificationResult({
    articleId: claim.id,
    mode,
    submittedAt: claim.createdAt,
    now,
    aiScan,
    votes: [...aggregateVotes, ...unsureVotes],
  });
}

export function mapVerificationVerdictToStatus(verdict: VerificationVerdict): "COMMUNITY_TRUE" | "COMMUNITY_FAKE" | "NEEDS_MORE_EVIDENCE" {
  if (verdict === "true") {
    return "COMMUNITY_TRUE";
  }

  if (verdict === "fake") {
    return "COMMUNITY_FAKE";
  }

  return "NEEDS_MORE_EVIDENCE";
}

export function getVerificationVerdictReason(result: VerificationEngineResult): string {
  if (!result.min_votes_met) {
    return "Not enough community votes.";
  }

  if (result.suspicious_activity) {
    return "Suspicious voting activity was detected.";
  }

  if (result.verdict === "true") {
    return "AI confidence and community voting crossed the True threshold.";
  }

  if (result.verdict === "fake") {
    return "AI confidence and community voting crossed the Fake threshold.";
  }

  return "Combined AI and community score was not decisive.";
}
