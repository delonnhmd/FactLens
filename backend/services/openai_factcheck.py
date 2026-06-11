# PHASE 4 STEP 4
# PHASE 4 STEP 5
# PHASE 4 STEP 7
# PHASE 4 STEP 8
# PHASE 4 STEP 9
# PHASE 4 STEP 10
# PHASE 4 STEP 17
# PHASE 4 STEP 18
# PHASE 4 STEP 20
# PHASE 4 STEP 20B
# PHASE 4 STEP 21
import json
import os
from typing import Literal

from pydantic import BaseModel

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - Render installs this from requirements.txt.
    OpenAI = None

try:
    from services.ai_library_loader import load_verifact_ai_library
    from services.source_credibility import normalize_source_quality, score_source_url
except ModuleNotFoundError:  # Allows repo-root command: uvicorn backend.main:app
    from backend.services.ai_library_loader import load_verifact_ai_library
    from backend.services.source_credibility import normalize_source_quality, score_source_url


ClaimType = Literal["FACTUAL", "OPINION", "SATIRE", "QUESTION", "PROMOTION", "UNCLEAR"]
AiStatus = Literal[
    "LOW_RISK",
    "MEDIUM_RISK",
    "HIGH_RISK",
    "NEEDS_MORE_EVIDENCE",
    "NOT_FACT_CHECKABLE",
    "ERROR",
]


class VerifactAiPrecheckResult(BaseModel):
    claim_type: ClaimType
    ai_confidence: float
    source_count: int
    source_quality: str
    source_supports_claim: bool | None = None
    source_support_summary: str = ""
    evidence_used_count: int = 0
    red_flags: list[str]
    ai_summary: str
    ai_status: AiStatus


# PHASE 4 STEP 5
class VerifactAiConnectionResult(BaseModel):
    message: str


OFFICIAL_DOMAINS = [
    ".gov",
    ".edu",
    "who.int",
    "cdc.gov",
    "fda.gov",
    "sec.gov",
    "federalreserve.gov",
]

MAINSTREAM_DOMAINS = [
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "cnn.com",
    "nbcnews.com",
    "cbsnews.com",
    "abcnews.go.com",
    "nytimes.com",
    "washingtonpost.com",
]

SUSPICIOUS_TERMS = [
    "shocking",
    "secret",
    "leaked",
    "viral",
    "rumor",
    "anonymous",
    "miracle cure",
    "guaranteed",
    "everyone is hiding",
]

CLAIM_TYPES = {"FACTUAL", "OPINION", "SATIRE", "QUESTION", "PROMOTION", "UNCLEAR"}
AI_STATUSES = {"LOW_RISK", "MEDIUM_RISK", "HIGH_RISK", "NEEDS_MORE_EVIDENCE", "NOT_FACT_CHECKABLE", "ERROR"}
SOURCE_REVIEW_UNAVAILABLE_SUMMARY = (
    "We could not automatically read this source. Community review can still continue."
)
SOURCE_REVIEW_UNAVAILABLE_AI_SUMMARY = (
    "Source could not be automatically reviewed. Please check the source manually and add evidence."
)


# PHASE 4 STEP 7
def _classify_non_fact_checkable(title: str, description: str) -> ClaimType | None:
    text = f"{title} {description}".strip().lower()
    title_text = title.strip()

    if not text:
        return "UNCLEAR"

    if title_text.endswith("?") or text.startswith(("is ", "are ", "can ", "could ", "should ", "do ", "does ", "did ", "what ", "why ", "how ")):
        return "QUESTION"

    promotion_terms = ["buy now", "use my code", "promo code", "discount", "sponsored", "affiliate", "subscribe to"]
    if any(term in text for term in promotion_terms):
        return "PROMOTION"

    satire_terms = ["satire", "parody", "joke", "meme"]
    if any(term in text for term in satire_terms):
        return "SATIRE"

    opinion_terms = [
        "is good",
        "is bad",
        "is better",
        "is worse",
        "boring",
        "amazing",
        "awesome",
        "terrible",
        "best",
        "worst",
        "i like",
        "i hate",
        "overrated",
        "underrated",
    ]
    if any(term in text for term in opinion_terms):
        return "OPINION"

    return None


