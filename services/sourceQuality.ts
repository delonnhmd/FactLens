// PHASE 2 STEP 5
// PHASE 4 STEP 9
// PHASE 4 STEP 18
// PHASE 4 STEP 18B
// Source trust label update

export type SourceQualityLabel =
  | "Highly Trusted"
  | "Trusted"
  | "Moderate"
  | "Use Caution"
  | "Low Trust"
  | "Government source"
  | "Academic institution"
  | "UK academic institution"
  | "Max Planck Institute"
  | "National Institutes of Health"
  | "World Health Organization"
  | "United Nations"
  | "European Union official"
  | "Non-profit organization"
  | "German domain"
  | "French domain"
  | "Japanese domain"
  | "UK domain"
  | "Not verified"
  | "Invalid URL";

export type SourceMessageColor = "green" | "blue" | "amber" | "red";

export interface SourceQuality {
  label: SourceQualityLabel;
  score: number;
  reason: string;
  messageColor: SourceMessageColor;
}

type DomainCredibility = {
  score: number;
  quality: SourceQualityLabel;
};

export interface SourceMessage {
  text: string;
  color: SourceMessageColor;
}

const DOMAIN_LIBRARY: Record<string, DomainCredibility> = {
  "reuters.com": { score: 98, quality: "Highly Trusted" },
  "apnews.com": { score: 97, quality: "Highly Trusted" },
  "c-span.org": { score: 97, quality: "Highly Trusted" },
  "bbc.com": { score: 95, quality: "Highly Trusted" },
  "bbc.co.uk": { score: 95, quality: "Highly Trusted" },
  "pbs.org": { score: 94, quality: "Highly Trusted" },
  "economist.com": { score: 92, quality: "Highly Trusted" },
  "npr.org": { score: 92, quality: "Highly Trusted" },
  "wsj.com": { score: 90, quality: "Highly Trusted" },
  "nytimes.com": { score: 88, quality: "Highly Trusted" },
  "politico.com": { score: 88, quality: "Highly Trusted" },
  "axios.com": { score: 87, quality: "Highly Trusted" },
  "washingtonpost.com": { score: 87, quality: "Highly Trusted" },
  "dw.com": { score: 88, quality: "Highly Trusted" },
  "france24.com": { score: 85, quality: "Highly Trusted" },
  "nature.com": { score: 95, quality: "Highly Trusted" },
  "science.org": { score: 95, quality: "Highly Trusted" },
  "springer.com": { score: 88, quality: "Highly Trusted" },
  "sciencedirect.com": { score: 88, quality: "Highly Trusted" },
  "jstor.org": { score: 87, quality: "Highly Trusted" },
  "pubmed.ncbi.nlm.nih.gov": { score: 97, quality: "Highly Trusted" },
  "nih.gov": { score: 97, quality: "Highly Trusted" },
  "who.int": { score: 96, quality: "Highly Trusted" },
  "cdc.gov": { score: 96, quality: "Highly Trusted" },
  "nasa.gov": { score: 96, quality: "Highly Trusted" },
  "mit.edu": { score: 94, quality: "Highly Trusted" },
  "harvard.edu": { score: 94, quality: "Highly Trusted" },
  "stanford.edu": { score: 94, quality: "Highly Trusted" },
  "mpg.de": { score: 93, quality: "Highly Trusted" },
  "theatlantic.com": { score: 80, quality: "Trusted" },
  "foxnews.com": { score: 78, quality: "Trusted" },
  "nationalreview.com": { score: 74, quality: "Trusted" },
  "newsweek.com": { score: 74, quality: "Trusted" },
  "cnn.com": { score: 76, quality: "Trusted" },
  "msnbc.com": { score: 72, quality: "Trusted" },
  "nypost.com": { score: 70, quality: "Trusted" },
  "realclearpolitics.com": { score: 70, quality: "Trusted" },
  "washingtonexaminer.com": { score: 68, quality: "Trusted" },
  "thehill.com": { score: 82, quality: "Trusted" },
  "theguardian.com": { score: 84, quality: "Trusted" },
  "aljazeera.com": { score: 78, quality: "Trusted" },
  "vox.com": { score: 72, quality: "Use Caution" },
  "huffpost.com": { score: 65, quality: "Use Caution" },
  "motherjones.com": { score: 66, quality: "Use Caution" },
  "thenation.com": { score: 62, quality: "Use Caution" },
  "slate.com": { score: 68, quality: "Use Caution" },
  "salon.com": { score: 60, quality: "Use Caution" },
  "dailywire.com": { score: 60, quality: "Use Caution" },
  "thefederalist.com": { score: 58, quality: "Use Caution" },
  "dailycaller.com": { score: 58, quality: "Use Caution" },
  "townhall.com": { score: 55, quality: "Use Caution" },
  "newsmax.com": { score: 52, quality: "Use Caution" },
  "breitbart.com": { score: 35, quality: "Low Trust" },
  "mediamatters.org": { score: 38, quality: "Low Trust" },
  "shareblue.com": { score: 25, quality: "Low Trust" },
  "palmerreport.com": { score: 20, quality: "Low Trust" },
  "oann.com": { score: 30, quality: "Low Trust" },
  "thegatewaypundit.com": { score: 10, quality: "Low Trust" },
  "infowars.com": { score: 5, quality: "Low Trust" },
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

export function getSourceScore(url: string): DomainCredibility {
  const hostname = getHostname(url);

  if (!hostname || !hostname.includes(".")) {
    return { score: 20, quality: "Invalid URL" };
  }

  const libraryResult = findDomainCredibility(hostname);

  if (libraryResult) {
    return libraryResult;
  }

  if (hostname.endsWith(".gov")) {
    return { score: 92, quality: "Government source" };
  }

  if (hostname.endsWith(".edu")) {
    return { score: 90, quality: "Academic institution" };
  }

  if (hostname.endsWith(".ac.uk")) {
    return { score: 90, quality: "UK academic institution" };
  }

  if (hostname.endsWith(".mpg.de")) {
    return { score: 93, quality: "Max Planck Institute" };
  }

  if (hostname.endsWith(".nih.gov")) {
    return { score: 97, quality: "National Institutes of Health" };
  }

  if (hostname.endsWith(".who.int")) {
    return { score: 96, quality: "World Health Organization" };
  }

  if (hostname.endsWith(".un.org")) {
    return { score: 94, quality: "United Nations" };
  }

  if (hostname.endsWith(".europa.eu")) {
    return { score: 91, quality: "European Union official" };
  }

  if (hostname.endsWith(".org")) {
    return { score: 60, quality: "Non-profit organization" };
  }

  if (hostname.endsWith(".de")) {
    return { score: 55, quality: "German domain" };
  }

  if (hostname.endsWith(".fr")) {
    return { score: 55, quality: "French domain" };
  }

  if (hostname.endsWith(".jp")) {
    return { score: 55, quality: "Japanese domain" };
  }

  if (hostname.endsWith(".co.uk")) {
    return { score: 58, quality: "UK domain" };
  }

  return { score: 45, quality: "Not verified" };
}

export function getSourceTrustLabel(score: number | null | undefined, quality?: string | null): SourceQualityLabel {
  if (quality === "Invalid URL") {
    return "Invalid URL";
  }

  if (quality === "Not verified") {
    return "Not verified";
  }

  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "Not verified";
  }

  if (score >= 90) {
    return "Highly Trusted";
  }

  if (score >= 75) {
    return "Trusted";
  }

  if (score >= 60) {
    return "Moderate";
  }

  if (score >= 40) {
    return "Use Caution";
  }

  return "Low Trust";
}

