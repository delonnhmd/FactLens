import { findModerationBlocklistMatch } from "./moderationBlocklist";

export type ClaimSafetyCategory = "VIOLENCE" | "HARASSMENT" | "SEXUAL" | "SPAM" | null;

export interface ClaimSafetyResult {
  allowed: boolean;
  reason: string | null;
  category: ClaimSafetyCategory;
}

export const CLAIM_SAFETY_VIOLENCE_MESSAGE =
  "This claim may contain violent or threatening language. Please rewrite it before posting.";
const CLAIM_SAFETY_BLOCKLIST_MESSAGE = "This content is not allowed on Verifact.";

// Keep these patterns in lockstep with the backend's INDIRECT_VIOLENCE_PATTERNS
// in backend/services/content_safety.py — both are exercised by the same
// must-block / must-allow lists (utils/__tests__/claimSafety.test.ts and
// backend/tests/test_content_safety_patterns.py). The base-form verb lists
// (kill, shoot, …) deliberately exclude past participles (killed, shot) so
// factual reporting like "the victim was killed" is NOT blocked.
const PERSON_OR_GROUP =
  "(?:he|she|they|them|him|her|someone|somebody|everyone|everybody|anyone|anybody|people|person|president|senator|representative|governor|mayor|judge|candidate|minister|officer|cop|police|teacher|doctor|boss|neighbor|family|group|politician|congressman|congresswoman)";

const VIOLENCE_VERB = "(?:kill|shoot|stab|execute|assassinate|hang|murder|behead|lynch|strangle|slaughter)";

// Targets include third-person pronouns AND person nouns (optionally preceded by
// "the"), so "assassinate the president" / "shoot the officer" are caught while
// "kill jobs" / "killed the bill" are not (jobs/bill are not persons).
const DIRECT_TARGET =
  "(?:him|her|them|you|us|me|president|senator|representative|governor|mayor|judge|candidate|minister|officer|cop|police|politician|congressman|congresswoman|prime\\s+minister)";

const VIOLENCE_PATTERNS: RegExp[] = [
  // 1. First-person / group stated intent: "I will kill", "we are going to shoot".
  // Contraction remnants (m going to / re going to / ll) appear because
  // normalizeForMatch() turns apostrophes into spaces before matching.
  /\b(?:i|we)\s+(?:will|shall|am going to|are going to|m going to|re going to|ll|gonna|plan to|want to|intend to)\s+(?:kill|shoot|stab|bomb|attack|murder|assassinate|behead|lynch)\b/i,
  /\bgoing to\s+(?:kill|shoot|stab|bomb|attack|murder|assassinate)\b/i,
  // 2. Advocacy / wish that a person or group be killed (incl. third-person phrasing).
  new RegExp(
    `\\b(?:the\\s+)?${PERSON_OR_GROUP}\\s+(?:need(?:s)?\\s+to|should|must|has\\s+to|have\\s+to|deserves?\\s+to|ought\\s+to|gotta)\\s+(?:be\\s+)?(?:killed|murdered|shot|stabbed|executed|assassinated|hanged|hung|lynched|beheaded|die|died|dead)\\b`,
    "i",
  ),
  // 3. Bare "... should/needs to die".
  new RegExp(
    "\\b(?:need(?:s)?\\s+to|should|must|has\\s+to|have\\s+to|deserves?\\s+to|ought\\s+to)\\s+die\\b",
    "i",
  ),
  // 4. Imperative / command to attack a target (base-form verb keeps past-tense reporting safe).
  new RegExp(
    `\\b${VIOLENCE_VERB}\\s+(?:the\\s+)?${DIRECT_TARGET}\\b`,
    "i",
  ),
  // 5. Literal death threat.
  /\bdeath\s+threat\b/i,
];

const HARASSMENT_PATTERNS: RegExp[] = [
  /\b(?:go kill yourself|kill yourself|go die)\b/i,
  /\b(?:how to|help me)\s+(?:kill myself|commit suicide|self harm)\b/i,
];

const SPAM_PATTERNS: RegExp[] = [
  /\b(?:send me|dm me|cashapp me).*\b(?:money|cash|bitcoin|crypto)\b/i,
  /\b(?:guaranteed profit|guaranteed returns|get rich quick|free money link|claim your prize now|buy followers)\b/i,
];

// Mirror of the backend's _normalize_for_match: lowercase, turn any punctuation
// into a space, and collapse runs of whitespace. This defeats simple evasions
// like "he,need.to!be?killed" and keeps client detection in lockstep with the
// server. Unicode-normalized first so look-alike/combining forms fold down.
function normalizeForMatch(value: string): string {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkClaimSafety(title: string, description: string): ClaimSafetyResult {
  const text = normalizeForMatch(`${title || ""} ${description || ""}`);
  const blocklistMatch = findModerationBlocklistMatch(text);

  if (blocklistMatch) {
    return {
      allowed: false,
      reason: blocklistMatch.category === "VIOLENCE" ? CLAIM_SAFETY_VIOLENCE_MESSAGE : CLAIM_SAFETY_BLOCKLIST_MESSAGE,
      category: blocklistMatch.category,
    };
  }

  if (VIOLENCE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      reason: CLAIM_SAFETY_VIOLENCE_MESSAGE,
      category: "VIOLENCE",
    };
  }

  if (HARASSMENT_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      reason: "This content is not allowed on Verifact.",
      category: "HARASSMENT",
    };
  }

  if (SPAM_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      reason: "This content is not allowed on Verifact.",
      category: "SPAM",
    };
  }

  return {
    allowed: true,
    reason: null,
    category: null,
  };
}
