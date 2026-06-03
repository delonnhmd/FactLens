# PHASE 4 STEP 9
# PHASE 4 STEP 17
# PHASE 4 STEP 18
# PHASE 4 STEP 20B
# Source trust label update
import json
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SOURCE_CREDIBILITY_PATH = Path(__file__).resolve().parents[1] / "ai_library" / "source_credibility.json"

DEFAULT_DOMAIN_LIBRARY: dict[str, dict[str, Any]] = {
    "reuters.com": {"score": 98, "quality": "Highly Trusted"},
    "apnews.com": {"score": 97, "quality": "Highly Trusted"},
    "c-span.org": {"score": 97, "quality": "Highly Trusted"},
    "bbc.com": {"score": 95, "quality": "Highly Trusted"},
    "bbc.co.uk": {"score": 95, "quality": "Highly Trusted"},
    "pbs.org": {"score": 94, "quality": "Highly Trusted"},
    "economist.com": {"score": 92, "quality": "Highly Trusted"},
    "npr.org": {"score": 92, "quality": "Highly Trusted"},
    "wsj.com": {"score": 90, "quality": "Highly Trusted"},
    "nytimes.com": {"score": 88, "quality": "Highly Trusted"},
    "politico.com": {"score": 88, "quality": "Highly Trusted"},
    "axios.com": {"score": 87, "quality": "Highly Trusted"},
    "washingtonpost.com": {"score": 87, "quality": "Highly Trusted"},
    "dw.com": {"score": 88, "quality": "Highly Trusted"},
    "france24.com": {"score": 85, "quality": "Highly Trusted"},
    "nature.com": {"score": 95, "quality": "Highly Trusted"},
    "science.org": {"score": 95, "quality": "Highly Trusted"},
    "springer.com": {"score": 88, "quality": "Highly Trusted"},
    "sciencedirect.com": {"score": 88, "quality": "Highly Trusted"},
    "jstor.org": {"score": 87, "quality": "Highly Trusted"},
    "pubmed.ncbi.nlm.nih.gov": {"score": 97, "quality": "Highly Trusted"},
    "nih.gov": {"score": 97, "quality": "Highly Trusted"},
    "who.int": {"score": 96, "quality": "Highly Trusted"},
    "cdc.gov": {"score": 96, "quality": "Highly Trusted"},
    "nasa.gov": {"score": 96, "quality": "Highly Trusted"},
    "mit.edu": {"score": 94, "quality": "Highly Trusted"},
    "harvard.edu": {"score": 94, "quality": "Highly Trusted"},
    "stanford.edu": {"score": 94, "quality": "Highly Trusted"},
    "mpg.de": {"score": 93, "quality": "Highly Trusted"},
    "theatlantic.com": {"score": 80, "quality": "Trusted"},
    "foxnews.com": {"score": 78, "quality": "Trusted"},
    "nationalreview.com": {"score": 74, "quality": "Trusted"},
    "newsweek.com": {"score": 74, "quality": "Trusted"},
    "cnn.com": {"score": 76, "quality": "Trusted"},
    "msnbc.com": {"score": 72, "quality": "Trusted"},
    "nypost.com": {"score": 70, "quality": "Trusted"},
    "realclearpolitics.com": {"score": 70, "quality": "Trusted"},
    "washingtonexaminer.com": {"score": 68, "quality": "Trusted"},
    "thehill.com": {"score": 82, "quality": "Trusted"},
    "theguardian.com": {"score": 84, "quality": "Trusted"},
    "aljazeera.com": {"score": 78, "quality": "Trusted"},
    "vox.com": {"score": 72, "quality": "Use Caution"},
    "huffpost.com": {"score": 65, "quality": "Use Caution"},
    "motherjones.com": {"score": 66, "quality": "Use Caution"},
    "thenation.com": {"score": 62, "quality": "Use Caution"},
    "slate.com": {"score": 68, "quality": "Use Caution"},
    "salon.com": {"score": 60, "quality": "Use Caution"},
    "dailywire.com": {"score": 60, "quality": "Use Caution"},
    "thefederalist.com": {"score": 58, "quality": "Use Caution"},
    "dailycaller.com": {"score": 58, "quality": "Use Caution"},
    "townhall.com": {"score": 55, "quality": "Use Caution"},
    "newsmax.com": {"score": 52, "quality": "Use Caution"},
    "breitbart.com": {"score": 35, "quality": "Low Trust"},
    "mediamatters.org": {"score": 38, "quality": "Low Trust"},
    "shareblue.com": {"score": 25, "quality": "Low Trust"},
    "palmerreport.com": {"score": 20, "quality": "Low Trust"},
    "oann.com": {"score": 30, "quality": "Low Trust"},
    "thegatewaypundit.com": {"score": 10, "quality": "Low Trust"},
    "infowars.com": {"score": 5, "quality": "Low Trust"},
}

