# PHASE 4 STEP 4
# PHASE 4 STEP 5
# PHASE 4 STEP 7
# PHASE 4 STEP 8
# PHASE 4 STEP 9
# PHASE 4 STEP 10
import json
import os
from typing import Literal

from pydantic import BaseModel

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - Render installs this from requirements.txt.
    OpenAI = None

try:
    from services.ai_library_loader import load_factlens_ai_library
    from services.source_credibility import score_source_url
except ModuleNotFoundError:  # Allows repo-root command: uvicorn backend.main:app
    from backend.services.ai_library_loader import load_factlens_ai_library
    from backend.services.source_credibility import score_source_url


ClaimType = Literal["FACTUAL", "OPINION", "SATIRE", "QUESTION", "PROMOTION", "UNCLEAR"]
AiStatus = Literal[
    "LOW_RISK",
    "MEDIUM_RISK",
    "HIGH_RISK",
    "NEEDS_MORE_EVIDENCE",
    "NOT_FACT_CHECKABLE",
    "ERROR",
]


class FactLensAiPrecheckResult(BaseModel):
    claim_type: ClaimType
    ai_confidence: float
    source_count: int
    source_quality: str
    evidence_used_count: int = 0
    red_flags: list[str]
    ai_summary: str
    ai_status: AiStatus


# PHASE 4 STEP 5
class FactLensAiConnectionResult(BaseModel):
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
        "source_quality": "Unknown source",
        "evidence_used_count": 0,
        "red_flags": [f"Claim type is {type_label}, not a factual news claim"],
        "ai_summary": "This appears to be an opinion or subjective claim, so FactLens cannot verify it as True or Fake.",
        "ai_status": "NOT_FACT_CHECKABLE",
    }


# PHASE 4 STEP 9
def _get_source_metadata(source_url: str, source_metadata: dict | None = None) -> dict:
    if source_metadata is not None:
        return source_metadata

    return score_source_url(source_url)


# PHASE 4 STEP 9
def _attach_source_metadata(analysis: dict, source_metadata: dict) -> dict:
    source_quality = str(source_metadata.get("source_quality") or "Unknown source").strip() or "Unknown source"

    source_score = source_metadata.get("source_score")

    try:
        normalized_score = int(source_score)
    except (TypeError, ValueError):
        normalized_score = 40

    next_analysis = {
        **analysis,
        "source_quality": source_quality,
        "source_domain": str(source_metadata.get("domain") or ""),
        "source_score": max(0, min(normalized_score, 100)),
        "source_reason": str(source_metadata.get("source_reason") or ""),
    }

    red_flags = list(next_analysis.get("red_flags") or [])

    if next_analysis["source_score"] < 50 and not any("low credibility" in flag.lower() for flag in red_flags):
        red_flags.append("Low credibility source needs corroborating evidence")
        if next_analysis.get("ai_status") == "LOW_RISK":
            next_analysis["ai_status"] = "NEEDS_MORE_EVIDENCE"
        next_analysis["ai_confidence"] = min(_clamp_confidence(next_analysis.get("ai_confidence")), 0.55)
    elif source_quality.lower() == "unknown source" and next_analysis["source_score"] <= 40:
        next_analysis["ai_confidence"] = min(_clamp_confidence(next_analysis.get("ai_confidence")), 0.60)

    next_analysis["red_flags"] = red_flags[:8]
    return next_analysis


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
) -> dict:
    source_url_lower = source_url.strip().lower()
    scored_source = _get_source_metadata(source_url, source_metadata)
    normalized_evidence = _normalize_evidence_rows(evidence_rows)
    searchable_text = f"{title} {description}".lower()
    red_flags: list[str] = []

    ai_confidence = 0.50
    source_count = 0
    source_quality = str(scored_source.get("source_quality") or "Unknown source")
    source_score = int(scored_source.get("source_score") or 40)
    ai_summary = "No strong source signal found. Community voting and evidence are needed."
    ai_status: AiStatus = "NEEDS_MORE_EVIDENCE"
    claim_type: ClaimType = "FACTUAL"

    non_fact_checkable_type = _classify_non_fact_checkable(title, description)
    if non_fact_checkable_type and non_fact_checkable_type != "UNCLEAR":
        return _attach_evidence_metadata(
            _attach_source_metadata(_not_fact_checkable_analysis(non_fact_checkable_type), scored_source),
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
        ai_summary = "The source has a high credibility score in the FactLens library."
        ai_status = "LOW_RISK"
    elif source_score >= 70:
        ai_confidence = 0.58
        source_count = 1
        ai_summary = "The source has an established credibility score in the FactLens library."
        ai_status = "LOW_RISK"
    elif source_score >= 50:
        ai_confidence = 0.50
        source_count = 1
        ai_summary = "The source has a mixed credibility score, so corroborating evidence may be needed."
    elif source_quality.lower() == "unknown source":
        ai_confidence = 0.40
        ai_summary = "Unknown source. The domain is not in the FactLens credibility library."
    else:
        ai_confidence = 0.35
        red_flags.append("Low credibility source needs corroborating evidence")
        ai_summary = "The source has a low credibility score in the FactLens library."

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
        "red_flags": red_flags,
        "ai_summary": ai_summary,
        "ai_status": ai_status,
    }

    return _attach_evidence_metadata(_attach_source_metadata(analysis, scored_source), normalized_evidence)


