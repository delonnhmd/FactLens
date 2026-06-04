// PHASE 3 STEP 22
// PHASE 3 STEP 24
// PHASE 3 STEP 29
import {
  DEFAULT_VERIFICATION_MODE,
  PRODUCTION_VERIFICATION_CONFIG,
  TEST_VERIFICATION_CONFIG,
  VERIFICATION_MODE,
  getVerificationModeConfig,
} from "../constants/verificationConfig";
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
  // PHASE 4 STEP 26
  voteWindowEnd?: string | null;
  vote_window_end?: string | null;
};

export interface VerificationTiming {
  mode: VerificationMode;
  createdAt: string;
  expiresAt: string;
  voteAcceptUntil: string;
  // PHASE 4 STEP 26
  voteWindowEnd: string;
  voteWindowMinutes: number;
  scoreLockAt: string;
  minVotesRequired: number;
  expectedParticipation: number;
}

function normalizeMode(mode: VerificationMode | string | null | undefined): VerificationMode {
  // PHASE 4 STEP 26
  if (mode === "test" || mode === "production") {
    return mode;
  }

  return DEFAULT_VERIFICATION_MODE;
}

function isValidDateString(value: string | null | undefined): value is string {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

function addMs(isoDate: string, ms: number): string {
  return new Date(new Date(isoDate).getTime() + ms).toISOString();
}

function addMinutes(isoDate: string, minutes: number): string {
  return addMs(isoDate, minutes * 60 * 1000);
}

function getCreatedAt(input: TimingInput): string {
  const createdAt = input.createdAt ?? input.created_at;
  return isValidDateString(createdAt) ? createdAt : new Date().toISOString();
}

function createTiming(mode: VerificationMode, createdAt = new Date().toISOString()): VerificationTiming {
  const config = mode === "production" ? PRODUCTION_VERIFICATION_CONFIG : TEST_VERIFICATION_CONFIG;
  const voteAcceptUntil = addMinutes(createdAt, config.voteWindowMinutes);
  const scoreLockAt = addMinutes(createdAt, config.scoreLockMinutes);
  const expiresAt = addMinutes(createdAt, config.expiresMinutes);

  return {
    mode,
    createdAt,
    expiresAt,
    voteAcceptUntil,
    voteWindowEnd: voteAcceptUntil,
    voteWindowMinutes: config.voteWindowMinutes,
    scoreLockAt,
    minVotesRequired: config.minVotesRequired,
    expectedParticipation: config.expectedParticipation,
  };
}

export function createClaimTiming(mode: VerificationMode = VERIFICATION_MODE): VerificationTiming {
  return createTiming(mode, new Date().toISOString());
}

export function createTestModeTiming(createdAt = new Date().toISOString()): VerificationTiming {
  return createTiming("test", createdAt);
}

export function createProductionModeTiming(createdAt = new Date().toISOString()): VerificationTiming {
  return createTiming("production", createdAt);
}

export function getVoteAcceptUntil(claim: TimingInput): string {
  // PHASE 4 STEP 26
  const explicitValue = claim.voteAcceptUntil ?? claim.vote_accept_until ?? claim.voteWindowEnd ?? claim.vote_window_end;

  if (isValidDateString(explicitValue)) {
    return explicitValue;
  }

  const mode = normalizeMode(claim.mode);
  const config = getVerificationModeConfig(mode);
  return addMs(getCreatedAt(claim), config.phase4StartMs);
}

export function getScoreLockAt(claim: TimingInput): string {
  const explicitValue = claim.scoreLockAt ?? claim.score_lock_at;

  if (isValidDateString(explicitValue)) {
    return explicitValue;
  }

  const mode = normalizeMode(claim.mode);
  const config = getVerificationModeConfig(mode);
  return addMs(getCreatedAt(claim), config.publishMs);
}