DEFAULT_SOURCE_CREDIBILITY: dict[str, Any] = {
    "domains": DEFAULT_DOMAIN_LIBRARY,
    "unknown": {"score": 45, "quality": "Not in FactLens library"},
    "invalid": {"score": 20, "quality": "Invalid URL"},
}

def get_source_message(score: int | None, quality: str | None) -> dict[str, str]:
    safe_quality = str(quality or "Not in FactLens library").strip() or "Not in FactLens library"

    if score is None:
        return {
            "text": f"{safe_quality}. Community verification is important for this source.",
            "color": "amber",
        }

    if score >= 90:
        return {
            "text": "Highly trusted source." if safe_quality == "Highly Trusted" else f"Highly trusted - {safe_quality}.",
            "color": "green",
        }

    if score >= 75:
        return {
            "text": "Trusted source." if safe_quality == "Trusted" else f"Trusted source - {safe_quality}.",
            "color": "blue",
        }

    if score >= 60:
        return {
            "text": f"Moderate credibility - {safe_quality}. Verify with additional sources.",
            "color": "amber",
        }

    if score >= 40:
        return {
            "text": f"{safe_quality}. Community verification is important for this source.",
            "color": "amber",
        }

    return {
        "text": "Low trust source - treat with caution.",
        "color": "red",
    }


# PHASE 4 STEP 17
# PHASE 4 STEP 20
# PHASE 4 STEP 20B
SOURCE_QUALITY_ALLOWED_VALUES = {
    "official",
    "mainstream",
    "specialized",
    "social",
    "blog",
    "unknown",
}

# PHASE 4 STEP 20B
def source_trust_label(source_score: int | None) -> str:
    if source_score is None:
        return "Unknown source"

    if source_score >= 85:
        return "Strong Source"

    if source_score >= 65:
        return "Medium Source"

    if source_score >= 50:
        return "Use Caution"

    return "Weak / Unknown Source"


# PHASE 4 STEP 20B
def get_source_warning_level(source_score: int | None) -> str:
    if source_score is None:
        return "medium"

    if source_score >= 85:
        return "low"

    if source_score >= 65:
        return "medium"

    if source_score >= 50:
        return "medium"

    return "high"


# PHASE 4 STEP 20B
def normalize_source_quality(value: object) -> str:
    normalized = str(value or "").strip().lower()

    if normalized in SOURCE_QUALITY_ALLOWED_VALUES:
        return normalized

    return "unknown"


