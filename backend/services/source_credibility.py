# PHASE 4 STEP 9
import json
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SOURCE_CREDIBILITY_PATH = Path(__file__).resolve().parents[1] / "ai_library" / "source_credibility.json"

# Credibility scores are based on journalistic standards only. Political lean is
# informational metadata and must never change the score.
DEFAULT_DOMAIN_LIBRARY: dict[str, dict[str, Any]] = {
    "reuters.com": {"score": 98, "quality": "Tier 1 - Authoritative", "lean": "Center"},
    "apnews.com": {"score": 97, "quality": "Tier 1 - Authoritative", "lean": "Center"},
    "c-span.org": {"score": 97, "quality": "Tier 1 - Authoritative", "lean": "Center"},
    "bbc.com": {"score": 95, "quality": "Tier 1 - Authoritative", "lean": "Center"},
    "pbs.org": {"score": 94, "quality": "Tier 1 - Authoritative", "lean": "Center"},
    "economist.com": {"score": 92, "quality": "Tier 1 - Authoritative", "lean": "Center"},
    "npr.org": {"score": 92, "quality": "Tier 1 - Authoritative", "lean": "Center-left"},
    "wsj.com": {"score": 90, "quality": "Tier 1 - Authoritative", "lean": "Center-right"},
    "nytimes.com": {"score": 88, "quality": "Tier 1 - Authoritative", "lean": "Center-left"},
    "politico.com": {"score": 88, "quality": "Tier 1 - Authoritative", "lean": "Center"},
    "axios.com": {"score": 87, "quality": "Tier 1 - Authoritative", "lean": "Center"},
    "washingtonpost.com": {"score": 87, "quality": "Tier 1 - Authoritative", "lean": "Center-left"},
    "theatlantic.com": {"score": 80, "quality": "Tier 2 - Established", "lean": "Center-left"},
    "foxnews.com": {"score": 78, "quality": "Tier 2 - Established", "lean": "Right"},
    "nationalreview.com": {"score": 74, "quality": "Tier 2 - Established", "lean": "Right"},
    "newsweek.com": {"score": 74, "quality": "Tier 2 - Established", "lean": "Center-left"},
    "cnn.com": {"score": 76, "quality": "Tier 2 - Established", "lean": "Left"},
    "msnbc.com": {"score": 72, "quality": "Tier 2 - Established", "lean": "Left"},
    "nypost.com": {"score": 70, "quality": "Tier 2 - Established", "lean": "Right"},
    "realclearpolitics.com": {"score": 70, "quality": "Tier 2 - Established", "lean": "Center-right"},
    "washingtonexaminer.com": {"score": 68, "quality": "Tier 2 - Established", "lean": "Right"},
    "thehill.com": {"score": 82, "quality": "Tier 2 - Established", "lean": "Center"},
    "vox.com": {"score": 72, "quality": "Tier 3 - Mixed", "lean": "Left"},
    "huffpost.com": {"score": 65, "quality": "Tier 3 - Mixed", "lean": "Left"},
    "motherjones.com": {"score": 66, "quality": "Tier 3 - Mixed", "lean": "Left"},
    "thenation.com": {"score": 62, "quality": "Tier 3 - Mixed", "lean": "Left"},
    "slate.com": {"score": 68, "quality": "Tier 3 - Mixed", "lean": "Left"},
    "salon.com": {"score": 60, "quality": "Tier 3 - Mixed", "lean": "Left"},
    "dailywire.com": {"score": 60, "quality": "Tier 3 - Mixed", "lean": "Right"},
    "thefederalist.com": {"score": 58, "quality": "Tier 3 - Mixed", "lean": "Right"},
    "dailycaller.com": {"score": 58, "quality": "Tier 3 - Mixed", "lean": "Right"},
    "townhall.com": {"score": 55, "quality": "Tier 3 - Mixed", "lean": "Right"},
    "newsmax.com": {"score": 52, "quality": "Tier 3 - Mixed", "lean": "Right"},
    "breitbart.com": {"score": 35, "quality": "Tier 4 - Low credibility", "lean": "Right"},
    "mediamatters.org": {"score": 38, "quality": "Tier 4 - Low credibility", "lean": "Left"},
    "shareblue.com": {"score": 25, "quality": "Tier 4 - Low credibility", "lean": "Left"},
    "palmerreport.com": {"score": 20, "quality": "Tier 4 - Low credibility", "lean": "Left"},
    "oann.com": {"score": 30, "quality": "Tier 4 - Low credibility", "lean": "Right"},
    "thegatewaypundit.com": {"score": 10, "quality": "Tier 4 - Low credibility", "lean": "Right"},
    "infowars.com": {"score": 5, "quality": "Tier 4 - Low credibility", "lean": "Right"},
}

