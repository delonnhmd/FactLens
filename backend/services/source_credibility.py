# PHASE 4 STEP 9
import json
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SOURCE_CREDIBILITY_PATH = Path(__file__).resolve().parents[1] / "ai_library" / "source_credibility.json"
SOURCE_QUALITY_ORDER = ("official", "mainstream", "specialized", "social")

DEFAULT_SOURCE_CREDIBILITY: dict[str, dict[str, Any]] = {
    "official": {"score": 90, "domains": []},
    "mainstream": {"score": 75, "domains": []},
    "specialized": {"score": 70, "domains": []},
    "social": {"score": 35, "domains": ["youtube.com", "youtu.be", "tiktok.com"]},
    "unknown": {"score": 40, "domains": []},
}


@lru_cache(maxsize=1)
def load_source_credibility() -> dict[str, dict[str, Any]]:
    try:
        with SOURCE_CREDIBILITY_PATH.open("r", encoding="utf-8") as file:
            library = json.load(file)
    except (OSError, json.JSONDecodeError):
        library = DEFAULT_SOURCE_CREDIBILITY

    return {
        quality: {
            "score": int(section.get("score", DEFAULT_SOURCE_CREDIBILITY.get(quality, {}).get("score", 40))),
            "domains": [str(domain).lower().strip() for domain in section.get("domains", []) if str(domain).strip()],
        }
        for quality, section in library.items()
        if isinstance(section, dict)
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


def _score_result(domain: str, source_quality: str, source_score: int, source_reason: str) -> dict:
    return {
        "domain": domain,
        "source_quality": source_quality,
        "source_score": max(0, min(int(source_score), 100)),
        "source_reason": source_reason,
    }


def score_source_url(source_url: str | None) -> dict:
    domain = extract_domain(source_url)
    library = load_source_credibility()

    if not str(source_url or "").strip():
        return _score_result("", "unknown", 0, "Missing source URL.")

    if not domain or "." not in domain:
        return _score_result(domain, "unknown", 0, "Source domain could not be detected.")

    for source_quality in SOURCE_QUALITY_ORDER:
        section = library.get(source_quality, {})
        score = int(section.get("score", 40))

        for candidate in section.get("domains", []):
            if _domain_matches(domain, candidate):
                if source_quality == "social":
                    reason = "Social media source. Needs corroborating evidence."
                elif source_quality == "official":
                    reason = "Official source domain matched the FactLens credibility library."
                elif source_quality == "mainstream":
                    reason = "Mainstream news source domain matched the FactLens credibility library."
                else:
                    reason = "Specialized source domain matched the FactLens credibility library."

                return _score_result(domain, source_quality, score, reason)

    unknown_score = int(library.get("unknown", {}).get("score", 40))
    return _score_result(domain, "unknown", unknown_score, "Domain is not in the FactLens source credibility library.")
