// PHASE 2 STEP 5
// PHASE 4 STEP 9
import { trustedSourceDomains } from "../constants/sourceDomains";
import type { SourceQuality as ClaimSourceQuality } from "../types/verification";

export type SourceQualityLabel = "Strong Source" | "Medium Source" | "Weak Source" | "Unknown Source";

export interface SourceQuality {
  label: SourceQualityLabel;
  score: number;
  reason: string;
}

export function getSourceCredibilityLabel(value: ClaimSourceQuality | string | null | undefined): string {
  if (value === "official") {
    return "Official Source";
  }

  if (value === "mainstream" || value === "specialized" || value === "blog") {
    return "Medium Source";
  }

  if (value === "social") {
    return "Social Source";
  }

  return "Unknown Source";
}

export function formatSourceCredibilityScore(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}/100` : "Pending";
}

const suspiciousWords = ["rumor", "leaked", "secret", "shocking", "unknown", "viral", "anonymous"];

function getHostname(url: string): string | null {
  try {
    const parsedUrl = new URL(url.trim());
    return parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isTrustedDomain(hostname: string): boolean {
  return trustedSourceDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isReadableDomain(hostname: string): boolean {
  const domainName = hostname.split(".")[0] ?? "";
  return /^[a-z0-9-]{3,}$/i.test(domainName);
}

export function getSourceQuality(url: string): SourceQuality {
  const trimmedUrl = url.trim();
  const hostname = getHostname(trimmedUrl);

  if (!hostname) {
    return {
      label: "Unknown Source",
      score: 0,
      reason: "URL could not be parsed.",
    };
  }

  if (!hostname.includes(".")) {
    return {
      label: "Unknown Source",
      score: 0,
      reason: "Domain could not be detected.",
    };
  }

  const normalizedUrl = trimmedUrl.toLowerCase();

  if (!normalizedUrl.startsWith("https://")) {
    return {
      label: "Weak Source",
      score: 25,
      reason: "Source is missing HTTPS.",
    };
  }

  const matchedSuspiciousWord = suspiciousWords.find((word) => normalizedUrl.includes(word));

  if (matchedSuspiciousWord) {
    return {
      label: "Weak Source",
      score: 25,
      reason: `URL contains suspicious wording: ${matchedSuspiciousWord}.`,
    };
  }

  if (hostname.endsWith(".gov")) {
    return {
      label: "Strong Source",
      score: 95,
      reason: "Official government domain.",
    };
  }

  if (hostname.endsWith(".edu")) {
    return {
      label: "Strong Source",
      score: 92,
      reason: "Educational domain.",
    };
  }

  if (hostname.endsWith(".org")) {
    return {
      label: "Strong Source",
      score: 88,
      reason: "Major organization domain.",
    };
  }

  if (isTrustedDomain(hostname)) {
    return {
      label: "Strong Source",
      score: 90,
      reason: "Domain is on the local trusted source allowlist.",
    };
  }

  if (hostname.endsWith(".com") && isReadableDomain(hostname)) {
    return {
      label: "Medium Source",
      score: 65,
      reason: "HTTPS .com source with a readable domain.",
    };
  }

  return {
    label: "Medium Source",
    score: 60,
    reason: "HTTPS source with a detectable domain.",
  };
}