def _error_analysis() -> dict:
    return {
        "claim_type": "UNCLEAR",
        "ai_confidence": 0.5,
        "source_count": 0,
        "source_quality": "Unknown source",
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
    source_quality = str(raw_result.get("source_quality") or "Unknown source").strip() or "Unknown source"
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
        source_quality = "Unknown source"
        source_count = 0
        evidence_used_count = 0

    ai_summary = str(raw_result.get("ai_summary") or "").strip()

    if not ai_summary:
        if ai_status == "NOT_FACT_CHECKABLE":
            ai_summary = "This appears to be an opinion or subjective claim, so FactLens cannot verify it as True or Fake."
        else:
            ai_summary = "AI pre-check could not find enough support. Community voting and evidence are still needed."

    if ai_status == "NOT_FACT_CHECKABLE" and not red_flags:
        red_flags = [f"Claim type is {claim_type.lower()}, not a factual news claim"]

    return {
        "claim_type": claim_type,
        "ai_confidence": ai_confidence,
        "source_count": max(source_count, 0),
        "source_quality": source_quality,
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

    if "factlens ai is connected" in message.lower():
        return "FactLens AI is connected"

    return message or "FactLens AI is connected"


def _build_prompt(
    title: str,
    description: str,
    source_url: str,
    category: str,
    source_metadata: dict,
    evidence_rows: list[dict] | None = None,
) -> list[dict]:
    # PHASE 4 STEP 8
    # PHASE 4 STEP 9
    # PHASE 4 STEP 10
    # PHASE 4 STEP 16
    ai_library = load_factlens_ai_library()
    ai_library_json = json.dumps(ai_library, ensure_ascii=True, sort_keys=True)
    source_metadata_for_prompt = {
        key: value for key, value in source_metadata.items() if key != "source_lean"
    }
    source_metadata_json = json.dumps(source_metadata_for_prompt, ensure_ascii=True, sort_keys=True)
    evidence_json = json.dumps(_normalize_evidence_rows(evidence_rows), ensure_ascii=True, sort_keys=True)
    system_prompt = (
        "You are the AI pre-check engine for FactLens. "
        "Use the FactLens AI Teaching Library below as the highest priority platform rule set. "
        "You do not decide the final truth. You provide risk signals only. "
        "Analyze the claim, source URL, and wording. Return only valid JSON. "
        "Do not make final verdicts. "
        "AI is risk signal only. "
        "Before judging support, classify claim_type as FACTUAL, OPINION, SATIRE, QUESTION, PROMOTION, or UNCLEAR. "
        "OPINION means subjective taste, preference, quality judgment, or personal feeling, such as 'Solo Leveling is good', 'This movie is boring', or 'Bitcoin is better than gold'. "
        "FACTUAL means it can be verified by evidence, such as 'Coffee improves memory' or 'City council approved a transit program'. "
        "QUESTION means the user asks a question instead of making a claim. PROMOTION means advertising or self-promotion. SATIRE means joke, parody, or satire. UNCLEAR means too vague to classify. "
        "If claim_type is OPINION, QUESTION, SATIRE, or PROMOTION, set ai_status to NOT_FACT_CHECKABLE, ai_confidence to 0.5, source_count to 0, explain why in red_flags, and say in ai_summary that it is not a factual claim that can be verified as true or fake. "
        "Do not claim certainty. Do not say definitely true or definitely fake. "
        "Do not invent sources. If not enough evidence, say NEEDS_MORE_EVIDENCE. "
        "If source is weak or unknown, reduce confidence. "
        "Official source metadata can increase confidence only if that source supports the claim. "
        "Social source metadata must not be treated as strong evidence alone. "
        "Unknown source metadata should lower confidence. "
        "Source score is not final truth. It is only one signal. "
        "Community evidence links are user-submitted signals, not final truth. "
        "Increase confidence only if community evidence supports the claim. "
        "Decrease confidence if community evidence contradicts the claim. "
        "Keep NEEDS_MORE_EVIDENCE if evidence is weak, social-only, irrelevant, or does not address the claim. "
        "Never invent evidence. Mention evidence in ai_summary only when you used it. "
        "Set evidence_used_count to the number of provided community evidence links you considered. "
        "No live search is available in this call, so source_count must count only the main source and provided community evidence that you actually use. "
        f"FactLens AI Teaching Library: {ai_library_json}"
    )
    user_prompt = (
        "Main source:\n"
        f"Title: {title or ''}\n"
        f"Description: {description or ''}\n"
        f"Source URL: {source_url or ''}\n"
        f"Category: {category or 'Other'}\n"
        f"Source score: {source_metadata.get('source_score')}\n"
        f"Source quality: {source_metadata.get('source_quality')}\n"
        f"FactLens source metadata: {source_metadata_json}\n"
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
                    "content": "Return JSON saying FactLens AI is connected.",
                },
            ],
            text_format=FactLensAiConnectionResult,
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
            ),
        }

    model = get_openai_model()

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.parse(
            model=model,
            input=_build_prompt(title, description, source_url, category, scored_source, normalized_evidence),
            text_format=FactLensAiPrecheckResult,
        )
        parsed = getattr(response, "output_parsed", None)

        if parsed is not None:
            print("[openai] AI pre-check success", flush=True)
            return {
                "ok": True,
                **_attach_evidence_metadata(
                    _attach_source_metadata(_normalize_analysis(_model_to_dict(parsed)), scored_source),
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
                    _attach_source_metadata(_normalize_analysis(raw_result), scored_source),
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
            **_attach_evidence_metadata(_attach_source_metadata(_error_analysis(), scored_source), normalized_evidence),
            "error": "AI pre-check failed. Please retry.",
        }


def analyze_claim_with_openai(
    title: str,
    description: str,
    source_url: str,
    category: str,
    source_metadata: dict | None = None,
    evidence_rows: list[dict] | None = None,
) -> dict:
    result = analyze_claim_with_openai_response(title, description, source_url, category, source_metadata, evidence_rows)

    if result.get("ok"):
        return {key: value for key, value in result.items() if key not in {"ok", "error", "raw"}}

    scored_source = _get_source_metadata(source_url, source_metadata)
    return _attach_evidence_metadata(_attach_source_metadata(_error_analysis(), scored_source), evidence_rows)
