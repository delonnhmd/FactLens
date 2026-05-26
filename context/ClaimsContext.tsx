// PHASE 2 STEP 2
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { mockClaims } from "../constants/mockData";
import { mockUser } from "../constants/mockUser";
import { generateClaimShareUrl, generateClaimSlug, isYouTubeUrl } from "../services/claimLinks";
import { applyCurrentClaimStatus, canUserVote, getExpiresAt } from "../services/claimVoting";
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
  createClaim: (input: CreateClaimInput) => Claim;
  voteOnClaim: (claimId: string, vote: VoteOption) => void;
  addEvidence: (claimId: string, evidenceInput: EvidenceInput) => void;
  reportClaim: (claimId: string, reason: ReportReason, note: string) => void;
  getClaimById: (claimId: string) => Claim | undefined;
  now: Date;
}

const ClaimsContext = createContext<ClaimsContextValue | undefined>(undefined);

function createLocalClaimId(): string {
  return `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLocalEvidenceId(): string {
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLocalReportId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

  const createClaim = useCallback((input: CreateClaimInput) => {
    const createdAt = new Date().toISOString();
    const id = createLocalClaimId();
    const trimmedVideoUrl = input.videoUrl?.trim() || "";
    const newClaim: Claim = {
      // PHASE 2 STEP 8
      id,
      slug: generateClaimSlug(input.title),
      shareUrl: generateClaimShareUrl(id),
      title: input.title.trim(),
      description: input.description.trim(),
      sourceUrl: input.sourceUrl.trim(),
      media: {
        imageUrl: null,
        videoUrl: trimmedVideoUrl && !isYouTubeUrl(trimmedVideoUrl) ? trimmedVideoUrl : null,
        youtubeUrl: trimmedVideoUrl && isYouTubeUrl(trimmedVideoUrl) ? trimmedVideoUrl : null,
      },
      aiCheck: {
        status: "PENDING",
        confidence: null,
        reason: null,
      },
      category: input.category?.trim() || undefined,
      votesTrue: 0,
      votesFake: 0,
      votesUnsure: 0,
      status: "OPEN",
      createdAt,
      expiresAt: getExpiresAt(createdAt),
      userVote: null,
      evidence: [],
      reports: [],
      reportCount: 0,
      isFlagged: false,
      // PHASE 2 STEP 9
      authorId: mockUser.id,
      authorUsername: mockUser.username,
      authorDisplayName: mockUser.displayName,
      authorVerified: mockUser.verified,
      author: mockUser,
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

  const value = useMemo(
    () => ({
      claims: currentClaims,
      createClaim,
      voteOnClaim,
      addEvidence,
      reportClaim,
      getClaimById,
      now,
    }),
    [addEvidence, createClaim, currentClaims, getClaimById, now, reportClaim, voteOnClaim],
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
