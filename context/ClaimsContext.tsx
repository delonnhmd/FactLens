// PHASE 2 STEP 2
// PHASE 3 STEP 26
// PHASE 3 STEP 27
// PHASE 3 STEP 28
// PHASE 3 STEP 32
// PHASE 4 STEP 6
// PHASE 4 STEP 7
// PHASE 4 STEP 9
// PHASE 4 STEP 10
// PHASE 4 STEP 10B
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabaseConfigError } from "../lib/supabase";
import { applyCurrentClaimStatus, isVotingOpen } from "../services/claimVoting";
import {
  createClaim as createRemoteClaim,
  fetchClaimsByCategory as fetchRemoteClaimsByCategory,
  fetchClaimsByStatus as fetchRemoteClaimsByStatus,
  fetchClaimById as fetchRemoteClaimById,
  fetchLatestClaimsDebug as fetchRemoteLatestClaimsDebug,
  fetchLatestClaimsPage as fetchRemoteLatestClaimsPage,
  fetchTrendingClaims as fetchRemoteTrendingClaims,
  fetchTrendingClaimsPage as fetchRemoteTrendingClaimsPage,
  finalizeExpiredClaims as finalizeRemoteExpiredClaims,
  refreshClaimVerdict as refreshRemoteClaimVerdict,
  searchClaims as searchRemoteClaims,
  searchClaimsPage as searchRemoteClaimsPage,
  DEFAULT_CLAIMS_PAGE_SIZE,
} from "../services/claimService";
import type { ClaimSearchFilters, ClaimsResult } from "../services/claimService";
import {
  fetchUserVoteForClaim,
  voteOnClaim as voteOnRemoteClaim,
} from "../services/voteService";
import {
  retryAiPrecheckForClaim,
  runAiPrecheckForClaim,
  type AiPrecheckResponse,
} from "../services/aiPrecheckService";
import { getVoteAcceptUntil } from "../utils/verificationTiming";
import {
  addEvidence as addRemoteEvidence,
  fetchEvidenceForClaim as fetchRemoteEvidenceForClaim,
} from "../services/evidenceService";
import {
  fetchReportsForClaim as fetchRemoteReportsForClaim,
  reportClaim as reportRemoteClaim,
} from "../services/reportService";
import {
  subscribeToClaims,
  unsubscribe,
  type RealtimeChangePayload,
} from "../services/realtimeService";
import type { Claim, ClaimStatus, Evidence, EvidenceType, Report, ReportReason, VoteOption } from "../types/claim";
import { getDebugErrorParts } from "../utils/debugError";

export interface CreateClaimInput {
  title: string;
  description: string;
  sourceUrl: string;
  videoUrl?: string;
  // PHASE 3 STEP 7
  imageUrl?: string | null;
  category?: string;
}

// PHASE 2 STEP 4
export interface EvidenceInput {
  url: string;
  note: string;
  type: EvidenceType;
}

interface ClaimsContextValue {
  claims: Claim[];
  loading: boolean;
  // PHASE 3 STEP 11
  hasMoreClaims: boolean;
  loadingMore: boolean;
  // PHASE 3 STEP 12
  liveUpdatesEnabled: boolean;
  error: string | null;
  // PHASE 3 STEP 27
  claimsErrorMessage: string | null;
  claimsErrorCode: string | null;
  claimsErrorDetails: string | null;
  claimsErrorHint: string | null;
  rawClaimsError: unknown | null;
  // PHASE 4 STEP 2
  aiPrecheckNotice: string | null;
  clearAiPrecheckNotice: () => void;
  runAiPrecheckForClaimId: (claimId: string) => Promise<Claim | undefined>;
  retryAiPrecheckWithEvidenceForClaimId: (claimId: string) => Promise<Claim | undefined>;
  createClaim: (input: CreateClaimInput) => Promise<Claim>;
  voteOnClaim: (claimId: string, vote: VoteOption) => Promise<string | void>;
  // PHASE 3 STEP 20E
  getUserVoteForClaim: (claimId: string) => VoteOption | null;
  refreshUserVoteForClaim: (claimId: string) => Promise<VoteOption | null>;
  // PHASE 3 STEP 5
  fetchEvidenceForClaim: (claimId: string) => Promise<Evidence[]>;
  addEvidence: (claimId: string, evidenceInput: EvidenceInput) => Promise<Evidence[]>;
  // PHASE 3 STEP 6
  fetchReportsForClaim: (claimId: string) => Promise<Report[]>;
  reportClaim: (claimId: string, reason: ReportReason, note: string) => Promise<void>;
  // PHASE 3 STEP 9
  searchClaims: (query: string, filters?: ClaimSearchFilters) => Promise<Claim[]>;
  fetchClaimsByCategory: (category: string) => Promise<Claim[]>;
  fetchClaimsByStatus: (status: ClaimStatus) => Promise<Claim[]>;
  fetchTrendingClaims: () => Promise<Claim[]>;
  // PHASE 3 STEP 11
  fetchTrendingClaimsPage: (limit?: number, offset?: number) => Promise<Claim[]>;
  fetchLatestClaims: () => Promise<Claim[]>;
  refreshClaims: () => Promise<void>;
  loadMoreClaims: () => Promise<void>;
  searchClaimsPage: (
    query: string,
    filters?: ClaimSearchFilters,
    limit?: number,
    offset?: number,
  ) => Promise<Claim[]>;
  // PHASE 3 STEP 10
  refreshClaimVerdict: (claimId: string) => Promise<Claim | undefined>;
  getClaimById: (claimId: string) => Claim | undefined;
  fetchClaimById: (claimId: string) => Promise<Claim | undefined>;
  now: Date;
}

