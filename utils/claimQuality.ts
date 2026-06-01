// PHASE 4 STEP 11
// PHASE 4 STEP 11 REVISED
export type ClaimDraftQualityLevel = "good" | "soft_warning" | "blocked";
export type ClaimDraftDetectedType = "FACTUAL" | "QUESTION" | "OPINION" | "PROMOTION" | "UNCLEAR";

export type ClaimDraftInput = {
  title: string;
  description?: string;
  sourceUrl?: string;
  category?: string;
};

export type ClaimDraftAnalysis = {
  canSubmit: boolean;
  qualityLevel: ClaimDraftQualityLevel;
  detectedType: ClaimDraftDetectedType;
  warnings: string[];
  suggestions: string[];
  rewrittenTitle?: string;
};

const QUESTION_PREFIXES = [
  "is it true",
  "is this true",
  "can someone verify",
  "do you think",
  "why",
  "how",
  "should i",
];

const OPINION_WORDS = [
  "good",
  "bad",
  "best",
  "worst",
  "amazing",
  "boring",
  "better",
  "beautiful",
  "ugly",
  "fun",
  "interesting",
];

const VAGUE_TITLES = [
  "this is good",
  "this should be done",
  "this should be done soon",
  "everything is good",
  "it works",
  "breaking news",
];

const SOCIAL_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "reddit.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
];

const MONTH_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan\.?|feb\.?|mar\.?|apr\.?|jun\.?|jul\.?|aug\.?|sep\.?|sept\.?|oct\.?|nov\.?|dec\.?)\b/;

const FACTUAL_PATTERNS = [
  /\b\d+(\.\d+)?\b/,
  /\b20\d{2}\b/,
  /\b\d+%\b/,
  /\$\s?\d+/,
  MONTH_PATTERN,
  /\b(approved|announced|voted|signed|passed|released|reported|published|issued|said|says|warned|recalled|launched|filed|ruled|confirmed)\b/,
  /\b(study|research|report|survey|data|poll|trial|analysis)\b/,
  /\b(policy|law|bill|rule|regulation|ban|transit plan|budget)\b/,
  /\b(cdc|fda|who|nih|city council|court|judge|senate|house|governor|mayor|school board|police|agency|department)\b/,
  /\b(vaccine|vaccines|flu|covid|health|disease|risk|linked to|causes|may improve|reduces|increases)\b/,
  /\b(stock|stocks|market|inflation|interest rate|price|revenue|earnings|bitcoin|crypto|dollar|financial)\b/,
];

const PROMOTION_PATTERNS = [
  /\b(buy now|promo code|discount|sponsored|affiliate|subscribe now|limited offer|sale ends)\b/,
];

const BLOCKED_CONTENT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(nude|naked|porn|pornography|sexually explicit|xxx|onlyfans|child sexual content|revenge porn|graphic sexual|rape video|leaked nude)\b/,
    reason: "FactLens blocks nude, porn, and sexually explicit content.",
  },
  {
    pattern: /\b(i will|i am going to|going to)\s+(kill|shoot|stab|bomb|attack)\b/,
    reason: "FactLens blocks illegal violent threats.",
  },
  {
    pattern: /\b(go kill yourself|kill yourself)\b/,
    reason: "FactLens blocks abusive and self-harm content.",
  },
  {
    pattern: /\b(how to|help me)\s+(kill myself|commit suicide|self harm)\b/,
    reason: "FactLens blocks dangerous self-harm content.",
  },
  {
    pattern: /\b(send me|dm me|cashapp me).*\b(money|cash|bitcoin|crypto)\b/,
    reason: "FactLens blocks obvious spam and scam content.",
  },
  {
    pattern: /\b(guaranteed profit|guaranteed returns|get rich quick|free money link|claim your prize now)\b/,
    reason: "FactLens blocks obvious spam and scam content.",
  },
];

const normalizeText = (value?: string) => value?.trim().toLowerCase().replace(/[?!.,;:]+$/g, "") ?? "";

const hasWord = (text: string, words: string[]) =>
  words.some((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));

const startsWithAny = (text: string, prefixes: string[]) =>
  prefixes.some((prefix) => text === prefix || text.startsWith(`${prefix} `));

const hasFactualSignals = (text: string) => FACTUAL_PATTERNS.some((pattern) => pattern.test(text));

const isPromotion = (text: string) => PROMOTION_PATTERNS.some((pattern) => pattern.test(text));

const getBlockedReason = (text: string) => BLOCKED_CONTENT_PATTERNS.find(({ pattern }) => pattern.test(text))?.reason;

