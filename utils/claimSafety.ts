export type ClaimSafetyCategory = "VIOLENCE" | "HARASSMENT" | "SEXUAL" | "SPAM" | null;

export interface ClaimSafetyResult {
  allowed: boolean;
  reason: string | null;
  category: ClaimSafetyCategory;
}

export const CLAIM_SAFETY_VIOLENCE_MESSAGE =
  "This claim may contain violent or threatening language. Please rewrite it before posting.";

const PERSON_OR_GROUP =
  "(?:he|she|they|them|him|her|someone|somebody|everyone|everybody|anyone|anybody|people|person|president|senator|representative|governor|mayor|judge|candidate|minister|officer|cop|police|teacher|doctor|boss|neighbor|family|group)";

const DIRECT_TARGET = "(?:him|her|them|you|us|me)";

const VIOLENCE_PATTERNS: RegExp[] = [
  /\b(?:i will|we will|i am going to|we are going to|going to)\s+(?:kill|shoot|stab|bomb|attack)\b/i,
  new RegExp(
    `\\b(?:the\\s+)?${PERSON_OR_GROUP}\\s+(?:need(?:s)?\\s+to|should|must|has\\s+to|have\\s+to|deserves?\\s+to)\\s+(?:be\\s+)?(?:killed|murdered|shot|stabbed|executed|assassinated|hanged|hung|die)\\b`,
    "i",
  ),
  new RegExp(
    "\\b(?:need(?:s)?\\s+to|should|must|has\\s+to|have\\s+to|deserves?\\s+to)\\s+die\\b",
    "i",
  ),
  new RegExp(
    `\\b(?:kill|shoot|stab|execute|assassinate|hang|murder)\\s+${DIRECT_TARGET}\\b`,
    "i",
  ),
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

export function checkClaimSafety(title: string, description: string): ClaimSafetyResult {
  const text = `${title || ""} ${description || ""}`;

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