export function getSourceCredibilityLabel(value: string | null | undefined): SourceQualityLabel {
  if (
    value === "Highly Trusted" ||
    value === "Trusted" ||
    value === "Use Caution" ||
    value === "Low Trust" ||
    value === "Government source" ||
    value === "Academic institution" ||
    value === "UK academic institution" ||
    value === "Max Planck Institute" ||
    value === "National Institutes of Health" ||
    value === "World Health Organization" ||
    value === "United Nations" ||
    value === "European Union official" ||
    value === "Non-profit organization" ||
    value === "German domain" ||
    value === "French domain" ||
    value === "Japanese domain" ||
    value === "UK domain" ||
    value === "Moderate" ||
    value === "Not verified" ||
    value === "Invalid URL"
  ) {
    return value;
  }

  if (value === "official" || value === "mainstream") {
    return "Highly Trusted";
  }

  if (value === "specialized" || value === "blog") {
    return "Trusted";
  }

  if (value === "social" || value === "unknown") {
    return "Use Caution";
  }

  return "Not verified";
}

export function formatSourceCredibilityScore(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}/100` : "Pending";
}

export function getSourceMessage(score: number | null | undefined, quality: string | null | undefined): SourceMessage {
  const safeQuality = quality?.trim() || "Not verified";

  if (typeof score !== "number" || !Number.isFinite(score)) {
    return {
      text: "Not verified. Community verification is important for this source.",
      color: "amber",
    };
  }

  if (score >= 90) {
    return {
      text: safeQuality === "Highly Trusted" ? "Highly trusted source." : `Highly trusted - ${safeQuality}.`,
      color: "green",
    };
  }

  if (score >= 75) {
    return {
      text: safeQuality === "Trusted" ? "Trusted source." : `Trusted source - ${safeQuality}.`,
      color: "blue",
    };
  }

  if (score >= 60) {
    return {
      text: `Moderate credibility. Verify with additional sources.`,
      color: "amber",
    };
  }

  if (score >= 40) {
    return {
      text: "Use caution. Community verification is important for this source.",
      color: "amber",
    };
  }

  return {
    text: "Low trust source - treat with caution.",
    color: "red",
  };
}

export function getSourceQuality(url: string): SourceQuality {
  const sourceScore = getSourceScore(url);
  const trustLabel = getSourceTrustLabel(sourceScore.score, sourceScore.quality);
  const sourceMessage = getSourceMessage(sourceScore.score, sourceScore.quality);

  return {
    label: trustLabel,
    score: sourceScore.score,
    reason: sourceMessage.text,
    messageColor: sourceMessage.color,
  };
}
