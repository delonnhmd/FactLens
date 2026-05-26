// PHASE 2 STEP 2
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { mockClaims } from "../constants/mockData";
import { applyCurrentClaimStatus, canUserVote, getExpiresAt } from "../services/claimVoting";
import type { Claim, VoteOption } from "../types/claim";

export interface CreateClaimInput {
  title: string;
  description: string;
  sourceUrl: string;
  category?: string;
}

interface ClaimsContextValue {
  claims: Claim[];
  createClaim: (input: CreateClaimInput) => Claim;
  voteOnClaim: (claimId: string, vote: VoteOption) => void;
  getClaimById: (claimId: string) => Claim | undefined;
  now: Date;
}

const ClaimsContext = createContext<ClaimsContextValue | undefined>(undefined);

const localAuthor = {
  id: "local-user",
  username: "factlens_user",
  avatar: "",
};

function createLocalClaimId(): string {
  return `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function incrementVote(claim: Claim, vote: VoteOption): Claim {
  if (vote === "TRUE") {
    return { ...claim, votesTrue: claim.votesTrue + 1, userVote: vote };
  }

  if (vote === "FAKE") {
    return { ...claim, votesFake: claim.votesFake + 1, userVote: vote };
  }

  return { ...claim, votesUnsure: claim.votesUnsure + 1, userVote: vote };
}

export function ClaimsProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Claim[]>(() => mockClaims);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30 * 1000);

    return () => clearInterval(timer);
  }, []);

  const currentClaims = useMemo(
    () =>
      claims
        .map((claim) => applyCurrentClaimStatus(claim, now))
        .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
    [claims, now],
  );

  const createClaim = useCallback((input: CreateClaimInput) => {
    const createdAt = new Date().toISOString();
    const newClaim: Claim = {
      id: createLocalClaimId(),
      title: input.title.trim(),
      description: input.description.trim(),
      sourceUrl: input.sourceUrl.trim(),
      category: input.category?.trim() || undefined,
      votesTrue: 0,
      votesFake: 0,
      votesUnsure: 0,
      status: "OPEN",
      createdAt,
      expiresAt: getExpiresAt(createdAt),
      userVote: null,
      author: localAuthor,
    };

    setClaims((currentClaimsState) => [newClaim, ...currentClaimsState]);
    return newClaim;
  }, []);

  const voteOnClaim = useCallback((claimId: string, vote: VoteOption) => {
    const voteTime = new Date();

    setClaims((currentClaimsState) =>
      currentClaimsState.map((claim) => {
        if (claim.id !== claimId) {
          return claim;
        }

        const currentClaim = applyCurrentClaimStatus(claim, voteTime);

        if (!canUserVote(currentClaim, voteTime)) {
          return currentClaim;
        }

        return applyCurrentClaimStatus(incrementVote(currentClaim, vote), voteTime);
      }),
    );
  }, []);

  const getClaimById = useCallback(
    (claimId: string) => currentClaims.find((claim) => claim.id === claimId),
    [currentClaims],
  );

  const value = useMemo(
    () => ({
      claims: currentClaims,
      createClaim,
      voteOnClaim,
      getClaimById,
      now,
    }),
    [createClaim, currentClaims, getClaimById, now, voteOnClaim],
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