def _not_fact_checkable_analysis(claim_type: ClaimType) -> dict:
    type_label = claim_type.lower().replace("_", " ")
    return {
        "claim_type": claim_type,
        "ai_confidence": 0.5,
        "source_count": 0,
        "source_quality": "unknown",
        "evidence_used_count": 0,
        "red_flags": [f"Claim type is {type_label}, not a factual news claim"],
        "ai_summary": "This appears to be an opinion or subjective claim, so Verifact cannot verify it as True or Fake.",
        "ai_status": "NOT_FACT_CHECKABLE",
    }


# PHASE 4 STEP 9
def _get_source_metadata(source_url: str, source_metadata: dict | None = None) -> dict:
    if source_metadata is not None:
        return source_metadata

    return score_source_url(source_url)


# PHASE 4 STEP 9
def _attach_source_metadata(analysis: dict, source_metadata: dict) -> dict:
    source_quality = normalize_source_quality(source_metadata.get("source_quality"))

    source_score = source_metadata.get("source_score")

    try:
        normalized_score = int(source_score)
    except (TypeError, ValueError):
        normalized_score = 40

    next_analysis = {
        **analysis,
        "source_quality": source_quality,
        "source_domain": str(source_metadata.get("source_domain") or source_metadata.get("domain") or ""),
        "source_score": max(0, min(normalized_score, 100)),
        "source_reason": str(source_metadata.get("source_reason") or ""),
    }

    red_flags = list(next_analysis.get("red_flags") or [])

    if next_analysis["source_score"] < 50 and not any("low credibility" in flag.lower() for flag in red_flags):
        red_flags.append("Low credibility source needs corroborating evidence")
        if next_analysis.get("ai_status") == "LOW_RISK":
            next_analysis["ai_status"] = "NEEDS_MORE_EVIDENCE"
        next_analysis["ai_confidence"] = min(_clamp_confidence(next_analysis.get("ai_confidence")), 0.55)
    elif source_quality == "unknown" and next_analysis["source_score"] <= 40:
        next_analysis["ai_confidence"] = min(_clamp_confidence(next_analysis.get("ai_confidence")), 0.60)

    next_analysis["red_flags"] = red_flags[:8]
    return next_analysis


# PHASE 4 STEP 21
def _attach_source_page_metadata(analysis: dict, source_page: dict | None = None) -> dict:
    source_page = source_page or {}
    read_status = str(source_page.get("status") or "not_read").strip().lower()

    if read_status not in {"read", "failed", "not_read"}:
        read_status = "failed"

    source_supports_claim = analysis.get("source_supports_claim")
    if not isinstance(source_supports_claim, bool):
        source_supports_claim = None

    source_excerpt = str(source_page.get("excerpt") or "").strip()[:6000]
    if read_status != "read" or not source_excerpt:
        source_supports_claim = None

    source_support_summary = str(analysis.get("source_support_summary") or "").strip()
    page_error = str(source_page.get("error") or "").strip()

    if read_status != "read":
        source_support_summary = SOURCE_REVIEW_UNAVAILABLE_SUMMARY
        analysis = {
            **analysis,
            "source_quality": "unknown",
            "source_score": 45,
            "source_count": 0,
            "ai_status": "NEEDS_MORE_EVIDENCE",
            "ai_summary": SOURCE_REVIEW_UNAVAILABLE_AI_SUMMARY,
            "red_flags": [
                flag
                for flag in list(analysis.get("red_flags") or [])
                if "http" not in str(flag).lower()
                and "traceback" not in str(flag).lower()
                and "client error" not in str(flag).lower()
            ][:7]
            + ["Source review unavailable"],
        }
    elif not source_support_summary:
        source_support_summary = "Source page was read, but source-support analysis is pending."

    return {
        **analysis,
        "source_read_status": read_status,
        "source_page_title": str(source_page.get("title") or "").strip()[:300],
        "source_excerpt": source_excerpt,
        "source_supports_claim": source_supports_claim,
        "source_support_summary": source_support_summary[:500],
    }


