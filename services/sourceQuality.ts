// PHASE 2 STEP 5
// PHASE 4 STEP 9
// PHASE 4 STEP 18
export type SourceQualityLabel =
  | "Tier 1 - Authoritative"
  | "Tier 2 - Established"
  | "Tier 3 - Mixed"
  | "Tier 4 - Low credibility"
  | "Strong Source"
  | "Medium Source"
  | "Social Source"
  | "Weak Source"
  | "Unknown Source"
  | "Unknown source"
  | "Invalid URL";

export interface SourceQuality {
  label: SourceQualityLabel;
  score: number;
  reason: string;
  lean: string;
}

type DomainCredibility = {
  score: number;
  quality: SourceQualityLabel;
  lean: string;
};

// PHASE 4 STEP 18
const OFFICIAL_DOMAINS = [
  "who.int",
  "cdc.gov",
  "fda.gov",
  "sec.gov",
  "federalreserve.gov",
  "nih.gov",
  "nasa.gov",
  "noaa.gov",
  "irs.gov",
  "treasury.gov",
  "harvard.edu",
  "stanford.edu",
  "mit.edu",
  "berkeley.edu",
];

const SPECIALIZED_DOMAINS = ["healthline.com", "mayoclinic.org", "clevelandclinic.org", "webmd.com", "investopedia.com"];
const MAINSTREAM_DOMAINS = ["nbcnews.com", "cbsnews.com", "abcnews.go.com", "abcnews.com", "usatoday.com"];
const SOCIAL_DOMAINS = ["youtube.com", "youtu.be", "tiktok.com", "x.com", "twitter.com", "facebook.com", "fb.watch", "instagram.com", "reddit.com"];

const DOMAIN_LIBRARY: Record<string, DomainCredibility> = {
  "reuters.com": { score: 98, quality: "Tier 1 - Authoritative", lean: "Center" },
  "apnews.com": { score: 97, quality: "Tier 1 - Authoritative", lean: "Center" },
  "c-span.org": { score: 97, quality: "Tier 1 - Authoritative", lean: "Center" },
  "bbc.com": { score: 95, quality: "Tier 1 - Authoritative", lean: "Center" },
  "pbs.org": { score: 94, quality: "Tier 1 - Authoritative", lean: "Center" },
  "economist.com": { score: 92, quality: "Tier 1 - Authoritative", lean: "Center" },
  "npr.org": { score: 92, quality: "Tier 1 - Authoritative", lean: "Center-left" },
  "wsj.com": { score: 90, quality: "Tier 1 - Authoritative", lean: "Center-right" },
  "nytimes.com": { score: 88, quality: "Tier 1 - Authoritative", lean: "Center-left" },
  "politico.com": { score: 88, quality: "Tier 1 - Authoritative", lean: "Center" },
  "axios.com": { score: 87, quality: "Tier 1 - Authoritative", lean: "Center" },
  "washingtonpost.com": { score: 87, quality: "Tier 1 - Authoritative", lean: "Center-left" },
  "theatlantic.com": { score: 80, quality: "Tier 2 - Established", lean: "Center-left" },
  "foxnews.com": { score: 78, quality: "Tier 2 - Established", lean: "Right" },
  "nationalreview.com": { score: 74, quality: "Tier 2 - Established", lean: "Right" },
  "newsweek.com": { score: 74, quality: "Tier 2 - Established", lean: "Center-left" },
  "cnn.com": { score: 76, quality: "Tier 2 - Established", lean: "Left" },
  "msnbc.com": { score: 72, quality: "Tier 2 - Established", lean: "Left" },
  "nypost.com": { score: 70, quality: "Tier 2 - Established", lean: "Right" },
  "realclearpolitics.com": { score: 70, quality: "Tier 2 - Established", lean: "Center-right" },
  "washingtonexaminer.com": { score: 68, quality: "Tier 2 - Established", lean: "Right" },
  "thehill.com": { score: 82, quality: "Tier 2 - Established", lean: "Center" },
  "vox.com": { score: 72, quality: "Tier 3 - Mixed", lean: "Left" },
  "huffpost.com": { score: 65, quality: "Tier 3 - Mixed", lean: "Left" },
  "motherjones.com": { score: 66, quality: "Tier 3 - Mixed", lean: "Left" },
  "thenation.com": { score: 62, quality: "Tier 3 - Mixed", lean: "Left" },
  "slate.com": { score: 68, quality: "Tier 3 - Mixed", lean: "Left" },
  "salon.com": { score: 60, quality: "Tier 3 - Mixed", lean: "Left" },
  "dailywire.com": { score: 60, quality: "Tier 3 - Mixed", lean: "Right" },
  "thefederalist.com": { score: 58, quality: "Tier 3 - Mixed", lean: "Right" },
  "dailycaller.com": { score: 58, quality: "Tier 3 - Mixed", lean: "Right" },
  "townhall.com": { score: 55, quality: "Tier 3 - Mixed", lean: "Right" },
  "newsmax.com": { score: 52, quality: "Tier 3 - Mixed", lean: "Right" },
  "breitbart.com": { score: 35, quality: "Tier 4 - Low credibility", lean: "Right" },
  "mediamatters.org": { score: 38, quality: "Tier 4 - Low credibility", lean: "Left" },
  "shareblue.com": { score: 25, quality: "Tier 4 - Low credibility", lean: "Left" },
  "palmerreport.com": { score: 20, quality: "Tier 4 - Low credibility", lean: "Left" },
  "oann.com": { score: 30, quality: "Tier 4 - Low credibility", lean: "Right" },
  "thegatewaypundit.com": { score: 10, quality: "Tier 4 - Low credibility", lean: "Right" },
  "infowars.com": { score: 5, quality: "Tier 4 - Low credibility", lean: "Right" },
};