const ClaimsContext = createContext<ClaimsContextValue | undefined>(undefined);
const AI_PRECHECK_REFETCH_DELAY_MS = 300;

function waitForAiPrecheckRefresh() {
  return new Promise((resolve) => setTimeout(resolve, AI_PRECHECK_REFETCH_DELAY_MS));
}

// PHASE 4 STEP 6
function mapAiStatus(status: unknown): Claim["aiStatus"] {
  if (
    status === "PENDING" ||
    status === "LOW_RISK" ||
    status === "MEDIUM_RISK" ||
    status === "HIGH_RISK" ||
    status === "LIKELY_TRUE" ||
    status === "LIKELY_FAKE" ||
    status === "NEEDS_MORE_EVIDENCE" ||
    status === "NOT_FACT_CHECKABLE" ||
    status === "ERROR"
  ) {
    return status;
  }

  return "PENDING";
}

// PHASE 4 STEP 7
function mapClaimType(claimType: unknown): Claim["claimType"] {
  if (
    claimType === "FACTUAL" ||
    claimType === "OPINION" ||
    claimType === "SATIRE" ||
    claimType === "QUESTION" ||
    claimType === "PROMOTION" ||
    claimType === "UNCLEAR"
  ) {
    return claimType;
  }

  return "UNCLEAR";
}

function mapSourceQuality(sourceQuality: unknown): Claim["sourceQuality"] {
  if (
    sourceQuality === "official" ||
    sourceQuality === "mainstream" ||
    sourceQuality === "specialized" ||
    sourceQuality === "social" ||
    sourceQuality === "blog" ||
    sourceQuality === "unknown"
  ) {
    return sourceQuality;
  }

  return "unknown";
}

function getNumberField(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getStringListField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [value];
    } catch {
      return [value];
    }
  }

  return [];
}

function getAiPrecheckErrorMessage(result: AiPrecheckResponse): string {
  return [result.error, result.details, result.hint].filter(Boolean).join(" ") || "AI pre-check unavailable.";
}

function mergeAiPrecheckResponseIntoClaim(claim: Claim, result: AiPrecheckResponse): Claim {
  const updatedClaim = result.updated_claim ?? {};
  const aiStatus = mapAiStatus(updatedClaim.ai_status ?? result.ai_status ?? claim.aiStatus);
  const aiConfidence = getNumberField(updatedClaim.ai_confidence ?? result.ai_confidence) ?? claim.aiConfidence;
  const claimType = mapClaimType(updatedClaim.claim_type ?? result.claim_type ?? claim.claimType);
  const sourceQuality = mapSourceQuality(updatedClaim.source_quality ?? result.source_quality ?? claim.sourceQuality);
  const sourceCount = getNumberField(updatedClaim.source_count ?? result.source_count) ?? claim.sourceCount;
  const sourceDomain = getStringField(updatedClaim.source_domain ?? result.source_domain) ?? claim.sourceDomain;
  const sourceScore = getNumberField(updatedClaim.source_score ?? result.source_score) ?? claim.sourceScore;
  const sourceReason = getStringField(updatedClaim.source_reason ?? result.source_reason) ?? claim.sourceReason;
  const evidenceUsedCount = getNumberField(updatedClaim.evidence_used_count ?? result.evidence_used_count) ?? claim.evidenceUsedCount;
  const redFlags = getStringListField(updatedClaim.red_flags ?? result.red_flags);
  const aiSummary = getStringField(updatedClaim.ai_summary ?? result.ai_summary) ?? claim.aiSummary;

  return {
    ...claim,
    aiStatus,
    aiConfidence,
    claimType,
    sourceQuality,
    sourceCount,
    sourceDomain,
    sourceScore,
    sourceReason,
    evidenceUsedCount,
    redFlags,
    aiSummary,
    aiCheck: {
      ...claim.aiCheck,
      status: aiStatus,
      confidence: aiConfidence,
      flags: redFlags,
      sourceNotes: aiSummary,
    },
  };
}

function mergeLocalClaimState(remoteClaim: Claim, existingClaim?: Claim): Claim {
  if (!existingClaim) {
    return remoteClaim;
  }

  return {
    ...remoteClaim,
    evidence: existingClaim.evidence,
    evidenceCount: remoteClaim.evidenceCount,
    reports: existingClaim.reports,
    reportCount: remoteClaim.reportCount,
    isFlagged: remoteClaim.isFlagged,
  };
}

// PHASE 3 STEP 9
function mergeClaimLists(currentClaims: Claim[], incomingClaims: Claim[]): Claim[] {
  const claimsById = new Map(currentClaims.map((claim) => [claim.id, claim]));

  incomingClaims.forEach((claim) => {
    claimsById.set(claim.id, mergeLocalClaimState(claim, claimsById.get(claim.id)));
  });

  return Array.from(claimsById.values());
}

