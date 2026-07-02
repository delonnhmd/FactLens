# PHASE 6 STEP 2 — Offline reference citations (books, newspapers, journals, documents).
#
# This module owns everything specific to OFFLINE evidence sources:
#   1. validate_citation      — shape/required-field validation per reference type.
#   2. verify_citation_exists — best-effort existence check via public APIs.
#   3. score_citation_source  — trust weighting for offline sources (one tier below
#      the equivalent online source when verified; 'unknown' otherwise).
#
# It lives in a NEW file so URL-based evidence and the existing URL scoring in
# source_credibility.py are left completely untouched. Where output needs to match
# the existing scoring shape we REUSE source_credibility helpers rather than
# re-deriving them, so offline evidence stores the same fields as URL evidence.

import difflib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import requests

try:
    from services.source_credibility import (
        normalize_source_quality,
        source_trust_label,
    )
except ModuleNotFoundError:  # Allows repo-root command: uvicorn backend.main:app
    from backend.services.source_credibility import (
        normalize_source_quality,
        source_trust_label,
    )


# ---------------------------------------------------------------------------
# Reference types & citation schemas
# ---------------------------------------------------------------------------

# Offline types only. 'url' is handled by the untouched existing code path.
OFFLINE_REFERENCE_TYPES = {"book", "newspaper", "journal", "document"}
ALL_REFERENCE_TYPES = {"url", *OFFLINE_REFERENCE_TYPES}

# Required fields per type (* fields in the spec). Optional fields are accepted
# but not enforced; extra keys are ignored rather than rejected.
REQUIRED_CITATION_FIELDS: dict[str, list[str]] = {
    "book": ["title", "author", "year"],
    "newspaper": ["publication", "headline", "date"],
    "journal": ["journal", "title", "author", "year"],
    "document": ["title", "issuer"],
}

# 5s hard ceiling per external call — existence checks must never hang the
# evidence-submission request.
EXTERNAL_CALL_TIMEOUT_SECONDS = 5

OPEN_LIBRARY_ISBN_URL = "https://openlibrary.org/isbn/{isbn}.json"
OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
DOI_RESOLVER_URL = "https://doi.org/{doi}"

# Same courteous UA the source page fetcher uses, so outbound calls are identifiable.
CITATION_USER_AGENT = (
    "VerifactBot/1.0 (+https://verifact.pennyfloat.com; citation existence check; "
    "contact: support@verifact.pennyfloat.com)"
)


def validate_citation(reference_type: str, citation: dict) -> tuple[bool, str]:
    """Validate a citation's shape before it is ever saved.

    WHY up front and strict: an offline citation is the ONLY signal we have for
    that evidence (there's no URL to fall back on), so a citation missing its
    identifying fields is worthless and must be rejected with a clear message
    telling the user exactly what to add — rather than silently stored and later
    failing verification for the wrong reason.

    Returns (is_valid, error_message). error_message is "" when valid.
    """
    normalized_type = str(reference_type or "").strip().lower()

    if normalized_type not in OFFLINE_REFERENCE_TYPES:
        return False, (
            f"Unsupported reference_type '{reference_type}'. "
            f"Expected one of: {', '.join(sorted(OFFLINE_REFERENCE_TYPES))}."
        )

    if not isinstance(citation, dict):
        return False, "citation must be an object with the citation fields."

    required = REQUIRED_CITATION_FIELDS[normalized_type]
    missing = [
        field
        for field in required
        if not str(citation.get(field) or "").strip()
    ]

    if missing:
        return False, (
            f"{normalized_type} citation is missing required field(s): "
            f"{', '.join(missing)}."
        )

    return True, ""


# ---------------------------------------------------------------------------
# Existence verification
# ---------------------------------------------------------------------------

def _http_get(url: str, params: dict | None = None) -> "requests.Response | None":
    """GET with the shared timeout/UA, returning None on any failure.

    WHY None-on-failure: existence checks are best-effort. A network hiccup must
    surface as "unverifiable" (None), never as "does not exist" (False) and never
    as an exception that blocks evidence submission.
    """
    try:
        return requests.get(
            url,
            params=params,
            headers={"User-Agent": CITATION_USER_AGENT},
            timeout=EXTERNAL_CALL_TIMEOUT_SECONDS,
        )
    except requests.RequestException as error:
        print(f"[citation] GET failed for {url}: {error}", flush=True)
        return None


def _normalize_title(value: str) -> str:
    """Lowercase + collapse to alphanumerics/space for fuzzy title comparison."""
    lowered = str(value or "").lower()
    return " ".join("".join(ch if ch.isalnum() else " " for ch in lowered).split())


def _titles_match(claimed_title: str, candidate_title: str) -> bool:
    """True when two titles are close enough to be the same book.

    WHY fuzzy: catalog titles differ in subtitles/punctuation ("Sapiens" vs
    "Sapiens: A Brief History of Humankind"), so an exact match would reject real
    books. A 0.6 similarity ratio tolerates that without matching unrelated books.
    """
    a = _normalize_title(claimed_title)
    b = _normalize_title(candidate_title)

    if not a or not b:
        return False

    if a in b or b in a:
        return True

    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.6