# PHASE 4 STEP 10
def _normalize_evidence_rows(evidence_rows: list[dict] | None = None) -> list[dict]:
    normalized_rows: list[dict] = []

    for row in (evidence_rows or [])[:10]:
        normalized_rows.append(
            {
                "id": str(row.get("id") or ""),
                "url": str(row.get("url") or ""),
                "note": str(row.get("note") or "")[:500],
                "evidence_type": str(row.get("evidence_type") or "UNCLEAR"),
                "source_quality_label": row.get("source_quality_label"),
                "source_quality_score": row.get("source_quality_score"),
                "created_at": str(row.get("created_at") or ""),
            }
        )

    return normalized_rows


# PHASE 4 STEP 10
def _attach_evidence_metadata(analysis: dict, evidence_rows: list[dict] | None = None) -> dict:
    return {
        **analysis,
        "evidence_used_count": len(_normalize_evidence_rows(evidence_rows)),
    }


def _fallback_source_risk_analysis(
    title: str,
    description: str,
    source_url: str,
    openai_missing: bool = False,
    source_metadata: dict | None = None,
    evidence_rows: list[dict] | None = None,
    source_page: dict | None = None,
) -> dict:
    source_url_lower = source_url.strip().lower()
    scored_source = _get_source_metadata(source_url, source_metadata)
    normalized_evidence = _normalize_evidence_rows(evidence_rows)
    searchable_text = f"{title} {description}".lower()
    red_flags: list[str] = []

    ai_confidence = 0.50
    source_count = 0
    source_quality = normalize_source_quality(scored_source.get("source_quality"))
    source_score = int(scored_source.get("source_score") or 40)
    source_message = str(scored_source.get("source_message") or scored_source.get("source_reason") or "")
    ai_summary = "No strong source signal found. Community voting and evidence are needed."
    ai_status: AiStatus = "NEEDS_MORE_EVIDENCE"
    claim_type: ClaimType = "FACTUAL"

    non_fact_checkable_type = _classify_non_fact_checkable(title, description)
    if non_fact_checkable_type and non_fact_checkable_type != "UNCLEAR":
        return _attach_evidence_metadata(
            _attach_source_page_metadata(
                _attach_source_metadata(_not_fact_checkable_analysis(non_fact_checkable_type), scored_source),
                source_page,
            ),
            normalized_evidence,
        )

    if non_fact_checkable_type == "UNCLEAR":
        claim_type = "UNCLEAR"

    if not source_url_lower:
        ai_confidence = 0.35
        red_flags.append("Missing source URL")
        ai_summary = "The claim is missing a source URL."
    elif source_score >= 85:
        ai_confidence = 0.65
        source_count = 1
        ai_summary = "The source has a high credibility score in the Verifact library."
        ai_status = "LOW_RISK"
    elif source_score >= 70:
        ai_confidence = 0.58
        source_count = 1
        ai_summary = "The source has an established credibility score in the Verifact library."
        ai_status = "LOW_RISK"
    elif source_score >= 50:
        ai_confidence = 0.50
        source_count = 1
        ai_summary = "The source has a mixed credibility score, so corroborating evidence may be needed."
    elif source_quality == "unknown":
        ai_confidence = 0.40
        ai_summary = source_message or "This source needs community verification."
    else:
        ai_confidence = 0.35
        red_flags.append("Low credibility source needs corroborating evidence")
        ai_summary = "The source has a low credibility score in the Verifact library."

    for term in SUSPICIOUS_TERMS:
        if term in searchable_text:
            red_flags.append(f"Suspicious wording: {term}")

    if red_flags and source_score <= 40:
        ai_confidence = min(ai_confidence, 0.35)
        ai_status = "HIGH_RISK"
        ai_summary = "The claim contains suspicious wording and needs more community evidence."
    elif red_flags:
        ai_confidence = max(ai_confidence - 0.15, 0.20)
        ai_status = "MEDIUM_RISK"

    if openai_missing:
        red_flags.append("OpenAI API key not configured")

    if normalized_evidence:
        source_count = max(source_count, 1 + len(normalized_evidence))
        ai_summary = "Community evidence links were included for AI retry, but OpenAI is unavailable."

    analysis = {
        "claim_type": claim_type,
        "ai_confidence": round(ai_confidence, 2),
        "source_count": source_count,
        "source_quality": source_quality,
        "source_supports_claim": None,
        "source_support_summary": "",
        "red_flags": red_flags,
        "ai_summary": ai_summary,
        "ai_status": ai_status,
    }

    return _attach_evidence_metadata(
        _attach_source_page_metadata(_attach_source_metadata(analysis, scored_source), source_page),
        normalized_evidence,
    )