// PHASE 3 STEP 11
function sortClaimsNewestFirst(nextClaims: Claim[]): Claim[] {
  return [...nextClaims].sort(
    (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}

// PHASE 3 STEP 12
function getRealtimeClaimId(payload: RealtimeChangePayload): string | null {
  const row = payload.eventType === "DELETE" ? payload.old : payload.new ?? payload.old;
  const id = row?.id;

  return typeof id === "string" ? id : null;
}

// PHASE 3 STEP 20E
const ALREADY_VOTED_MESSAGE = "You already voted on this post.";

function toAppVoteOption(voteType: string | null | undefined): VoteOption | null {
  const normalizedVoteType = String(voteType ?? "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  if (normalizedVoteType === "TRUE") {
    return "TRUE";
  }

  if (normalizedVoteType === "FAKE") {
    return "FAKE";
  }

  if (normalizedVoteType === "UNSURE" || normalizedVoteType === "NOT_SURE") {
    return "NOT_SURE";
  }

  return null;
}

export function ClaimsProvider({ children }: { children: ReactNode }) {
  // PHASE 3 STEP 3
  const { currentUser, profile, isVerified, ensureProfile } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  // PHASE 3 STEP 11
  const [hasMoreClaims, setHasMoreClaims] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [claimOffset, setClaimOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // PHASE 3 STEP 27
  const [claimsErrorMessage, setClaimsErrorMessage] = useState<string | null>(null);
  const [claimsErrorCode, setClaimsErrorCode] = useState<string | null>(null);
  const [claimsErrorDetails, setClaimsErrorDetails] = useState<string | null>(null);
  const [claimsErrorHint, setClaimsErrorHint] = useState<string | null>(null);
  const [rawClaimsError, setRawClaimsError] = useState<unknown | null>(null);
  // PHASE 3 STEP 12
  const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState(false);
  // PHASE 4 STEP 2
  const [aiPrecheckNotice, setAiPrecheckNotice] = useState<string | null>(null);
  // PHASE 3 STEP 20E
  const [userVotesByClaimId, setUserVotesByClaimId] = useState<Record<string, VoteOption>>({});
  const [now, setNow] = useState(() => new Date());
  const claimsRef = useRef<Claim[]>([]);
  const locallyCreatedClaimIdsRef = useRef(new Set<string>());
  // PHASE 4 STEP 3
  const aiRetryInProgressClaimIdsRef = useRef(new Set<string>());
  const aiAutoRetryStartedRef = useRef(false);

  useEffect(() => {
    claimsRef.current = claims;
  }, [claims]);

  const clearClaimsError = useCallback(() => {
    setError(null);
    setClaimsErrorMessage(null);
    setClaimsErrorCode(null);
    setClaimsErrorDetails(null);
    setClaimsErrorHint(null);
    setRawClaimsError(null);
  }, []);

  const setClaimsErrorFromResult = useCallback((result: Partial<ClaimsResult>) => {
    const message = result.errorMessage ?? result.error ?? "Could not load claims.";
    setError(result.error ?? message);
    setClaimsErrorMessage(message);
    setClaimsErrorCode(result.errorCode ?? null);
    setClaimsErrorDetails(result.errorDetails ?? null);
    setClaimsErrorHint(result.errorHint ?? null);
    setRawClaimsError(result.rawError ?? null);
  }, []);

  const setClaimsErrorFromUnknown = useCallback((loadError: unknown) => {
    const parts = getDebugErrorParts(loadError);
    const message = parts.message || "Could not load claims.";
    setError(message);
    setClaimsErrorMessage(message);
    setClaimsErrorCode(parts.code || null);
    setClaimsErrorDetails(parts.details || null);
    setClaimsErrorHint(parts.hint || null);
    setRawClaimsError(loadError);
  }, []);

  // PHASE 3 STEP 20E
  useEffect(() => {
    if (!currentUser) {
      setUserVotesByClaimId({});
      setClaims((currentClaimsState) => currentClaimsState.map((claim) => ({ ...claim, userVote: null })));
    }
  }, [currentUser]);

  const applyUserVotes = useCallback(
    async (nextClaims: Claim[]) => {
      if (!currentUser) {
        setUserVotesByClaimId({});
        return nextClaims.map((claim) => ({ ...claim, userVote: null }));
      }

      const nextVotesByClaimId: Record<string, VoteOption> = {};
      const claimsWithVotes = await Promise.all(
        nextClaims.map(async (claim) => {
          const result = await fetchUserVoteForClaim(claim.id, currentUser.id);
          const vote = result.error ? claim.userVote : result.vote;

          if (vote) {
            nextVotesByClaimId[claim.id] = vote;
          }

          return {
            ...claim,
            userVote: vote,
          };
        }),
      );

      setUserVotesByClaimId((currentVotes) => {
        const mergedVotes = { ...currentVotes };

        nextClaims.forEach((claim) => {
          if (nextVotesByClaimId[claim.id]) {
            mergedVotes[claim.id] = nextVotesByClaimId[claim.id];
          } else {
            delete mergedVotes[claim.id];
          }
        });

        return mergedVotes;
      });

      return claimsWithVotes;
    },
    [currentUser],
  );

  // PHASE 3 STEP 9
  const applyRemoteClaims = useCallback(
    async (result: ClaimsResult, replace = false) => {
      if (result.ok === false || result.error) {
        setClaimsErrorFromResult(result);
        throw new Error(result.error ?? result.errorMessage ?? "Could not load claims.");
      }

      clearClaimsError();
      // PHASE 3 STEP 10
      const finalizedResult = await finalizeRemoteExpiredClaims(result.claims);
      const claimsWithVotes = await applyUserVotes(finalizedResult.claims);

      setClaims((currentClaimsState) =>
        sortClaimsNewestFirst(replace ? claimsWithVotes : mergeClaimLists(currentClaimsState, claimsWithVotes)),
      );

      return claimsWithVotes;
    },
    [applyUserVotes, clearClaimsError, setClaimsErrorFromResult],
  );

  // PHASE 3 STEP 11
  const fetchLatestClaims = useCallback(
    async () => {
      // PHASE 3 STEP 26
      const nextClaims = await applyRemoteClaims(
        await fetchRemoteLatestClaimsDebug(),
        true,
      );
      setClaimOffset(nextClaims.length);
      setHasMoreClaims(nextClaims.length === DEFAULT_CLAIMS_PAGE_SIZE);
      return nextClaims;
    },
    [applyRemoteClaims],
  );

  // PHASE 3 STEP 11
  const refreshClaims = useCallback(async () => {
    setLoading(true);
    clearClaimsError();

    if (supabaseConfigError) {
      setClaims([]);
      setClaimOffset(0);
      setHasMoreClaims(false);
      setClaimsErrorFromResult({
        ok: false,
        claims: [],
        error: supabaseConfigError,
        errorMessage: supabaseConfigError,
      });
      setLoading(false);
      return;
    }

    try {
      await fetchLatestClaims();
    } catch (loadError) {
      setClaims([]);
      setClaimOffset(0);
      setHasMoreClaims(false);
      setClaimsErrorFromUnknown(loadError);
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [clearClaimsError, fetchLatestClaims, setClaimsErrorFromResult, setClaimsErrorFromUnknown]);

  // PHASE 3 STEP 11
  const loadMoreClaims = useCallback(async () => {
    if (loading || loadingMore || !hasMoreClaims) {
      return;
    }

    setLoadingMore(true);
    clearClaimsError();

    try {
      const nextClaims = await applyRemoteClaims(
        await fetchRemoteLatestClaimsPage(DEFAULT_CLAIMS_PAGE_SIZE, claimOffset),
        false,
      );
      setClaimOffset((currentOffset) => currentOffset + nextClaims.length);
      setHasMoreClaims(nextClaims.length === DEFAULT_CLAIMS_PAGE_SIZE);
    } catch (loadError) {
      setClaimsErrorFromUnknown(loadError);
    } finally {
      setLoadingMore(false);
    }
  }, [applyRemoteClaims, claimOffset, clearClaimsError, hasMoreClaims, loading, loadingMore, setClaimsErrorFromUnknown]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30 * 1000);

    return () => clearInterval(timer);
  }, []);

  // PHASE 3 STEP 3
  useEffect(() => {
    void refreshClaims().catch(() => undefined);
  }, [refreshClaims]);

  // PHASE 3 STEP 12
  useEffect(() => {
    if (supabaseConfigError) {
      setLiveUpdatesEnabled(false);
      return;
    }

    let mounted = true;

    const channel = subscribeToClaims(
      async (payload) => {
        const realtimeClaimId = getRealtimeClaimId(payload);

        if (!realtimeClaimId) {
          return;
        }

        const claimAlreadyLoaded = claimsRef.current.some((claim) => claim.id === realtimeClaimId);
        const locallyCreatedClaimAlreadyCounted = locallyCreatedClaimIdsRef.current.has(realtimeClaimId);

        if (payload.eventType === "DELETE") {
          setClaims((currentClaimsState) =>
            currentClaimsState.filter((claim) => claim.id !== realtimeClaimId),
          );

          locallyCreatedClaimIdsRef.current.delete(realtimeClaimId);

          if (claimAlreadyLoaded) {
            setClaimOffset((currentOffset) => Math.max(0, currentOffset - 1));
          }

          return;
        }

        const result = await fetchRemoteClaimById(realtimeClaimId);

        if (!mounted || result.error || !result.claim) {
          return;
        }

        await applyRemoteClaims({ claims: [result.claim] }, false);

        if (locallyCreatedClaimAlreadyCounted) {
          locallyCreatedClaimIdsRef.current.delete(realtimeClaimId);
        }

        if (payload.eventType === "INSERT" && !claimAlreadyLoaded && !locallyCreatedClaimAlreadyCounted) {
          setClaimOffset((currentOffset) => currentOffset + 1);
        }
      },
      (status) => {
        if (mounted) {
          setLiveUpdatesEnabled(status === "active");
        }
      },
    );

    return () => {
      mounted = false;
      setLiveUpdatesEnabled(false);
      unsubscribe(channel);
    };
  }, [applyRemoteClaims]);

  // PHASE 3 STEP 10
  useEffect(() => {
    const expiredOpenClaims = claims.filter(
      (claim) =>
        (claim.status === "OPEN" || claim.status === "VOTING_CLOSED") &&
        // PHASE 3 STEP 22
        new Date(getVoteAcceptUntil(claim)).getTime() <= now.getTime(),
    );

    if (expiredOpenClaims.length === 0) {
      return;
    }

    let mounted = true;

    finalizeRemoteExpiredClaims(expiredOpenClaims)
      .then(async (result) => {
        const claimsWithVotes = await applyUserVotes(result.claims);

        if (mounted) {
          setClaims((currentClaimsState) => mergeClaimLists(currentClaimsState, claimsWithVotes));
        }
      })
      .catch((finalizeError) => {
        if (mounted) {
          setError(finalizeError instanceof Error ? finalizeError.message : "We could not finalize expired claims.");
        }
      });

    return () => {
      mounted = false;
    };
  }, [applyUserVotes, claims, now]);

  const currentClaims = useMemo(
    () =>
      claims
        .map((claim) => applyCurrentClaimStatus(claim, now))
        .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
    [claims, now],
  );

  // PHASE 4 STEP 2
  const clearAiPrecheckNotice = useCallback(() => {
    setAiPrecheckNotice(null);
  }, []);

  // PHASE 4 STEP 3
  const refreshClaimAfterAiPrecheck = useCallback(
    async (targetClaim: Claim, precheckResult?: AiPrecheckResponse) => {
      // PHASE 4 STEP 6
      const claimAfterPrecheck = precheckResult?.ok
        ? mergeAiPrecheckResponseIntoClaim(targetClaim, precheckResult)
        : targetClaim;

      if (claimAfterPrecheck !== targetClaim) {
        setClaims((currentClaimsState) =>
          currentClaimsState.map((claim) => (claim.id === targetClaim.id ? claimAfterPrecheck : claim)),
        );
      }

      await waitForAiPrecheckRefresh();
      const refreshedClaimResult = await fetchRemoteClaimById(targetClaim.id);

      if (refreshedClaimResult.error || !refreshedClaimResult.claim) {
        console.log("[ai precheck warning]", refreshedClaimResult.error ?? "Could not refresh AI pre-check result.");
        setAiPrecheckNotice(refreshedClaimResult.error ?? "AI pre-check will retry later.");
        return undefined;
      }

      const refreshedClaim = mergeLocalClaimState(refreshedClaimResult.claim, targetClaim);
      const [claimWithVote] = await applyUserVotes([refreshedClaim]);

      setClaims((currentClaimsState) => {
        const claimExists = currentClaimsState.some((claim) => claim.id === targetClaim.id);

        if (!claimExists) {
          return sortClaimsNewestFirst([claimWithVote, ...currentClaimsState]);
        }

        return currentClaimsState.map((claim) => (claim.id === targetClaim.id ? claimWithVote : claim));
      });

      setAiPrecheckNotice(null);
      return claimWithVote;
    },
    [applyUserVotes],
  );

  // PHASE 4 STEP 2
  // PHASE 4 STEP 10B
  const runAiPrecheckAndRefreshClaim = useCallback(
    async (targetClaim: Claim) => {
      const precheckResult = await runAiPrecheckForClaim(targetClaim);

      if (!precheckResult.ok) {
        const message = getAiPrecheckErrorMessage(precheckResult);
        console.log("[ai precheck warning]", message);
        setAiPrecheckNotice(`AI pre-check failed: ${message}`);
        throw new Error(message);
      }

      return refreshClaimAfterAiPrecheck(targetClaim, precheckResult);
    },
    [refreshClaimAfterAiPrecheck],
  );

  // PHASE 4 STEP 3
  const retryAiPrecheckAndRefreshClaim = useCallback(
    async (targetClaim: Claim, showNotice = true) => {
      if (aiRetryInProgressClaimIdsRef.current.has(targetClaim.id)) {
        return undefined;
      }

      aiRetryInProgressClaimIdsRef.current.add(targetClaim.id);

      try {
        const precheckResult = await retryAiPrecheckForClaim(targetClaim.id);

        if (!precheckResult.ok) {
          const message = getAiPrecheckErrorMessage(precheckResult);
          console.log("[ai precheck retry warning]", message);
          await refreshClaimAfterAiPrecheck(targetClaim).catch((refreshError) => {
            console.log("[ai precheck retry warning]", refreshError instanceof Error ? refreshError.message : refreshError);
          });

          if (showNotice) {
            setAiPrecheckNotice(`AI pre-check failed: ${message}`);
            throw new Error(message);
          }

          return undefined;
        }

        return refreshClaimAfterAiPrecheck(targetClaim, precheckResult);
      } finally {
        aiRetryInProgressClaimIdsRef.current.delete(targetClaim.id);
      }
    },
    [refreshClaimAfterAiPrecheck],
  );

  // PHASE 4 STEP 2
  const runAiPrecheckForClaimId = useCallback(
    async (claimId: string) => {
      const targetClaim = claimsRef.current.find((claim) => claim.id === claimId);

      if (!targetClaim) {
        throw new Error("Claim not found.");
      }

      // PHASE 4 STEP 6
      return runAiPrecheckAndRefreshClaim(targetClaim);
    },
    [runAiPrecheckAndRefreshClaim],
  );

  // PHASE 4 STEP 10
  const retryAiPrecheckWithEvidenceForClaimId = useCallback(
    async (claimId: string) => {
      const targetClaim = claimsRef.current.find((claim) => claim.id === claimId);

      if (!targetClaim) {
        throw new Error("Claim not found.");
      }

      return retryAiPrecheckAndRefreshClaim(targetClaim);
    },
    [retryAiPrecheckAndRefreshClaim],
  );

  // PHASE 4 STEP 3
  useEffect(() => {
    if (loading || aiAutoRetryStartedRef.current) {
      return;
    }

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const retryClaims = currentClaims
      .filter((claim) => {
        const createdAtMs = new Date(claim.createdAt).getTime();
        const isRecent = Number.isFinite(createdAtMs) && createdAtMs >= twentyFourHoursAgo;
        const aiStatus = claim.aiCheck.status;
        // PHASE 4 STEP 7
        console.log("[claim] claimType:", claim.claimType);

        return isRecent && (aiStatus === "PENDING" || aiStatus === "ERROR");
      })
      .slice(0, 5);

    if (retryClaims.length === 0) {
      return;
    }

    aiAutoRetryStartedRef.current = true;

    retryClaims.forEach((claim) => {
      void retryAiPrecheckAndRefreshClaim(claim, false).catch((retryError) => {
        console.log("[ai precheck auto-retry warning]", retryError instanceof Error ? retryError.message : retryError);
      });
    });
  }, [currentClaims, loading, retryAiPrecheckAndRefreshClaim]);

  const createClaim = useCallback(async (input: CreateClaimInput) => {
    if (!currentUser) {
      throw new Error("You need an account to post.");
    }

    // PHASE 3 STEP 28
    if (!isVerified) {
      throw new Error("Please verify your email before posting.");
    }

    let authorProfile = profile;

    if (!authorProfile) {
      const profileResult = await ensureProfile();
      authorProfile = profileResult.profile ?? null;
    }

    if (!authorProfile) {
      throw new Error("Profile required to post.");
    }

    const result = await createRemoteClaim({
      authorId: currentUser.id,
      title: input.title,
      description: input.description,
      sourceUrl: input.sourceUrl,
      videoUrl: input.videoUrl,
      imageUrl: input.imageUrl ?? null,
      category: input.category,
      profile: authorProfile,
    });

    if (result.error || !result.claim) {
      throw new Error(result.error ?? "We could not save this claim. Please try again.");
    }

    const createdClaim = result.claim;
    locallyCreatedClaimIdsRef.current.add(createdClaim.id);
    setClaims((currentClaimsState) => [
      createdClaim,
      ...currentClaimsState.filter((claim) => claim.id !== createdClaim.id),
    ]);
    setClaimOffset((currentOffset) => currentOffset + 1);

    // PHASE 4 STEP 2
    void runAiPrecheckAndRefreshClaim(createdClaim).catch((precheckError) => {
      console.log("[ai precheck warning]", precheckError instanceof Error ? precheckError.message : precheckError);
      setAiPrecheckNotice("AI pre-check will retry later.");
    });

    return createdClaim;
  }, [currentUser, ensureProfile, isVerified, profile, runAiPrecheckAndRefreshClaim]);

  // PHASE 3 STEP 20E
  const getUserVoteForClaim = useCallback(
    (claimId: string) => userVotesByClaimId[claimId] ?? null,
    [userVotesByClaimId],
  );

  // PHASE 3 STEP 20E
  const refreshUserVoteForClaim = useCallback(
    async (claimId: string) => {
      if (!currentUser) {
        setUserVotesByClaimId((currentVotes) => {
          const nextVotes = { ...currentVotes };
          delete nextVotes[claimId];
          return nextVotes;
        });

        setClaims((currentClaimsState) =>
          currentClaimsState.map((claim) => (claim.id === claimId ? { ...claim, userVote: null } : claim)),
        );

        return null;
      }

      const result = await fetchUserVoteForClaim(claimId, currentUser.id);

      if (result.error) {
        throw new Error(result.error);
      }

      setUserVotesByClaimId((currentVotes) => {
        const nextVotes = { ...currentVotes };

        if (result.vote) {
          nextVotes[claimId] = result.vote;
        } else {
          delete nextVotes[claimId];
        }

        return nextVotes;
      });

      setClaims((currentClaimsState) =>
        currentClaimsState.map((claim) =>
          claim.id === claimId ? { ...claim, userVote: result.vote } : claim,
        ),
      );

      return result.vote;
    },
    [currentUser],
  );

  // PHASE 3 STEP 4
  const voteOnClaim = useCallback(
    async (claimId: string, vote: VoteOption) => {
      if (!currentUser) {
        // PHASE 3 STEP 20
        throw new Error("Please log in to vote.");
      }

      // PHASE 3 STEP 28
      if (!isVerified) {
        // PHASE 3 STEP 20
        throw new Error("Please verify your email to vote.");
      }

      // PHASE 3 STEP 22
      // PHASE 3 STEP 28
      let votingProfile = profile;

      if (!votingProfile) {
        const profileResult = await ensureProfile();
        votingProfile = profileResult.profile ?? null;
      }

      if (!votingProfile) {
        throw new Error("Profile missing.");
      }

      const existingClaim = currentClaims.find((claim) => claim.id === claimId);
      const cachedUserVote = userVotesByClaimId[claimId] ?? existingClaim?.userVote ?? null;

      if (cachedUserVote) {
        // PHASE 3 STEP 32
        const updatedClaim = await fetchRemoteClaimById(claimId);

        if (updatedClaim.claim) {
          setClaims((currentClaimsState) =>
            currentClaimsState.map((claim) =>
              claim.id === claimId
                ? {
                    ...mergeLocalClaimState(updatedClaim.claim!, existingClaim),
                    userVote: cachedUserVote,
                  }
                : claim,
            ),
          );
        } else {
          setClaims((currentClaimsState) =>
            currentClaimsState.map((claim) =>
              claim.id === claimId ? { ...claim, userVote: cachedUserVote } : claim,
            ),
          );
        }

        setUserVotesByClaimId((currentVotes) => ({
          ...currentVotes,
          [claimId]: cachedUserVote,
        }));

        return ALREADY_VOTED_MESSAGE;
      }

      // PHASE 3 STEP 10
      const refreshedClaim = await refreshRemoteClaimVerdict(claimId);

      if (refreshedClaim.error) {
        throw new Error(refreshedClaim.error);
      }

      if (refreshedClaim.claim) {
        const claimWithVote = {
          ...mergeLocalClaimState(refreshedClaim.claim, existingClaim),
          userVote: existingClaim?.userVote ?? refreshedClaim.claim.userVote,
        };

        setClaims((currentClaimsState) =>
          mergeClaimLists(currentClaimsState, [claimWithVote]),
        );
      }

      if (refreshedClaim.claim && refreshedClaim.claim.status !== "OPEN") {
        // PHASE 3 STEP 20
        throw new Error("Voting is closed.");
      }

      if (refreshedClaim.claim && new Date(getVoteAcceptUntil(refreshedClaim.claim)).getTime() <= Date.now()) {
        // PHASE 3 STEP 20
        throw new Error("Voting is closed. Final score is being locked.");
      }

      const result = await voteOnRemoteClaim(claimId, currentUser.id, vote, votingProfile);

      // PHASE 3 STEP 20
      // PHASE 3 STEP 32
      const serviceUpdatedClaim = result.updatedClaim ?? result.claim;

      if (serviceUpdatedClaim) {
        const resultVote = result.alreadyVoted
          ? toAppVoteOption(result.vote?.vote_type) ?? serviceUpdatedClaim.userVote
          : serviceUpdatedClaim.userVote ?? vote;
        const updatedClaim = mergeLocalClaimState(serviceUpdatedClaim, existingClaim);
        setClaims((currentClaimsState) =>
          currentClaimsState.map((claim) =>
            claim.id === claimId ? { ...updatedClaim, userVote: resultVote } : claim,
          ),
        );

        if (resultVote) {
          setUserVotesByClaimId((currentVotes) => ({
            ...currentVotes,
            [claimId]: resultVote,
          }));
        }
      }

      if (result.alreadyVoted) {
        const existingVote = toAppVoteOption(result.vote?.vote_type) ?? serviceUpdatedClaim?.userVote ?? null;

        if (existingVote) {
          setUserVotesByClaimId((currentVotes) => ({
            ...currentVotes,
            [claimId]: existingVote,
          }));

          setClaims((currentClaimsState) =>
            currentClaimsState.map((claim) =>
              claim.id === claimId ? { ...claim, userVote: existingVote } : claim,
            ),
          );
        }

        return result.message ?? ALREADY_VOTED_MESSAGE;
      }

      if (result.error || !serviceUpdatedClaim) {
        throw new Error(result.error ?? "We could not save your vote. Please try again.");
      }

      // PHASE 3 STEP 20D
      return result.message ?? "Vote saved.";
    },
    [currentClaims, currentUser, ensureProfile, isVerified, profile, userVotesByClaimId],
  );

  // PHASE 3 STEP 5
  const fetchEvidenceForClaim = useCallback(async (claimId: string) => {
    const result = await fetchRemoteEvidenceForClaim(claimId);

    if (result.error) {
      throw new Error(result.error);
    }

    setClaims((currentClaimsState) =>
      currentClaimsState.map((claim) =>
        claim.id === claimId
          ? {
              ...claim,
              evidence: result.evidence,
              evidenceCount: result.evidence.length,
            }
          : claim,
      ),
    );

    return result.evidence;
  }, []);

  // PHASE 3 STEP 5
  const addEvidence = useCallback(
    async (claimId: string, evidenceInput: EvidenceInput) => {
      if (!currentUser) {
        throw new Error("Log in to add evidence.");
      }

      // PHASE 3 STEP 28
      if (!isVerified) {
        throw new Error("Verify your email to add evidence.");
      }

      let evidenceProfile = profile;

      if (!evidenceProfile) {
        const profileResult = await ensureProfile();
        evidenceProfile = profileResult.profile ?? null;
      }

      if (!evidenceProfile) {
        throw new Error("Profile required to add evidence.");
      }

      const addResult = await addRemoteEvidence(claimId, currentUser.id, evidenceInput);

      if (addResult.error || !addResult.evidence) {
        throw new Error(addResult.error ?? "We could not save this evidence. Please try again.");
      }

      const listResult = await fetchRemoteEvidenceForClaim(claimId);

      if (listResult.error) {
        throw new Error(listResult.error);
      }

      setClaims((currentClaimsState) =>
        currentClaimsState.map((claim) =>
          claim.id === claimId
            ? {
                ...claim,
                evidence: listResult.evidence,
                evidenceCount: addResult.evidenceCount ?? listResult.evidence.length,
              }
            : claim,
        ),
      );

      return listResult.evidence;
    },
    [currentUser, ensureProfile, isVerified, profile],
  );

  // PHASE 3 STEP 6
  const fetchReportsForClaim = useCallback(
    async (claimId: string) => {
      if (!currentUser) {
        return [];
      }

      const result = await fetchRemoteReportsForClaim(claimId);

      if (result.error) {
        throw new Error(result.error);
      }

      setClaims((currentClaimsState) =>
        currentClaimsState.map((claim) =>
          claim.id === claimId
            ? {
                ...claim,
                reports: result.reports,
                reportCount: result.reports.length,
                isFlagged: result.reports.length >= 3,
              }
            : claim,
        ),
      );

      return result.reports;
    },
    [currentUser],
  );

  // PHASE 3 STEP 6
  const reportClaim = useCallback(
    async (claimId: string, reason: ReportReason, note: string) => {
      if (!currentUser) {
        throw new Error("Log in to report claims.");
      }

      // PHASE 3 STEP 28
      if (!isVerified) {
        throw new Error("Verify your email to report claims.");
      }

      let reportProfile = profile;

      if (!reportProfile) {
        const profileResult = await ensureProfile();
        reportProfile = profileResult.profile ?? null;
      }

      if (!reportProfile) {
        throw new Error("Profile required to report claims.");
      }

      const existingClaim = currentClaims.find((claim) => claim.id === claimId);
      const result = await reportRemoteClaim(claimId, currentUser.id, reason, note);

      if (result.error || !result.claim) {
        throw new Error(result.error ?? "We could not save this report. Please try again.");
      }

      const reportsResult = await fetchRemoteReportsForClaim(claimId);
      const updatedClaim = {
        ...mergeLocalClaimState(result.claim, existingClaim),
        reports: reportsResult.error ? existingClaim?.reports ?? [] : reportsResult.reports,
      };

      setClaims((currentClaimsState) =>
        currentClaimsState.map((claim) => (claim.id === claimId ? updatedClaim : claim)),
      );

      if (reportsResult.error) {
        throw new Error(reportsResult.error);
      }
    },
    [currentClaims, currentUser, ensureProfile, isVerified, profile],
  );

  // PHASE 3 STEP 9
  const searchClaims = useCallback(
    async (query: string, filters?: ClaimSearchFilters) =>
      applyRemoteClaims(await searchRemoteClaims(query, filters), false),
    [applyRemoteClaims],
  );

  // PHASE 3 STEP 11
  const searchClaimsPage = useCallback(
    async (query: string, filters?: ClaimSearchFilters, limit = DEFAULT_CLAIMS_PAGE_SIZE, offset = 0) =>
      applyRemoteClaims(await searchRemoteClaimsPage(query, filters, limit, offset), false),
    [applyRemoteClaims],
  );

  // PHASE 3 STEP 9
  const fetchClaimsByCategory = useCallback(
    async (category: string) => applyRemoteClaims(await fetchRemoteClaimsByCategory(category), false),
    [applyRemoteClaims],
  );

  // PHASE 3 STEP 9
  const fetchClaimsByStatus = useCallback(
    async (status: ClaimStatus) => applyRemoteClaims(await fetchRemoteClaimsByStatus(status), false),
    [applyRemoteClaims],
  );

  // PHASE 3 STEP 9
  const fetchTrendingClaims = useCallback(
    async () => applyRemoteClaims(await fetchRemoteTrendingClaims(), false),
    [applyRemoteClaims],
  );

  // PHASE 3 STEP 11
  const fetchTrendingClaimsPage = useCallback(
    async (limit = DEFAULT_CLAIMS_PAGE_SIZE, offset = 0) =>
      applyRemoteClaims(await fetchRemoteTrendingClaimsPage(limit, offset), false),
    [applyRemoteClaims],
  );

  // PHASE 3 STEP 10
  const refreshClaimVerdict = useCallback(
    async (claimId: string) => {
      const result = await refreshRemoteClaimVerdict(claimId);

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.claim) {
        return undefined;
      }

      const [claimWithVote] = await applyUserVotes([result.claim]);

      setClaims((currentClaimsState) => mergeClaimLists(currentClaimsState, [claimWithVote]));

      return claimWithVote;
    },
    [applyUserVotes],
  );

  const getClaimById = useCallback(
    (claimId: string) => currentClaims.find((claim) => claim.id === claimId),
    [currentClaims],
  );

  // PHASE 3 STEP 3
  const fetchClaimById = useCallback(
    async (claimId: string) => {
      // PHASE 3 STEP 32
      const existingClaim = currentClaims.find((claim) => claim.id === claimId);
      const result = await fetchRemoteClaimById(claimId);

      if (result.error) {
        setError(result.error);
        return undefined;
      }

      if (result.claim) {
        const remoteClaim = mergeLocalClaimState(result.claim, existingClaim);
        const [loadedClaim] = await applyRemoteClaims({ claims: [remoteClaim] }, false);
        return loadedClaim;
      }

      return undefined;
    },
    [applyRemoteClaims, currentClaims],
  );

  const value = useMemo(
    () => ({
      claims: currentClaims,
      loading,
      hasMoreClaims,
      loadingMore,
      liveUpdatesEnabled,
      error,
      claimsErrorMessage,
      claimsErrorCode,
      claimsErrorDetails,
      claimsErrorHint,
      rawClaimsError,
      aiPrecheckNotice,
      clearAiPrecheckNotice,
      runAiPrecheckForClaimId,
      retryAiPrecheckWithEvidenceForClaimId,
      createClaim,
      voteOnClaim,
      getUserVoteForClaim,
      refreshUserVoteForClaim,
      fetchEvidenceForClaim,
      addEvidence,
      fetchReportsForClaim,
      reportClaim,
      searchClaims,
      searchClaimsPage,
      fetchClaimsByCategory,
      fetchClaimsByStatus,
      fetchTrendingClaims,
      fetchTrendingClaimsPage,
      fetchLatestClaims,
      refreshClaims,
      loadMoreClaims,
      refreshClaimVerdict,
      getClaimById,
      fetchClaimById,
      now,
    }),
    [
      addEvidence,
      createClaim,
      currentClaims,
      error,
      claimsErrorCode,
      claimsErrorDetails,
      claimsErrorHint,
      claimsErrorMessage,
      aiPrecheckNotice,
      clearAiPrecheckNotice,
      fetchEvidenceForClaim,
      fetchClaimById,
      fetchClaimsByCategory,
      fetchClaimsByStatus,
      fetchLatestClaims,
      fetchReportsForClaim,
      fetchTrendingClaims,
      fetchTrendingClaimsPage,
      getClaimById,
      getUserVoteForClaim,
      hasMoreClaims,
      liveUpdatesEnabled,
      loadMoreClaims,
      loading,
      loadingMore,
      now,
      rawClaimsError,
      reportClaim,
      refreshClaims,
      refreshClaimVerdict,
      refreshUserVoteForClaim,
      retryAiPrecheckWithEvidenceForClaimId,
      runAiPrecheckForClaimId,
      searchClaims,
      searchClaimsPage,
      voteOnClaim,
    ],
  );

  return <ClaimsContext.Provider value={value}>{children}</ClaimsContext.Provider>;
}

export function useClaims() {
  const context = useContext(ClaimsContext);

  if (!context) {
    throw new Error("useClaims must be used inside ClaimsProvider");
  }

  return context;
}