def _verify_book(citation: dict) -> "bool | None":
    """Verify a book via Open Library (ISBN lookup, else title+author search)."""
    isbn = str(citation.get("isbn") or "").replace("-", "").replace(" ", "").strip()

    if isbn:
        response = _http_get(OPEN_LIBRARY_ISBN_URL.format(isbn=isbn))
        if response is None:
            return None
        if response.status_code == 200:
            return True
        if response.status_code == 404:
            return False
        # Unexpected status — treat as unverifiable rather than a hard false.
        return None

    # No ISBN: search by title + author and look for a plausible match.
    title = str(citation.get("title") or "").strip()
    author = str(citation.get("author") or "").strip()
    response = _http_get(
        OPEN_LIBRARY_SEARCH_URL,
        params={"title": title, "author": author, "limit": 5},
    )

    if response is None or response.status_code != 200:
        return None

    try:
        docs = response.json().get("docs", []) or []
    except (ValueError, AttributeError):
        return None

    if not docs:
        # A clean "no results" for a specific title+author is a real negative.
        return False

    claimed_year = _coerce_year(citation.get("year"))

    for doc in docs:
        if not _titles_match(title, str(doc.get("title") or "")):
            continue

        # If we have a claimed year, require the catalog's first publish year to be
        # within 1 (editions/reprints drift a little); if no year, title match is enough.
        candidate_year = _coerce_year(doc.get("first_publish_year"))
        if claimed_year is None or candidate_year is None:
            return True
        if abs(candidate_year - claimed_year) <= 1:
            return True

    # We got results but none plausibly match the claimed title/year.
    return False


def _verify_journal(citation: dict) -> "bool | None":
    """Verify a journal article by resolving its DOI (2xx/3xx = exists)."""
    doi = str(citation.get("doi") or "").strip()

    if not doi:
        # No DOI to check against — unverifiable, not false.
        return None

    # Strip a leading "doi:" or full URL if the user pasted one.
    doi = doi.replace("https://doi.org/", "").replace("http://doi.org/", "")
    doi = doi.removeprefix("doi:").strip()

    try:
        response = requests.head(
            DOI_RESOLVER_URL.format(doi=doi),
            headers={"User-Agent": CITATION_USER_AGENT},
            timeout=EXTERNAL_CALL_TIMEOUT_SECONDS,
            allow_redirects=False,
        )
    except requests.RequestException as error:
        print(f"[citation] DOI HEAD failed for {doi}: {error}", flush=True)
        return None

    if 200 <= response.status_code < 400:
        return True
    if response.status_code == 404:
        return False
    return None


def _verify_newspaper(citation: dict) -> "bool | None":
    """Verify a newspaper by matching `publication` against the print library.

    WHY None (not False) when unmatched: the print-publications list is curated
    and non-exhaustive, so an unrecognized paper is "we can't confirm it" rather
    than "it doesn't exist". Only a recognized publication counts as verified.
    """
    tier = lookup_publication_tier(citation.get("publication"))
    return True if tier is not None else None


def verify_citation_exists(reference_type: str, citation: dict) -> "bool | None":
    """Best-effort existence check. Returns True/False, or None if unverifiable.

    WHY it can return None and never raises: verification is an enhancement, not a
    gate. Timeouts, API outages, or missing identifiers must yield None so the
    caller still saves the evidence (just with lower trust weight). It must NEVER
    block submission.
    """
    normalized_type = str(reference_type or "").strip().lower()

    try:
        if normalized_type == "book":
            return _verify_book(citation)
        if normalized_type == "journal":
            return _verify_journal(citation)
        if normalized_type == "newspaper":
            return _verify_newspaper(citation)
        # 'document' has no public existence oracle — unverifiable by design.
        return None
    except Exception as error:  # pragma: no cover - defensive; never block on this.
        print(f"[citation] verification error ({normalized_type}): {error}", flush=True)
        return None


# ---------------------------------------------------------------------------
# Print publication library (mirrors source_credibility.py's file+default pattern)
# ---------------------------------------------------------------------------

PRINT_PUBLICATIONS_PATH = (
    Path(__file__).resolve().parents[1] / "ai_library" / "print_publications.json"
)

# Fallback used if the JSON file is missing/unreadable, exactly like
# source_credibility.DEFAULT_DOMAIN_LIBRARY. Tiers reuse the existing
# source_quality vocabulary (official/mainstream/specialized/unknown).
DEFAULT_PRINT_PUBLICATIONS: dict[str, dict[str, Any]] = {
    "the new york times": {"tier": "mainstream"},
    "the wall street journal": {"tier": "mainstream"},
    "the washington post": {"tier": "mainstream"},
    "the guardian": {"tier": "mainstream"},
    "financial times": {"tier": "mainstream"},
    "the times": {"tier": "mainstream"},
    "reuters": {"tier": "official"},
    "associated press": {"tier": "official"},
    "the economist": {"tier": "mainstream"},
    "the atlantic": {"tier": "specialized"},
    "the new yorker": {"tier": "specialized"},
    "new york post": {"tier": "specialized"},
}


