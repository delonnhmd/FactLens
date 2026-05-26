// PHASE 2 STEP 1
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { mockClaims } from "../constants/mockData";
import { applyCurrentClaimStatus, canUserVote } from "../services/claimVoting";
import type { Claim, VoteOption } from "../types/claim";

interface ClaimsContextValue {
  claims: Claim[];
  castVote: (claimId: string, vote: VoteOption) => void;
  getClaimById: (claimId: string) => Claim | undefined;
  now: Date;
}

const ClaimsContext = createContext<ClaimsContextValue | undefined>(undefined);

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

  const currentClaims = useMemo(() => claims.map((claim) => applyCurrentClaimStatus(claim, now)), [claims, now]);

  const castVote = useCallback((claimId: string, vote: VoteOption) => {
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
      castVote,
      getClaimById,
      now,
    }),
    [castVote, currentClaims, getClaimById, now],
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