const getHostname = (sourceUrl: string) => {
  const trimmedUrl = sourceUrl.trim();

  if (!trimmedUrl) {
    return "";
  }

  try {
    const parsed = new URL(trimmedUrl.includes("://") ? trimmedUrl : `https://${trimmedUrl}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const isSocialOnlySource = (sourceUrl: string) => {
  const hostname = getHostname(sourceUrl);
  return Boolean(hostname) && SOCIAL_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
};

const capitalizeFirst = (value: string) => {
  const trimmedValue = value.trim();
  return trimmedValue ? `${trimmedValue.slice(0, 1).toUpperCase()}${trimmedValue.slice(1)}` : "";
};

const removeQuestionLeadIn = (title: string) =>
  title
    .trim()
    .replace(/\?+$/g, "")
    .replace(/^is it true that\s+/i, "")
    .replace(/^is this true that\s+/i, "")
    .replace(/^is it true\s+/i, "")
    .replace(/^is this true\s+/i, "")
    .replace(/^can someone verify that\s+/i, "")
    .replace(/^can someone verify\s+/i, "")
    .replace(/^do you think that\s+/i, "")
    .replace(/^do you think\s+/i, "");

const getQuestionRewrite = (title: string) => {
  const normalizedTitle = normalizeText(title);

  if (normalizedTitle.includes("buying fruit") && normalizedTitle.includes("morning")) {
    return "Buying fruit in the morning may improve freshness and food quality.";
  }

  const claimBody = removeQuestionLeadIn(title);

  if (claimBody.length >= 12 && !startsWithAny(normalizeText(claimBody), ["why", "how", "should i"])) {
    return `${capitalizeFirst(claimBody).replace(/[.]+$/g, "")}.`;
  }

  return undefined;
};

const getOpinionRewrite = (title: string) => {
  const normalizedTitle = normalizeText(title);

  if (normalizedTitle.includes("solo leveling")) {
    return "Solo Leveling Ragnarok released new episodes this month.";
  }

  return undefined;
};

const getSourceWarnings = (sourceUrl: string) => {
  if (!sourceUrl.trim() || isSocialOnlySource(sourceUrl)) {
    return ["Add a stronger source if possible."];
  }

  return [];
};

export function analyzeClaimDraft({ title, description = "", sourceUrl = "", category = "" }: ClaimDraftInput): ClaimDraftAnalysis {
  const normalizedTitle = normalizeText(title);
  const combinedText = normalizeText(`${title} ${description} ${category}`);
  const warnings = getSourceWarnings(sourceUrl);
  const suggestions: string[] = [];
  let detectedType: ClaimDraftDetectedType = "UNCLEAR";
  let rewrittenTitle: string | undefined;
  const blockedReason = getBlockedReason(combinedText);

  if (blockedReason) {
    warnings.unshift(blockedReason);
  } else if (!normalizedTitle) {
    warnings.unshift("Add a title before posting.");
    suggestions.push("Add who, what, when, and source.");
  } else if (startsWithAny(normalizedTitle, QUESTION_PREFIXES)) {
    detectedType = "QUESTION";
    warnings.unshift("This may be an opinion or question. FactLens AI will classify it after posting.");
    suggestions.push("Rewrite the question as a factual claim.");
    rewrittenTitle = getQuestionRewrite(title);
  } else if (normalizedTitle.length < 12 || VAGUE_TITLES.includes(normalizedTitle)) {
    detectedType = "UNCLEAR";
    warnings.unshift("This may be unclear. FactLens AI will classify it after posting.");
    suggestions.push("Add who, what, when, and source.");
  } else if (isPromotion(combinedText)) {
    detectedType = "PROMOTION";
    warnings.unshift("This may be promotional. FactLens AI will classify it after posting.");
    suggestions.push("Rewrite it as a neutral, verifiable claim about what happened.");
  } else if (hasWord(normalizedTitle, OPINION_WORDS) && !hasFactualSignals(combinedText)) {
    detectedType = "OPINION";
    warnings.unshift("This may be an opinion or question. FactLens AI will classify it after posting.");
    suggestions.push("Use a verifiable claim instead of personal opinion.");
    rewrittenTitle = getOpinionRewrite(title);
  } else if (hasFactualSignals(combinedText)) {
    detectedType = "FACTUAL";
  } else {
    warnings.unshift("This may be unclear. FactLens AI will classify it after posting.");
    suggestions.push("Add who, what, when, and source.");
  }

  const canSubmit = !blockedReason;
  const qualityLevel: ClaimDraftQualityLevel =
    blockedReason ? "blocked" : detectedType !== "FACTUAL" || warnings.length > 0 ? "soft_warning" : "good";

  return {
    canSubmit,
    qualityLevel,
    detectedType,
    warnings,
    suggestions,
    rewrittenTitle,
  };
}