DEFAULT_SOURCE_CREDIBILITY: dict[str, Any] = {
    "domains": DEFAULT_DOMAIN_LIBRARY,
    "unknown": {"score": 40, "quality": "Unknown source", "lean": "Unknown"},
    "invalid": {"score": 20, "quality": "Invalid URL", "lean": "Unknown"},
}


@lru_cache(maxsize=1)
def load_source_credibility() -> dict[str, Any]:
    try:
        with SOURCE_CREDIBILITY_PATH.open("r", encoding="utf-8") as file:
            library = json.load(file)
    except (OSError, json.JSONDecodeError):
        library = DEFAULT_SOURCE_CREDIBILITY

    domains = library.get("domains", {}) if isinstance(library, dict) else {}
    normalized_domains = {
        str(domain).lower().strip(): {
            "score": int(metadata.get("score", 40)),
            "quality": str(metadata.get("quality") or "Unknown source"),
            "lean": str(metadata.get("lean") or "Unknown"),
        }
        for domain, metadata in domains.items()
        if str(domain).strip() and isinstance(metadata, dict)
    }

    unknown = library.get("unknown", DEFAULT_SOURCE_CREDIBILITY["unknown"]) if isinstance(library, dict) else DEFAULT_SOURCE_CREDIBILITY["unknown"]
    invalid = library.get("invalid", DEFAULT_SOURCE_CREDIBILITY["invalid"]) if isinstance(library, dict) else DEFAULT_SOURCE_CREDIBILITY["invalid"]

    return {
        "domains": normalized_domains or DEFAULT_DOMAIN_LIBRARY,
        "unknown": {
            "score": int(unknown.get("score", 40)),
            "quality": str(unknown.get("quality") or "Unknown source"),
            "lean": str(unknown.get("lean") or "Unknown"),
        },
        "invalid": {
            "score": int(invalid.get("score", 20)),
            "quality": str(invalid.get("quality") or "Invalid URL"),
            "lean": str(invalid.get("lean") or "Unknown"),
        },
    }


def extract_domain(url: str | None) -> str:
    raw_url = str(url or "").strip().lower()

    if not raw_url:
        return ""

    parse_target = raw_url if "://" in raw_url else f"https://{raw_url}"
    parsed_url = urlparse(parse_target)
    hostname = parsed_url.hostname or ""

    if not hostname:
        hostname = raw_url.split("/")[0].split("?")[0].split("#")[0]

    hostname = hostname.strip().strip(".")

    if hostname.startswith("www."):
        hostname = hostname[4:]

    return hostname


def _domain_matches(domain: str, candidate: str) -> bool:
    return domain == candidate or domain.endswith(f".{candidate}")


def _score_result(domain: str, metadata: dict[str, Any], source_reason: str) -> dict:
    return {
        "domain": domain,
        "source_quality": str(metadata.get("quality") or "Unknown source"),
        "source_score": max(0, min(int(metadata.get("score", 40)), 100)),
        "source_lean": str(metadata.get("lean") or "Unknown"),
        "source_reason": source_reason,
    }


def get_source_score(source_url: str | None) -> dict:
    domain = extract_domain(source_url)
    library = load_source_credibility()

    if not str(source_url or "").strip() or not domain or "." not in domain:
        return _score_result(domain, library["invalid"], "Invalid source URL.")

    for candidate, metadata in library["domains"].items():
        if _domain_matches(domain, candidate):
            return _score_result(
                domain,
                metadata,
                "Domain matched the FactLens credibility library. Score is based on journalistic standards only; political lean is informational and not used in scoring.",
            )

    return _score_result(
        domain,
        library["unknown"],
        "Domain is not in the FactLens source credibility library.",
    )


def score_source_url(source_url: str | None) -> dict:
    return get_source_score(source_url)