def _error_analysis() -> dict:
    return {
        "claim_type": "UNCLEAR",
        "ai_confidence": 0.5,
        "source_count": 0,
        "source_quality": "unknown",
        "evidence_used_count": 0,
        "red_flags": ["AI pre-check failed"],
        "ai_summary": "AI pre-check failed. Community voting and evidence are still available.",
        "ai_status": "ERROR",
    }


def _clamp_confidence(value: object) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.5

    if confidence > 1:
        confidence = confidence / 100

    return round(min(max(confidence, 0.0), 1.0), 2)


def _normalize_analysis(raw_result: dict) -> dict:
    claim_type = str(raw_result.get("claim_type") or "UNCLEAR").upper()
    source_quality = normalize_source_quality(raw_result.get("source_quality"))
    ai_status = str(raw_result.get("ai_status") or "NEEDS_MORE_EVIDENCE").upper()
    red_flags = raw_result.get("red_flags")

    if claim_type not in CLAIM_TYPES:
        claim_type = "UNCLEAR"

    if ai_status not in AI_STATUSES:
        ai_status = "NEEDS_MORE_EVIDENCE"

    if not isinstance(red_flags, list):
        red_flags = []

    try:
        source_count = int(raw_result.get("source_count") or 0)
    except (TypeError, ValueError):
        source_count = 0

    # PHASE 4 STEP 10
    try:
        evidence_used_count = int(raw_result.get("evidence_used_count") or 0)
    except (TypeError, ValueError):
        evidence_used_count = 0

    ai_confidence = _clamp_confidence(raw_result.get("ai_confidence"))

    if claim_type in {"OPINION", "QUESTION", "SATIRE", "PROMOTION"}:
        ai_status = "NOT_FACT_CHECKABLE"
        ai_confidence = 0.5
        source_quality = "unknown"
        source_count = 0
        evidence_used_count = 0

    ai_summary = str(raw_result.get("ai_summary") or "").strip()
    source_supports_claim = raw_result.get("source_supports_claim")
    if not isinstance(source_supports_claim, bool):
        source_supports_claim = None

    source_support_summary = str(raw_result.get("source_support_summary") or "").strip()

    if not ai_summary:
        if ai_status == "NOT_FACT_CHECKABLE":
            ai_summary = "This appears to be an opinion or subjective claim, so Verifact cannot verify it as True or Fake."
        else:
            ai_summary = "AI pre-check could not find enough support. Community voting and evidence are still needed."

    if not source_support_summary:
        if source_supports_claim is True:
            source_support_summary = "The source excerpt appears to support the claim."
        elif source_supports_claim is False:
            source_support_summary = "The source excerpt does not appear to support the claim."
        else:
            source_support_summary = "The source excerpt was missing or not enough to evaluate support."

    if ai_status == "NOT_FACT_CHECKABLE" and not red_flags:
        red_flags = [f"Claim type is {claim_type.lower()}, not a factual news claim"]

    return {
        "claim_type": claim_type,
        "ai_confidence": ai_confidence,
        "source_count": max(source_count, 0),
        "source_quality": source_quality,
        "source_supports_claim": source_supports_claim,
        "source_support_summary": source_support_summary[:500],
        "evidence_used_count": max(evidence_used_count, 0),
        "red_flags": [str(flag) for flag in red_flags[:8]],
        "ai_summary": ai_summary[:500],
        "ai_status": ai_status,
    }


