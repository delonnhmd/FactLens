// PHASE 3 STEP 22
import { DEFAULT_VERIFICATION_MODE, getVerificationModeConfig } from "../constants/verificationConfig";
import type { VerificationMode } from "../types/verification";

type TimingInput = {
  createdAt?: string | null;
  created_at?: string | null;
  expiresAt?: string | null;
  expires_at?: string | null;
  mode?: VerificationMode | string | null;
  voteAcceptUntil?: string | null;
  vote_accept_until?: string | null;
  scoreLockAt?: string | null;
  score_lock_at?: string | null;
};

export interface VerificationTiming {
  mode: VerificationMode;
  createdAt: string;
  expiresAt: string;
  voteAcceptUntil: string;
  scoreLockAt: string;
  minVotesRequired: number;
  expectedParticipation: number;
}

function normalizeMode(mode: VerificationMode | string | null | undefined): VerificationMode {
  return mode === "production" ? "production" : DEFAULT_VERIFICATION_MODE;
}

function isValidDateString(value: string | null | undefined): value is string {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

function addMs(isoDate: string, ms: number): string {
  return new Date(new Date(isoDate).getTime() + ms).toISOString();
}

function getCreatedAt(input: TimingInput): string {
  const createdAt = input.createdAt ?? input.created_at;
  return isValidDateString(createdAt) ? createdAt : new Date().toISOString();
}

function createTiming(mode: VerificationMode, createdAt = new Date().toISOString()): VerificationTiming {
  const config = getVerificationModeConfig(mode);
  const voteAcceptUntil = addMs(createdAt, config.phase4StartMs);
  const scoreLockAt = addMs(createdAt, config.publishMs);

  return {
    mode,
    createdAt,
    expiresAt: scoreLockAt,
    voteAcceptUntil,
    scoreLockAt,
    minVotesRequired: config.minVotes,
    expectedParticipation: config.expectedParticipation,
  };
}

export function createTestModeTiming(createdAt = new Date().toISOString()): VerificationTiming {
  return createTiming("test", createdAt);
}

export function createProductionModeTiming(createdAt = new Date().toISOString()): VerificationTiming {
  return createTiming("production", createdAt);
}

export function getVoteAcceptUntil(claim: TimingInput): string {
  const explicitValue = claim.voteAcceptUntil ?? claim.vote_accept_until;

  if (isValidDateString(explicitValue)) {
    return explicitValue;
  }

  const mode = normalizeMode(claim.mode);
  const config = getVerificationModeConfig(mode);
  return addMs(getCreatedAt(claim), config.phase4StartMs);
}

export function getScoreLockAt(claim: TimingInput): string {
  const explicitValue = claim.scoreLockAt ?? claim.score_lock_at ?? claim.expiresAt ?? claim.expires_at;

  if (isValidDateString(explicitValue)) {
    return explicitValue;
  }

  const mode = normalizeMode(claim.mode);
  const config = getVerificationModeConfig(mode);
  return addMs(getCreatedAt(claim), config.publishMs);
}