@lru_cache(maxsize=1)
def load_print_publications() -> dict[str, str]:
    """Load {normalized publication name -> tier}, cached like the domain library."""
    try:
        with PRINT_PUBLICATIONS_PATH.open("r", encoding="utf-8") as file:
            raw = json.load(file)
        publications = raw.get("publications", {}) if isinstance(raw, dict) else {}
    except (OSError, json.JSONDecodeError):
        publications = DEFAULT_PRINT_PUBLICATIONS

    normalized: dict[str, str] = {}
    for name, metadata in publications.items():
        key = str(name or "").strip().lower()
        if key and isinstance(metadata, dict):
            normalized[key] = normalize_source_quality(metadata.get("tier"))

    return normalized or {
        name: normalize_source_quality(meta["tier"])
        for name, meta in DEFAULT_PRINT_PUBLICATIONS.items()
    }


def lookup_publication_tier(publication: object) -> "str | None":
    """Return the online-equivalent tier for a print publication, or None.

    Case-insensitive exact match against the print library. None means the paper
    is not in the curated list (so it can't be treated as verified).
    """
    key = str(publication or "").strip().lower()
    if not key:
        return None
    return load_print_publications().get(key)


# ---------------------------------------------------------------------------
# Trust weighting
# ---------------------------------------------------------------------------

# Ordered strongest -> weakest, used to step a tier "one below" for verified
# offline sources. Mirrors the source_quality vocabulary used across scoring.
_TIER_ORDER = ["official", "mainstream", "specialized", "unknown"]

# Representative score per resulting tier, aligned to the existing scoring bands
# in source_credibility (e.g. specialized ~60 matches the ".org" non-profit score).
_TIER_SCORE = {
    "mainstream": 78,
    "specialized": 60,
    "unknown": 30,
}


def _one_tier_below(tier: str) -> str:
    """Step a source-quality tier down by one (floored at 'unknown')."""
    normalized = normalize_source_quality(tier)
    if normalized not in _TIER_ORDER:
        return "unknown"
    index = _TIER_ORDER.index(normalized)
    return _TIER_ORDER[min(index + 1, len(_TIER_ORDER) - 1)]


def _citation_reason(reference_type: str, citation: dict, verified: "bool | None") -> str:
    """Human-readable explanation stored in source_quality_reason.

    WHY explicit: users and the AI need to know an offline source's WEIGHT is
    lower because its *content* can't be independently checked, even when its
    *existence* was confirmed. Making that distinction visible is the whole point.
    """
    if verified is not True:
        return (
            "Offline citation — existence could not be independently verified; "
            "displayed with minimal verdict weight until reviewed."
        )

    if reference_type == "book":
        if str(citation.get("isbn") or "").strip():
            method = "ISBN lookup"
        else:
            method = "title/author catalog match"
        return f"Print source — existence verified via {method}; content not independently verifiable."

    if reference_type == "journal":
        return "Academic source — existence verified via DOI resolution; content not independently verifiable."

    if reference_type == "newspaper":
        return "Print source — publication recognized in the Verifact print library; content not independently verifiable."

    return "Offline source — existence verified; content not independently verifiable."


def score_citation_source(
    reference_type: str,
    citation: dict,
    citation_verified: "bool | None",
) -> dict:
    """Trust weighting for an offline citation.

    This is the ADDITIVE branch for reference_type != 'url'; it never touches the
    existing URL scoring. Rules (per spec):
      * verified  -> ONE TIER BELOW the equivalent online source
                     (verified academic book -> 'mainstream'; verified mainstream
                     newspaper print -> 'specialized').
      * unverified (None/False) -> 'unknown' (shown, but near-zero verdict weight).

    Returns the subset of scoring fields the evidence row stores:
    source_quality (category), source_quality_score, source_quality_label,
    source_quality_reason.
    """
    if citation_verified is True:
        if reference_type in {"book", "journal"}:
            # Academic-grade offline sources sit one tier below 'official'.
            quality = _one_tier_below("official")  # -> 'mainstream'
        elif reference_type == "newspaper":
            publication_tier = lookup_publication_tier(citation.get("publication")) or "specialized"
            quality = _one_tier_below(publication_tier)
        elif reference_type == "document":
            # Documents that reach here are verified out-of-band; treat as specialized.
            quality = "specialized"
        else:
            quality = "unknown"
    else:
        quality = "unknown"

    score = _TIER_SCORE.get(quality, _TIER_SCORE["unknown"])
    reason = _citation_reason(reference_type, citation, citation_verified)

    return {
        "source_quality": quality,
        "source_quality_score": score,
        "source_quality_label": source_trust_label(score),
        "source_quality_reason": reason,
    }
