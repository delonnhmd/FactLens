// PHASE 2 STEP 2
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { applyCurrentClaimStatus } from "../services/claimVoting";
import {
  createClaim as createRemoteClaim,
  fetchClaimsByCategory as fetchRemoteClaimsByCategory,
  fetchClaimsByStatus as fetchRemoteClaimsByStatus,
  fetchClaimById as fetchRemoteClaimById,
  fetchLatestClaims as fetchRemoteLatestClaims,
  fetchTrendingClaims as fetchRemoteTrendingClaims,
  searchClaims as searchRemoteClaims,
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
  fetchLatestClaims: () => Promise<Claim[]>;
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

export function ClaimsProvider({ children }: { children: ReactNode }) {
  // PHASE 3 STEP 3
  const { currentUser, profile } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

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

      const claimsWithVotes = await applyUserVotes(result.claims);

      setClaims((currentClaimsState) =>
        replace ? claimsWithVotes : mergeClaimLists(currentClaimsState, claimsWithVotes),
      );

      return claimsWithVotes;
    },
    [applyUserVotes],
  );

  // PHASE 3 STEP 9
  const fetchLatestClaims = useCallback(
    async () => applyRemoteClaims(await fetchRemoteLatestClaims(), true),
    [applyRemoteClaims],
  );

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await fetchLatestClaims();
    } catch (loadError) {
      setClaims([]);
      setError(loadError instanceof Error ? loadError.message : "We could not load claims right now.");
    }

    setLoading(false);
  }, [fetchLatestClaims]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30 * 1000);

    return () => clearInterval(timer);
  }, []);

  // PHASE 3 STEP 3
  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  // PHASE 2 STEP 3
  useEffect(() => {
    setClaims((currentClaimsState) => {
      let changed = false;
      const updatedClaims = currentClaimsState.map((claim) => {
        const updatedClaim = applyCurrentClaimStatus(claim, now);

        if (updatedClaim.status !== claim.status) {
          changed = true;
        }

        return updatedClaim;
      });

      return changed ? updatedClaims : currentClaimsState;
    });
  }, [now]);

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
    setClaims((currentClaimsState) => [
      createdClaim,
      ...currentClaimsState.filter((claim) => claim.id !== createdClaim.id),
    ]);
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

      if (existingClaim && new Date(existingClaim.expiresAt).getTime() <= Date.now()) {
        throw new Error("Voting is closed for this claim.");
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
        const loadedClaim = (await applyUserVotes([result.claim]))[0];
        setClaims((currentClaimsState) => [
          loadedClaim,
          ...currentClaimsState.filter((claim) => claim.id !== loadedClaim.id),
        ]);
        return loadedClaim;
      }

      return undefined;
    },
    [applyUserVotes, currentClaims],
  );

  const value = useMemo(
    () => ({
      claims: currentClaims,
      loading,
      error,
      createClaim,
      voteOnClaim,
      fetchEvidenceForClaim,
      addEvidence,
      fetchReportsForClaim,
      reportClaim,
      searchClaims,
      fetchClaimsByCategory,
      fetchClaimsByStatus,
      fetchTrendingClaims,
      fetchLatestClaims,
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
      getClaimById,
      loading,
      now,
      reportClaim,
      searchClaims,
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
