// PHASE 2 STEP 2
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
  fetchLatestClaimsPage as fetchRemoteLatestClaimsPage,
  fetchTrendingClaims as fetchRemoteTrendingClaims,
  fetchTrendingClaimsPage as fetchRemoteTrendingClaimsPage,
  finalizeExpiredClaims as finalizeRemoteExpiredClaims,
  refreshClaimVerdict as refreshRemoteClaimVerdict,
  searchClaims as searchRemoteClaims,
  searchClaimsPage as searchRemoteClaimsPage,
  DEFAULT_CLAIMS_PAGE_SIZE,
} from "../services/claimService";
import type { ClaimSearchFilters } from "../services/claimService";
import {
  fetchUserVoteForClaim,
  voteOnClaim as voteOnRemoteClaim,
} from "../services/voteService";
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
  createClaim: (input: CreateClaimInput) => Promise<Claim>;
  voteOnClaim: (claimId: string, vote: VoteOption) => Promise<void>;
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

export function ClaimsProvider({ children }: { children: ReactNode }) {
  // PHASE 3 STEP 3
  const { currentUser, profile } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  // PHASE 3 STEP 11
  const [hasMoreClaims, setHasMoreClaims] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [claimOffset, setClaimOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // PHASE 3 STEP 12
  const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const claimsRef = useRef<Claim[]>([]);
  const locallyCreatedClaimIdsRef = useRef(new Set<string>());

  useEffect(() => {
    claimsRef.current = claims;
  }, [claims]);

  const applyUserVotes = useCallback(
    async (nextClaims: Claim[]) => {
      if (!currentUser) {
        return nextClaims.map((claim) => ({ ...claim, userVote: null }));
      }

      return Promise.all(
        nextClaims.map(async (claim) => {
          const result = await fetchUserVoteForClaim(claim.id, currentUser.id);

          return {
            ...claim,
            userVote: result.vote,
          };
        }),
      );
    },
    [currentUser],
  );

  // PHASE 3 STEP 9
  const applyRemoteClaims = useCallback(
    async (result: { claims: Claim[]; error?: string }, replace = false) => {
      if (result.error) {
        throw new Error(result.error);
      }

      // PHASE 3 STEP 10
      const finalizedResult = await finalizeRemoteExpiredClaims(result.claims);
      const claimsWithVotes = await applyUserVotes(finalizedResult.claims);

      setClaims((currentClaimsState) =>
        sortClaimsNewestFirst(replace ? claimsWithVotes : mergeClaimLists(currentClaimsState, claimsWithVotes)),
      );

      return claimsWithVotes;
    },
    [applyUserVotes],
  );

  // PHASE 3 STEP 11
  const fetchLatestClaims = useCallback(
    async () => {
      const nextClaims = await applyRemoteClaims(
        await fetchRemoteLatestClaimsPage(DEFAULT_CLAIMS_PAGE_SIZE, 0),
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
    setError(null);

    if (supabaseConfigError) {
      setClaims([]);
      setClaimOffset(0);
      setHasMoreClaims(false);
      setError(supabaseConfigError);
      setLoading(false);
      return;
    }

    try {
      await fetchLatestClaims();
    } catch (loadError) {
      setClaims([]);
      setClaimOffset(0);
      setHasMoreClaims(false);
      setError(loadError instanceof Error ? loadError.message : "We could not load claims right now.");
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [fetchLatestClaims]);

  // PHASE 3 STEP 11
  const loadMoreClaims = useCallback(async () => {
    if (loading || loadingMore || !hasMoreClaims) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const nextClaims = await applyRemoteClaims(
        await fetchRemoteLatestClaimsPage(DEFAULT_CLAIMS_PAGE_SIZE, claimOffset),
        false,
      );
      setClaimOffset((currentOffset) => currentOffset + nextClaims.length);
      setHasMoreClaims(nextClaims.length === DEFAULT_CLAIMS_PAGE_SIZE);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load claims. Pull to retry.");
    } finally {
      setLoadingMore(false);
    }
  }, [applyRemoteClaims, claimOffset, hasMoreClaims, loading, loadingMore]);

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
      (claim) => claim.status === "OPEN" && new Date(claim.expiresAt).getTime() <= now.getTime(),
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

  const createClaim = useCallback(async (input: CreateClaimInput) => {
    if (!currentUser) {
      throw new Error("You need an account to post.");
    }

    if (!currentUser.email_confirmed_at) {
      throw new Error("Please verify your email before posting.");
    }

    if (!profile) {
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
      profile,
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
    return createdClaim;
  }, [currentUser, profile]);

  // PHASE 3 STEP 4
  const voteOnClaim = useCallback(
    async (claimId: string, vote: VoteOption) => {
      if (!currentUser) {
        throw new Error("Log in to vote.");
      }

      if (!currentUser.email_confirmed_at) {
        throw new Error("Verify your email to vote.");
      }

      if (!profile) {
        throw new Error("Profile required to vote.");
      }

      const existingClaim = currentClaims.find((claim) => claim.id === claimId);
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
        throw new Error("Voting closed. System verdict has been calculated.");
      }

      if (refreshedClaim.claim && new Date(refreshedClaim.claim.expiresAt).getTime() <= Date.now()) {
        throw new Error("Voting closed. System verdict has been calculated.");
      }

      const result = await voteOnRemoteClaim(claimId, currentUser.id, vote);

      if (result.error || !result.claim) {
        throw new Error(result.error ?? "We could not save your vote. Please try again.");
      }

      const updatedClaim = mergeLocalClaimState(result.claim, existingClaim);
      setClaims((currentClaimsState) =>
        currentClaimsState.map((claim) => (claim.id === claimId ? updatedClaim : claim)),
      );
    },
    [currentClaims, currentUser, profile],
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

      if (!currentUser.email_confirmed_at) {
        throw new Error("Verify your email to add evidence.");
      }

      if (!profile) {
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
    [currentUser, profile],
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

      if (!currentUser.email_confirmed_at) {
        throw new Error("Verify your email to report claims.");
      }

      if (!profile) {
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
    [currentClaims, currentUser, profile],
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
      const existingClaim = currentClaims.find((claim) => claim.id === claimId);

      if (existingClaim) {
        return existingClaim;
      }

      const result = await fetchRemoteClaimById(claimId);

      if (result.error) {
        setError(result.error);
        return undefined;
      }

      if (result.claim) {
        const [loadedClaim] = await applyRemoteClaims({ claims: [result.claim] }, false);
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
      createClaim,
      voteOnClaim,
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
      fetchEvidenceForClaim,
      fetchClaimById,
      fetchClaimsByCategory,
      fetchClaimsByStatus,
      fetchLatestClaims,
      fetchReportsForClaim,
      fetchTrendingClaims,
      fetchTrendingClaimsPage,
      getClaimById,
      hasMoreClaims,
      liveUpdatesEnabled,
      loadMoreClaims,
      loading,
      loadingMore,
      now,
      reportClaim,
      refreshClaims,
      refreshClaimVerdict,
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
