// PHASE 1 STEP 2
// PHASE 4 STEP 6
// PHASE 4 STEP 7
// PHASE 4 STEP 9
import type { Claim } from "../types/claim";
import { generateClaimShareUrl, generateClaimSlug } from "../services/claimLinks";
import { getExpiresAt } from "../services/claimVoting";

// PHASE 2 STEP 1
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const openCreatedAt = hoursAgo(3);
const trueClosedCreatedAt = hoursAgo(28);
const evidenceClosedCreatedAt = hoursAgo(30);

// PHASE 3 STEP 17
const minutesAfter = (createdAt: string, minutes: number) =>
  new Date(new Date(createdAt).getTime() + minutes * 60 * 1000).toISOString();

const verificationFields = (createdAt: string) => ({
  mode: "test" as const,
  currentPhase: 1,
  voteAcceptUntil: minutesAfter(createdAt, 10),
  scoreLockAt: minutesAfter(createdAt, 15),
  publishedAt: null,
  phase4Locked: false,
  earlyVerdictFired: false,
  suspiciousActivity: false,
  weightedCommunityScore: 0.5,
  finalScore: 0.5,
  minVotesRequired: 5,
  expectedParticipation: 10,
  sourceCount: 0,
  sourceQuality: "unknown" as const,
  sourceDomain: null,
  sourceScore: null,
  sourceReason: null,
  redFlags: [],
  aiSummary: null,
  aiStatus: "PENDING" as const,
  aiConfidence: null,
  claimType: "UNCLEAR" as const,
});

const userTrustFields = {
  votesCast: 0,
  accuracyRate: null,
  trustTier: "new" as const,
  trustWeightOverride: null,
};