function getHostname(url: string): string | null {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedUrl.includes("://") ? trimmedUrl : `https://${trimmedUrl}`);
    return parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function findDomainCredibility(hostname: string): DomainCredibility | null {
  const matchedDomain = Object.keys(DOMAIN_LIBRARY).find(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  return matchedDomain ? DOMAIN_LIBRARY[matchedDomain] : null;
}

// PHASE 4 STEP 18
function hostnameMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function hostnameMatchesAny(hostname: string, domains: string[]): boolean {
  return domains.some((domain) => hostnameMatches(hostname, domain));
}

export function getSourceScore(url: string): DomainCredibility {
  const hostname = getHostname(url);

  if (!hostname || !hostname.includes(".")) {
    return { score: 20, quality: "Invalid URL", lean: "Unknown" };
  }

  // PHASE 4 STEP 18
  if (hostname.endsWith(".gov")) {
    return { score: 90, quality: "Strong Source", lean: "Unknown" };
  }

  if (hostname.endsWith(".edu")) {
    return { score: 90, quality: "Strong Source", lean: "Unknown" };
  }

  if (hostnameMatchesAny(hostname, OFFICIAL_DOMAINS)) {
    return { score: 90, quality: "Strong Source", lean: "Unknown" };
  }

  if (hostnameMatchesAny(hostname, SOCIAL_DOMAINS)) {
    return { score: 35, quality: "Social Source", lean: "Unknown" };
  }

  if (hostnameMatchesAny(hostname, SPECIALIZED_DOMAINS)) {
    return { score: 70, quality: "Medium Source", lean: "Unknown" };
  }

  const libraryResult = findDomainCredibility(hostname);

  if (libraryResult) {
    return libraryResult;
  }

  if (hostnameMatchesAny(hostname, MAINSTREAM_DOMAINS)) {
    return { score: 75, quality: "Strong Source", lean: "Unknown" };
  }

  return { score: 40, quality: "Unknown source", lean: "Unknown" };
}

export function getSourceCredibilityLabel(value: string | null | undefined): string {
  if (!value) {
    return "Unknown source";
  }

  if (
    value === "Tier 1 - Authoritative" ||
    value === "Tier 2 - Established" ||
    value === "Tier 3 - Mixed" ||
    value === "Tier 4 - Low credibility" ||
    value === "Strong Source" ||
    value === "Medium Source" ||
    value === "Social Source" ||
    value === "Weak Source" ||
    value === "Unknown Source" ||
    value === "Unknown source" ||
    value === "Invalid URL"
  ) {
    return value;
  }

  // PHASE 4 STEP 18
  if (value === "official" || value === "mainstream") {
    return "Strong Source";
  }

  if (value === "specialized") {
    return "Medium Source";
  }

  if (value === "social") {
    return "Social Source";
  }

  if (value === "blog") {
    return "Weak Source";
  }

  if (value === "unknown") {
    return "Unknown Source";
  }

  return "Unknown Source";
}

export function formatSourceCredibilityScore(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}/100` : "Pending";
}

export function getSourceQuality(url: string): SourceQuality {
  const sourceScore = getSourceScore(url);
  const isKnownSource =
    sourceScore.quality !== "Unknown source" &&
    sourceScore.quality !== "Unknown Source" &&
    sourceScore.quality !== "Invalid URL";

  return {
    label: sourceScore.quality,
    score: sourceScore.score,
    lean: sourceScore.lean,
    reason: isKnownSource
      ? "Domain matched the FactLens credibility library. Score is based on journalistic and institutional source signals."
      : sourceScore.quality === "Invalid URL"
        ? "Invalid source URL."
        : "Domain is not in the FactLens source credibility library.",
  };
}
