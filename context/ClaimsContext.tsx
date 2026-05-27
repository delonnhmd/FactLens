// PHASE 2 STEP 2
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { applyCurrentClaimStatus } from "../services/claimVoting";
import {
  createClaim as createRemoteClaim,
  fetchClaimById as fetchRemoteClaimById,
  fetchClaims as fetchRemoteClaims,
} from "../services/claimService";
import {
  fetchUserVoteForClaim,
  voteOnClaim as voteOnRemoteClaim,
} from "../services/voteService";
import type { Claim, EvidenceType, ReportReason, VoteOption } from "../types/claim";

export interface CreateClaimInput {
  title: string;
  description: string;
  sourceUrl: string;
  videoUrl?: string;
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
  addEvidence: (claimId: string, evidenceInput: EvidenceInput) => void;
  reportClaim: (claimId: string, reason: ReportReason, note: string) => void;
  getClaimById: (claimId: string) => Claim | undefined;
  fetchClaimById: (claimId: string) => Promise<Claim | undefined>;
  now: Date;
}

const ClaimsContext = createContext<ClaimsContextValue | undefined>(undefined);

function createLocalEvidenceId(): string {
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLocalReportId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeLocalClaimState(remoteClaim: Claim, existingClaim?: Claim): Claim {
  if (!existingClaim) {
    return remoteClaim;
  }

  return {
    ...remoteClaim,
    evidence: existingClaim.evidence,
    reports: existingClaim.reports,
    reportCount: existingClaim.reportCount,
    isFlagged: existingClaim.isFlagged,
  };
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

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchRemoteClaims();

    if (result.error) {
      setClaims([]);
      setError(result.error);
    } else {
      const claimsWithVotes = await applyUserVotes(result.claims);
      setClaims(claimsWithVotes);
    }

    setLoading(false);
  }, [applyUserVotes]);

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

  // PHASE 2 STEP 4
  const addEvidence = useCallback((claimId: string, evidenceInput: EvidenceInput) => {
    const newEvidence = {
      id: createLocalEvidenceId(),
      url: evidenceInput.url.trim(),
      note: evidenceInput.note.trim(),
      type: evidenceInput.type,
      createdAt: new Date().toISOString(),
    };

    setClaims((currentClaimsState) =>
      currentClaimsState.map((claim) =>
        claim.id === claimId
          ? {
              ...claim,
              evidence: [newEvidence, ...claim.evidence],
            }
          : claim,
      ),
    );
  }, []);

  // PHASE 2 STEP 6
  const reportClaim = useCallback((claimId: string, reason: ReportReason, note: string) => {
    const newReport = {
      id: createLocalReportId(),
      claimId,
      reason,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    setClaims((currentClaimsState) =>
      currentClaimsState.map((claim) => {
        if (claim.id !== claimId) {
          return claim;
        }

        const reports = [newReport, ...claim.reports];
        const reportCount = reports.length;

        return {
          ...claim,
          reports,
          reportCount,
          isFlagged: reportCount >= 3,
        };
      }),
    );
  }, []);

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
      addEvidence,
      reportClaim,
      getClaimById,
      fetchClaimById,
      now,
    }),
    [
      addEvidence,
      createClaim,
      currentClaims,
      error,
      fetchClaimById,
      getClaimById,
      loading,
      now,
      reportClaim,
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