// PHASE 2 STEP 2
export const mockClaims: Claim[] = [
  {
    id: "claim-01",
    // PHASE 2 STEP 8
    slug: generateClaimSlug("New study shows coffee boosts memory retention"),
    shareUrl: generateClaimShareUrl("claim-01"),
    title: "New study shows coffee boosts memory retention",
    description: "A recent survey indicates that daily coffee drinkers performed better on memory tasks.",
    sourceUrl: "https://example.com/coffee-memory",
    media: {
      imageUrl: null,
      videoUrl: null,
      youtubeUrl: null,
    },
    aiCheck: {
      status: "PENDING",
      confidence: null,
      reason: null,
      // PHASE 3 STEP 25
      riskLabel: null,
      flags: [],
      missingEvidence: [],
      sourceNotes: null,
      checkedAt: null,
    },
    votesTrue: 128,
    votesFake: 26,
    votesUnsure: 14,
    // PHASE 3 STEP 10
    totalVotes: 168,
    verdictReason: null,
    verdictCalculatedAt: null,
    status: "OPEN",
    createdAt: openCreatedAt,
    expiresAt: getExpiresAt(openCreatedAt),
    ...verificationFields(openCreatedAt),
    userVote: null,
    // PHASE 2 STEP 4
    evidence: [
      {
        id: "evidence-01",
        url: "https://example.com/coffee-study-details",
        note: "Study summary with sample size and memory task notes.",
        type: "ADDS_CONTEXT",
        createdAt: openCreatedAt,
      },
    ],
    // PHASE 3 STEP 5
    evidenceCount: 1,
    // PHASE 2 STEP 6
    reports: [],
    reportCount: 0,
    isFlagged: false,
    // PHASE 2 STEP 9
    authorId: "user-01",
    authorUsername: "newswatcher",
    authorDisplayName: "News Watcher",
    authorVerified: true,
    author: {
      id: "user-01",
      username: "newswatcher",
      displayName: "News Watcher",
      avatar: null,
      verified: true,
      reputationScore: 92,
      joinedAt: "2026-05-01T00:00:00.000Z",
      ...userTrustFields,
    },
  },
  {
    id: "claim-02",
    slug: generateClaimSlug("City council approves new green transit program"),
    shareUrl: generateClaimShareUrl("claim-02"),
    title: "City council approves new green transit program",
    description: "Officials say the program will improve sustainability and reduce commute emissions.",
    sourceUrl: "https://example.com/green-transit",
    media: {
      imageUrl: null,
      videoUrl: null,
      youtubeUrl: null,
    },
    aiCheck: {
      status: "PENDING",
      confidence: null,
      reason: null,
      // PHASE 3 STEP 25
      riskLabel: null,
      flags: [],
      missingEvidence: [],
      sourceNotes: null,
      checkedAt: null,
    },
    votesTrue: 94,
    votesFake: 11,
    votesUnsure: 32,
    // PHASE 3 STEP 10
    totalVotes: 137,
    verdictReason: "True received at least 60% of total votes.",
    verdictCalculatedAt: new Date(new Date(trueClosedCreatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    status: "COMMUNITY_TRUE",
    createdAt: trueClosedCreatedAt,
    expiresAt: getExpiresAt(trueClosedCreatedAt),
    ...verificationFields(trueClosedCreatedAt),
    userVote: null,
    evidence: [
      {
        id: "evidence-02",
        url: "https://example.com/city-council-agenda",
        note: "Council agenda confirms the transit program vote.",
        type: "SUPPORTS_TRUE",
        createdAt: trueClosedCreatedAt,
      },
      {
        id: "evidence-03",
        url: "https://example.com/transit-budget-context",
        note: "Budget note adds context about phased funding.",
        type: "ADDS_CONTEXT",
        createdAt: trueClosedCreatedAt,
      },
    ],
    // PHASE 3 STEP 5
    evidenceCount: 2,
    reports: [],
    reportCount: 0,
    isFlagged: false,
    authorId: "user-02",
    authorUsername: "factfinder",
    authorDisplayName: "Fact Finder",
    authorVerified: true,
    author: {
      id: "user-02",
      username: "factfinder",
      displayName: "Fact Finder",
      avatar: null,
      verified: true,
      reputationScore: 118,
      joinedAt: "2026-04-12T00:00:00.000Z",
      ...userTrustFields,
    },
  },
  {
    id: "claim-03",
    slug: generateClaimSlug("Tech startup claims wearable can detect stress instantly"),
    shareUrl: generateClaimShareUrl("claim-03"),
    title: "Tech startup claims wearable can detect stress instantly",
    description: "The startup says the device monitors physiological signals to spot stress in real time.",
    sourceUrl: "https://example.com/stress-wearable",
    media: {
      imageUrl: null,
      videoUrl: null,
      youtubeUrl: null,
    },
    aiCheck: {
      status: "PENDING",
      confidence: null,
      reason: null,
      // PHASE 3 STEP 25
      riskLabel: null,
      flags: [],
      missingEvidence: [],
      sourceNotes: null,
      checkedAt: null,
    },
    votesTrue: 65,
    votesFake: 40,
    votesUnsure: 55,
    // PHASE 3 STEP 10
    totalVotes: 160,
    verdictReason: "Vote result was too close.",
    verdictCalculatedAt: new Date(new Date(evidenceClosedCreatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    status: "NEEDS_MORE_EVIDENCE",
    createdAt: evidenceClosedCreatedAt,
    expiresAt: getExpiresAt(evidenceClosedCreatedAt),
    ...verificationFields(evidenceClosedCreatedAt),
    userVote: null,
    evidence: [],
    // PHASE 3 STEP 5
    evidenceCount: 0,
    reports: [],
    reportCount: 0,
    isFlagged: false,
    authorId: "user-03",
    authorUsername: "verifynow",
    authorDisplayName: "Verify Now",
    authorVerified: false,
    author: {
      id: "user-03",
      username: "verifynow",
      displayName: "Verify Now",
      avatar: null,
      verified: false,
      reputationScore: 63,
      joinedAt: "2026-05-10T00:00:00.000Z",
      ...userTrustFields,
    },
  },
];
