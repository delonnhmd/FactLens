// PHASE 3 STEP 8
// PHASE 3 STEP 28
// PHASE 4 STEP 11 REVISED
// PHASE 4 STEP 13B
import { APP_CONFIG } from "../constants/appConfig";
import { PROHIBITED_CONTENT } from "../constants/contentRules";
import { isSupportedVideoUrl } from "./videoUrl";
import { isValidSourceUrl, normalizeUrl } from "./url";

export interface ClaimContentValidationInput {
  title: string;
  description: string;
  sourceUrl: string;
  videoUrl?: string;
  category?: string;
}

interface ClaimContentValidationResult {
  ok: boolean;
  errors: string[];
}

const BLOCKED_CONTENT_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\b(i will|i am going to|going to)\s+(kill|shoot|stab|bomb|attack)\b/i,
    message: "This content is not allowed on FactLens.",
  },
  {
    pattern: /\b(go kill yourself|kill yourself)\b/i,
    message: "This content is not allowed on FactLens.",
  },
  {
    pattern: /\b(how to|help me)\s+(kill myself|commit suicide|self harm)\b/i,
    message: "This content is not allowed on FactLens.",
  },
  {
    pattern: /\b(send me|dm me|cashapp me).*\b(money|cash|bitcoin|crypto)\b/i,
    message: "This content is not allowed on FactLens.",
  },
  {
    pattern: /\b(guaranteed profit|guaranteed returns|get rich quick|free money link|claim your prize now)\b/i,
    message: "This content is not allowed on FactLens.",
  },
];

function containsProhibitedTerm(value: string): boolean {
  const normalizedValue = value.toLowerCase();
  return PROHIBITED_CONTENT.some((term) => normalizedValue.includes(term.toLowerCase()));
}

function containsBlockedPattern(value: string): boolean {
  return BLOCKED_CONTENT_PATTERNS.some(({ pattern }) => pattern.test(value));
}

export function validateClaimContent(input: ClaimContentValidationInput): ClaimContentValidationResult {
  const errors: string[] = [];
  const title = input.title.trim();
  const description = input.description.trim();
  const sourceUrl = normalizeUrl(input.sourceUrl);
  const videoUrl = normalizeUrl(input.videoUrl ?? "");

  if (!title) {
    errors.push("Title is required.");
  } else if (title.length > 160) {
    errors.push("Title must be 160 characters or fewer.");
  }

  if (!description) {
    errors.push("Description is required.");
  } else if (description.length > 1000) {
    errors.push("Description must be 1000 characters or fewer.");
  }

  if (!sourceUrl && !APP_CONFIG.TEST_MODE) {
    errors.push("Source URL is required.");
  } else if (sourceUrl && !isValidSourceUrl(sourceUrl)) {
    errors.push("Enter a valid source URL.");
  }

  if (videoUrl && !isSupportedVideoUrl(videoUrl)) {
    errors.push("Enter a valid video URL, like youtube.com/watch or tiktok.com/@user/video.");
  }

  if (containsProhibitedTerm(`${title} ${description}`) || containsBlockedPattern(`${title} ${description}`)) {
    errors.push("This content is not allowed on FactLens.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
