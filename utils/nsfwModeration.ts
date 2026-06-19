export type NsfwModerationResult = {
  blocked: boolean;
  category: string;
  confidence: number;
  reason: string;
};

type NsfwRule = {
  category: string;
  confidence: number;
  reason: string;
  patterns: RegExp[];
};

const BLOCK_THRESHOLD = 0.95;

const SAFE_PHRASE_PATTERNS = [
  /\bwith the naked eye\b/g,
  /\bvisible to the naked eye\b/g,
  /\bnaked eye\b/g,
  /\bnaked mole rat\b/g,
  /\bnaked seed\b/g,
  /\bnaked dna\b/g,
  /\bnaked singularity\b/g,
];

const SAFE_CONTEXT_PATTERNS = [
  /\bbreast cancer\b/g,
  /\bsex education\b/g,
  /\bsexual education\b/g,
  /\bpregnancy\b/g,
  /\banatomy\b/g,
  /\bhuman body\b/g,
  /\bbiology\b/g,
  /\bmedical\b/g,
  /\bhealth\b/g,
  /\bscience\b/g,
  /\beducational\b/g,
];

const OBVIOUS_ADULT_KEYWORD_PATTERNS = [
  /\bporn(?:ography|ographic)?\b/,
  /\bxxx\b/,
  /\bsexually explicit\b/,
  /\bexplicit sexual\b/,
  /\bsexual acts?\b/,
  /\bsexual services?\b/,
  /\berotic\b/,
  /\bnudes?\b/,
  /\bnaked\b/,
  /\bgenitals?\b/,
  /\bgenital exposure\b/,
  /\bleaked nudes?\b/,
  /\brevenge porn\b/,
  /\bchild sexual content\b/,
  /\bgraphic sexual\b/,
  /\brape video\b/,
];

const MEDIA_CONTEXT = "(photo|photos|pic|pics|picture|pictures|image|images|video|videos|clip|clips|content|selfie|selfies)";
const EXPLICIT_CONTEXT = "(explicit|graphic|exposed|exposure|leaked|revenge)";
const PORN_MEDIA_CONTEXT = "(video|videos|photo|photos|pic|pics|image|images|clip|clips|content|site|sites|website|movie|movies)";

const HIGH_CONFIDENCE_NSFW_RULES: NsfwRule[] = [
  {
    category: "pornography",
    confidence: 0.99,
    reason: "High-confidence pornography keyword detected.",
    patterns: [
      /^porn(?:ography|ographic)?$/,
      new RegExp(`\\bporn(?:ography|ographic)?\\b(?:\\W+\\w+){0,4}\\W+\\b${PORN_MEDIA_CONTEXT}\\b`),
      new RegExp(`\\b${PORN_MEDIA_CONTEXT}\\b(?:\\W+\\w+){0,4}\\W+\\bporn(?:ography|ographic)?\\b`),
      /\b(watch|stream|download|share|upload)\b(?:\W+\w+){0,4}\W+\bporn(?:ography|ographic)?\b/,
      /\bxxx\b/,
      /\brevenge porn\b/,
    ],
  },
  {
    category: "nudity",
    confidence: 0.98,
    reason: "High-confidence nude media keyword detected.",
    patterns: [
      new RegExp(`\\bnudes?\\b(?:\\W+\\w+){0,4}\\W+\\b${MEDIA_CONTEXT}\\b`),
      new RegExp(`\\b${MEDIA_CONTEXT}\\b(?:\\W+\\w+){0,4}\\W+\\bnudes?\\b`),
      /\bleaked nudes?\b/,
    ],
  },
  {
    category: "nudity",
    confidence: 0.97,
    reason: "High-confidence nudity context detected.",
    patterns: [
      /\bnaked body\b/,
      new RegExp(`\\bnaked\\b(?:\\W+\\w+){0,4}\\W+\\b${MEDIA_CONTEXT}\\b`),
      new RegExp(`\\b${MEDIA_CONTEXT}\\b(?:\\W+\\w+){0,4}\\W+\\bnaked\\b`),
    ],
  },
  {
    category: "explicit_sexual_acts",
    confidence: 0.98,
    reason: "High-confidence explicit sexual act keyword detected.",
    patterns: [
      /\bsexually explicit\b/,
      /\bexplicit sexual content\b/,
      /\bexplicit sexual acts?\b/,
      /\bgraphic sexual\b/,
      /\bchild sexual content\b/,
      /\brape video\b/,
    ],
  },
  {
    category: "sexual_services",
    confidence: 0.98,
    reason: "High-confidence sexual services keyword detected.",
    patterns: [/\bsexual services?\b/, /\bescort services?\b/, /\bprostitution\b/],
  },
  {
    category: "erotic_description",
    confidence: 0.97,
    reason: "High-confidence erotic description keyword detected.",
    patterns: [/\berotic\b(?:\W+\w+){0,4}\W+\b(description|story|content|scene|scenes)\b/],
  },
  {
    category: "graphic_genital_exposure",
    confidence: 0.98,
    reason: "High-confidence graphic genital exposure keyword detected.",
    patterns: [
      new RegExp(`\\bgenitals?\\b(?:\\W+\\w+){0,4}\\W+\\b(?:${EXPLICIT_CONTEXT}|${MEDIA_CONTEXT})\\b`),
      new RegExp(`\\b(?:${EXPLICIT_CONTEXT}|${MEDIA_CONTEXT})\\b(?:\\W+\\w+){0,4}\\W+\\bgenitals?\\b`),
      /\bgenital exposure\b/,
    ],
  },
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function removeSafeContext(value: string): string {
  const valueWithoutSafePhrases = SAFE_PHRASE_PATTERNS.reduce(
    (currentValue, pattern) => currentValue.replace(pattern, " "),
    value,
  );

  return SAFE_CONTEXT_PATTERNS.reduce(
    (currentValue, pattern) => currentValue.replace(pattern, " "),
    valueWithoutSafePhrases,
  );
}

export function hasObviousAdultKeywords(value: string): boolean {
  const normalizedValue = removeSafeContext(normalizeText(value));
  return OBVIOUS_ADULT_KEYWORD_PATTERNS.some((pattern) => pattern.test(normalizedValue));
}

function allowResult(confidence = 0, reason = "No high-confidence NSFW content detected."): NsfwModerationResult {
  return {
    blocked: false,
    category: "none",
    confidence,
    reason,
  };
}

export function moderateNsfwContent(value: string): NsfwModerationResult {
  const normalizedValue = removeSafeContext(normalizeText(value));

  if (!normalizedValue || !hasObviousAdultKeywords(normalizedValue)) {
    return allowResult(0, "No obvious adult keywords detected.");
  }

  const matchedRule = HIGH_CONFIDENCE_NSFW_RULES.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(normalizedValue)),
  );

  if (!matchedRule || matchedRule.confidence < BLOCK_THRESHOLD) {
    return allowResult(matchedRule?.confidence ?? 0.5);
  }

  return {
    blocked: true,
    category: matchedRule.category,
    confidence: matchedRule.confidence,
    reason: matchedRule.reason,
  };
}