def _model_to_dict(parsed: BaseModel) -> dict:
    if hasattr(parsed, "model_dump"):
        return parsed.model_dump()

    return parsed.dict()


def _invalid_json_response(raw: str) -> dict:
    return {
        "ok": False,
        "error": "Invalid AI JSON response",
        "raw": raw,
    }


def _normalize_connection_message(value: object) -> str:
    message = str(value or "").strip()

    if "ai is connected" in message.lower():
        return "Verifact AI is connected"

    return message or "Verifact AI is connected"


def _build_prompt(
    title: str,
    description: str,
    source_url: str,
    category: str,
    source_metadata: dict,
    source_page: dict | None = None,
    evidence_rows: list[dict] | None = None,
) -> list[dict]:
    # PHASE 4 STEP 8
    # PHASE 4 STEP 9
    # PHASE 4 STEP 10
    # PHASE 4 STEP 16
    # PHASE 4 STEP 18
    ai_library = load_verifact_ai_library()
    ai_library_json = json.dumps(ai_library, ensure_ascii=True, sort_keys=True)
    source_metadata_for_prompt = dict(source_metadata)
    source_metadata_json = json.dumps(source_metadata_for_prompt, ensure_ascii=True, sort_keys=True)
    source_page_for_prompt = {
        "status": str((source_page or {}).get("status") or "not_read"),
        "title": str((source_page or {}).get("title") or ""),
        "meta_description": str((source_page or {}).get("meta_description") or ""),
        "excerpt": str((source_page or {}).get("excerpt") or "")[:6000],
        "error": str((source_page or {}).get("error") or ""),
    }
    source_page_json = json.dumps(source_page_for_prompt, ensure_ascii=True, sort_keys=True)
    evidence_json = json.dumps(_normalize_evidence_rows(evidence_rows), ensure_ascii=True, sort_keys=True)
    system_prompt = (
        "You are the AI pre-check engine for Verifact. "
        "Use the Verifact AI Teaching Library below as the highest priority platform rule set. "
        "You do not decide the final truth. You provide risk signals only. "
        "Analyze the claim, source URL, and wording. Return only valid JSON. "
        "Do not make final verdicts. "
        "AI is risk signal only. "
        "Before judging support, classify claim_type as FACTUAL, OPINION, SATIRE, QUESTION, PROMOTION, or UNCLEAR. "
        "OPINION means subjective taste, preference, quality judgment, or personal feeling, such as 'Solo Leveling is good', 'This movie is boring', or 'Bitcoin is better than gold'. "
        "FACTUAL means it can be verified by evidence, such as 'Coffee improves memory' or 'City council approved a transit program'. "
        "QUESTION means the user asks a question instead of making a claim. PROMOTION means advertising or self-promotion. SATIRE means joke, parody, or satire. UNCLEAR means too vague to classify. "
        "If claim_type is OPINION, QUESTION, SATIRE, or PROMOTION, set ai_status to NOT_FACT_CHECKABLE, ai_confidence to 0.5, source_count to 0, explain why in red_flags, and say in ai_summary that it is not a factual claim that can be verified as true or fake. "
        # PHASE 4 STEP 20B
        "source_quality must be exactly one of: official, mainstream, specialized, social, blog, unknown. "
        "Never return verify, verified, verification, credible, not credible, moderate, moderate credibility, needs_more_evidence, low_risk, medium_risk, high_risk, opinion, question, satire, promotion, unclear, or not_fact_checkable as source_quality. "
        "If you want to say verify with additional evidence or moderate credibility, put that text in source_reason, ai_summary, or red_flags, never in source_quality. "
        "Opinion, question, satire, promotion, and unclear belong only in claim_type. "
        "Verifact already scored the source using source_domain, source_quality, source_score, and source_reason. "
        "Do not override official, mainstream, specialized, or social source_quality from Verifact source scoring. "
        "Use source quality as a signal, but do not assume the source supports the claim unless the content actually matches the claim. "
        # PHASE 4 STEP 21
        "You are given fetched source page content with source_page_title, source_meta_description, and source_excerpt. "
        "Evaluate whether the fetched source excerpt appears to support the user's claim, partially support it, contradict it, is unrelated, or is weak evidence. "
        "Set source_supports_claim to true only when the source excerpt clearly supports the claim. "
        "Set source_supports_claim to false when the source excerpt contradicts the claim, is unrelated, or is too weak to support it. "
        "Set source_supports_claim to null when the source excerpt is missing, unreadable, or not enough to evaluate. "
        "Do not hallucinate source content beyond the provided excerpt. Keep source_support_summary concise. "
        "Return JSON with source_supports_claim and source_support_summary. "
        "Do not claim certainty. Do not say definitely true or definitely fake. "
        "Do not invent sources. If not enough evidence, say NEEDS_MORE_EVIDENCE. "
        "If source is weak or unknown, reduce confidence. "
        "Official source metadata can increase confidence only if that source supports the claim. "
        "Social source metadata must not be treated as strong evidence alone. "
        "Unlisted source metadata should lower confidence. "
        "Source score is not final truth. It is only one signal. "
        "Community evidence links are user-submitted signals, not final truth. "
        "Increase confidence only if community evidence supports the claim. "
        "Decrease confidence if community evidence contradicts the claim. "
        "Keep NEEDS_MORE_EVIDENCE if evidence is weak, social-only, irrelevant, or does not address the claim. "
        "Never invent evidence. Mention evidence in ai_summary only when you used it. "
        "Set evidence_used_count to the number of provided community evidence links you considered. "
        "No live search is available in this call, so source_count must count only the main source and provided community evidence that you actually use. "
        f"Verifact AI Teaching Library: {ai_library_json}"
    )
    user_prompt = (
        "Main source:\n"
        f"Title: {title or ''}\n"
        f"Description: {description or ''}\n"
        f"Source URL: {source_url or ''}\n"
        f"Category: {category or 'Other'}\n"
        f"Source score: {source_metadata.get('source_score')}\n"
        f"Source quality: {source_metadata.get('source_quality')}\n"
        f"Verifact source metadata: {source_metadata_json}\n"
        f"Source page read status: {source_page_for_prompt.get('status')}\n"
        f"Source page title: {source_page_for_prompt.get('title')}\n"
        f"Source meta description: {source_page_for_prompt.get('meta_description')}\n"
        f"Source excerpt: {source_page_for_prompt.get('excerpt')}\n"
        f"Fetched source page: {source_page_json}\n"
        f"Community evidence: {evidence_json}"
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def get_openai_model() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")


# PHASE 4 STEP 5
def openai_api_key_exists() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", ""))


# PHASE 4 STEP 5
def test_openai_connection() -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key:
        return {
            "ok": False,
            "error": "OPENAI_API_KEY missing",
        }

    if OpenAI is None:
        return {
            "ok": False,
            "error": "OpenAI SDK missing",
        }

    model = get_openai_model()

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.parse(
            model=model,
            input=[
                {
                    "role": "system",
                    "content": "Return only JSON that matches the requested schema.",
                },
                {
                    "role": "user",
                    "content": "Return JSON saying Verifact AI is connected.",
                },
            ],
            text_format=VerifactAiConnectionResult,
        )
        parsed = getattr(response, "output_parsed", None)

        if parsed is not None:
            return {
                "ok": True,
                "model": model,
                "message": _normalize_connection_message(_model_to_dict(parsed).get("message")),
            }

        raw = getattr(response, "output_text", "") or ""

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return _invalid_json_response(raw)

        return {
            "ok": True,
            "model": model,
            "message": _normalize_connection_message(data.get("message")),
        }
    except json.JSONDecodeError as error:
        return _invalid_json_response(str(error))
    except Exception as error:
        print(f"[openai] connection test failure: {error}", flush=True)
        return {
            "ok": False,
            "error": str(error),
        }


# PHASE 4 STEP 5
def analyze_claim_with_openai_response(
    title: str,
    description: str,
    source_url: str,
    category: str,
    source_metadata: dict | None = None,
    source_page: dict | None = None,
    evidence_rows: list[dict] | None = None,
) -> dict:
    # PHASE 4 STEP 9
    scored_source = _get_source_metadata(source_url, source_metadata)
    # PHASE 4 STEP 10
    normalized_evidence = _normalize_evidence_rows(evidence_rows)
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key or OpenAI is None:
        print("[openai] OpenAI client unavailable or API key missing; using fallback source-risk logic", flush=True)
        return {
            "ok": True,
            **_fallback_source_risk_analysis(
                title,
                description,
                source_url,
                openai_missing=True,
                source_metadata=scored_source,
                evidence_rows=normalized_evidence,
                source_page=source_page,
            ),
        }

    model = get_openai_model()

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.parse(
            model=model,
            input=_build_prompt(title, description, source_url, category, scored_source, source_page, normalized_evidence),
            text_format=VerifactAiPrecheckResult,
        )
        parsed = getattr(response, "output_parsed", None)

        if parsed is not None:
            print("[openai] AI pre-check success", flush=True)
            return {
                "ok": True,
                **_attach_evidence_metadata(
                    _attach_source_page_metadata(
                        _attach_source_metadata(_normalize_analysis(_model_to_dict(parsed)), scored_source),
                        source_page,
                    ),
                    normalized_evidence,
                ),
            }

        output_text = getattr(response, "output_text", "")

        if output_text:
            print("[openai] AI pre-check success", flush=True)
            try:
                raw_result = json.loads(output_text)
            except json.JSONDecodeError:
                return _invalid_json_response(output_text)

            return {
                "ok": True,
                **_attach_evidence_metadata(
                    _attach_source_page_metadata(
                        _attach_source_metadata(_normalize_analysis(raw_result), scored_source),
                        source_page,
                    ),
                    normalized_evidence,
                ),
            }

        return _invalid_json_response("")
    except json.JSONDecodeError as error:
        return _invalid_json_response(str(error))
    except Exception as error:
        print(f"[openai] AI pre-check failure: {error}", flush=True)
        return {
            "ok": False,
            **_attach_evidence_metadata(
                _attach_source_page_metadata(_attach_source_metadata(_error_analysis(), scored_source), source_page),
                normalized_evidence,
            ),
            "error": "AI pre-check failed. Please retry.",
        }


def analyze_claim_with_openai(
    title: str,
    description: str,
    source_url: str,
    category: str,
    source_metadata: dict | None = None,
    source_page: dict | None = None,
    evidence_rows: list[dict] | None = None,
) -> dict:
    result = analyze_claim_with_openai_response(title, description, source_url, category, source_metadata, source_page, evidence_rows)

    if result.get("ok"):
        return {key: value for key, value in result.items() if key not in {"ok", "error", "raw"}}

    scored_source = _get_source_metadata(source_url, source_metadata)
    return _attach_evidence_metadata(
        _attach_source_page_metadata(_attach_source_metadata(_error_analysis(), scored_source), source_page),
        evidence_rows,
    )