# PHASE 4 STEP 20B
def infer_source_quality_category(domain: str, source_score: int, source_detail: str | None) -> str:
    detail = str(source_detail or "").strip().lower()

    explicit_category = normalize_source_quality(detail)
    if explicit_category != "unknown":
        return explicit_category

    if (
        domain.endswith(".gov")
        or domain.endswith(".edu")
        or domain.endswith(".ac.uk")
        or domain.endswith(".mpg.de")
        or domain.endswith(".nih.gov")
        or domain.endswith(".who.int")
        or domain.endswith(".un.org")
        or domain.endswith(".europa.eu")
        or detail
        in {
            "government source",
            "academic institution",
            "uk academic institution",
            "max planck institute",
            "national institutes of health",
            "world health organization",
            "united nations",
            "european union official",
        }
    ):
        return "official"

    if detail in {"non-profit organization"} or domain.endswith(".org"):
        return "specialized"

    if source_score >= 75 and detail in {"highly trusted", "trusted"}:
        return "mainstream"

    return "unknown"


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
            "score": int(metadata.get("score", 45)),
            "quality": str(metadata.get("quality") or "Not in FactLens library"),
        }
        for domain, metadata in domains.items()
        if str(domain).strip() and isinstance(metadata, dict)
    }

    unknown = library.get("unknown", DEFAULT_SOURCE_CREDIBILITY["unknown"]) if isinstance(library, dict) else DEFAULT_SOURCE_CREDIBILITY["unknown"]
    invalid = library.get("invalid", DEFAULT_SOURCE_CREDIBILITY["invalid"]) if isinstance(library, dict) else DEFAULT_SOURCE_CREDIBILITY["invalid"]

    return {
        "domains": normalized_domains or DEFAULT_DOMAIN_LIBRARY,
        "unknown": {
            "score": int(unknown.get("score", 45)),
            "quality": str(unknown.get("quality") or "Not in FactLens library"),
        },
        "invalid": {
            "score": int(invalid.get("score", 20)),
            "quality": str(invalid.get("quality") or "Invalid URL"),
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


def _score_source_values(domain: str, source_quality: str, source_score: int, source_detail: str | None = None) -> dict:
    bounded_score = max(0, min(int(source_score), 100))
    db_source_quality = normalize_source_quality(source_quality)
    display_detail = str(source_detail or source_trust_label(bounded_score)).strip()
    trust_label = source_trust_label(bounded_score)
    source_message = get_source_message(bounded_score, display_detail)

    return {
        "domain": domain,
        "source_domain": domain,
        # PHASE 4 STEP 20B
        # Database category only. User-facing trust labels stay in separate fields.
        "source_quality": db_source_quality,
        "source_score": bounded_score,
        "source_trust_label": trust_label,
        "source_quality_label": trust_label,
        "source_detail": display_detail,
        "source_warning_level": get_source_warning_level(bounded_score),
        "suggested_user_action": source_message["text"],
        "source_message": source_message["text"],
        "source_message_color": source_message["color"],
        "source_reason": source_message["text"],
    }


def _score_result(domain: str, metadata: dict[str, Any]) -> dict:
    source_score = int(metadata.get("score", 45))
    source_detail = str(metadata.get("quality") or "Not in FactLens library")
    source_quality = normalize_source_quality(metadata.get("source_quality"))

    if source_quality == "unknown":
        source_quality = infer_source_quality_category(domain, source_score, source_detail)

    return _score_source_values(domain, source_quality, source_score, source_detail)


def get_source_score(source_url: str | None) -> dict:
    domain = extract_domain(source_url)
    library = load_source_credibility()

    if not str(source_url or "").strip() or not domain or "." not in domain:
        return _score_result(domain, library["invalid"])

    for candidate, metadata in library["domains"].items():
        if _domain_matches(domain, candidate):
            return _score_result(domain, metadata)

    if domain.endswith(".gov"):
        return _score_source_values(domain, "official", 92, "Government source")

    if domain.endswith(".edu"):
        return _score_source_values(domain, "official", 90, "Academic institution")

    if domain.endswith(".ac.uk"):
        return _score_source_values(domain, "official", 90, "UK academic institution")

    if domain.endswith(".mpg.de"):
        return _score_source_values(domain, "official", 93, "Max Planck Institute")

    if domain.endswith(".nih.gov"):
        return _score_source_values(domain, "official", 97, "National Institutes of Health")

    if domain.endswith(".who.int"):
        return _score_source_values(domain, "official", 96, "World Health Organization")

    if domain.endswith(".un.org"):
        return _score_source_values(domain, "official", 94, "United Nations")

    if domain.endswith(".europa.eu"):
        return _score_source_values(domain, "official", 91, "European Union official")

    if domain.endswith(".org"):
        return _score_source_values(domain, "specialized", 60, "Non-profit organization")

    if domain.endswith(".de"):
        return _score_source_values(domain, "unknown", 55, "German domain")

    if domain.endswith(".fr"):
        return _score_source_values(domain, "unknown", 55, "French domain")

    if domain.endswith(".jp"):
        return _score_source_values(domain, "unknown", 55, "Japanese domain")

    if domain.endswith(".co.uk"):
        return _score_source_values(domain, "unknown", 58, "UK domain")

    return _score_result(domain, library["unknown"])


def score_source_url(source_url: str | None) -> dict:
    return get_source_score(source_url)
