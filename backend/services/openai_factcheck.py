# PHASE 4 STEP 4
# PHASE 4 STEP 5
# PHASE 4 STEP 7
# PHASE 4 STEP 8
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
except ModuleNotFoundError:  # Allows repo-root command: uvicorn backend.main:app
    from backend.services.ai_library_loader import load_factlens_ai_library


SourceQuality = Literal["official", "mainstream", "blog", "unknown"]
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
    source_quality: SourceQuality
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

SOURCE_QUALITIES = {"official", "mainstream", "blog", "unknown"}
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
        "source_quality": "unknown",
        "red_flags": [f"Claim type is {type_label}, not a factual news claim"],
        "ai_summary": "This appears to be an opinion or subjective claim, so FactLens cannot verify it as True or Fake.",
        "ai_status": "NOT_FACT_CHECKABLE",
    }


def _fallback_source_risk_analysis(
    title: str,
    description: str,
    source_url: str,
    openai_missing: bool = False,
) -> dict:
    source_url_lower = source_url.strip().lower()
    searchable_text = f"{title} {description}".lower()
    red_flags: list[str] = []

    ai_confidence = 0.50
    source_count = 0
    source_quality: SourceQuality = "unknown"
    ai_summary = "No strong source signal found. Community voting and evidence are needed."
    ai_status: AiStatus = "NEEDS_MORE_EVIDENCE"
    claim_type: ClaimType = "FACTUAL"

    non_fact_checkable_type = _classify_non_fact_checkable(title, description)
    if non_fact_checkable_type and non_fact_checkable_type != "UNCLEAR":
        return _not_fact_checkable_analysis(non_fact_checkable_type)

    if non_fact_checkable_type == "UNCLEAR":
        claim_type = "UNCLEAR"

    if not source_url_lower:
        ai_confidence = 0.35
        red_flags.append("Missing source URL")
        ai_summary = "The claim is missing a source URL."
    elif any(domain in source_url_lower for domain in OFFICIAL_DOMAINS):
        ai_confidence = 0.65
        source_count = 1
        source_quality = "official"
        ai_summary = "The source appears to be an official or institutional source."
        ai_status = "LOW_RISK"
    elif any(domain in source_url_lower for domain in MAINSTREAM_DOMAINS):
        ai_confidence = 0.60
        source_count = 1
        source_quality = "mainstream"
        ai_summary = "The source appears to be a mainstream news source."
        ai_status = "LOW_RISK"

    for term in SUSPICIOUS_TERMS:
        if term in searchable_text:
            red_flags.append(f"Suspicious wording: {term}")

    if red_flags and source_quality == "unknown":
        ai_confidence = min(ai_confidence, 0.35)
        ai_status = "HIGH_RISK"
        ai_summary = "The claim contains suspicious wording and needs more community evidence."
    elif red_flags:
        ai_confidence = max(ai_confidence - 0.15, 0.20)
        ai_status = "MEDIUM_RISK"

    if openai_missing:
        red_flags.append("OpenAI API key not configured")

    return {
        "claim_type": claim_type,
        "ai_confidence": round(ai_confidence, 2),
        "source_count": source_count,
        "source_quality": source_quality,
        "red_flags": red_flags,
        "ai_summary": ai_summary,
        "ai_status": ai_status,
    }


def _error_analysis() -> dict:
    return {
        "claim_type": "UNCLEAR",
        "ai_confidence": 0.5,
        "source_count": 0,
        "source_quality": "unknown",
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
    source_quality = str(raw_result.get("source_quality") or "unknown").lower()
    ai_status = str(raw_result.get("ai_status") or "NEEDS_MORE_EVIDENCE").upper()
    red_flags = raw_result.get("red_flags")

    if claim_type not in CLAIM_TYPES:
        claim_type = "UNCLEAR"

    if source_quality not in SOURCE_QUALITIES:
        source_quality = "unknown"

    if ai_status not in AI_STATUSES:
        ai_status = "NEEDS_MORE_EVIDENCE"

    if not isinstance(red_flags, list):
        red_flags = []

    try:
        source_count = int(raw_result.get("source_count") or 0)
    except (TypeError, ValueError):
        source_count = 0

    ai_confidence = _clamp_confidence(raw_result.get("ai_confidence"))

    if claim_type in {"OPINION", "QUESTION", "SATIRE", "PROMOTION"}:
        ai_status = "NOT_FACT_CHECKABLE"
        ai_confidence = 0.5
        source_quality = "unknown"
        source_count = 0

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


def _build_prompt(title: str, description: str, source_url: str, category: str) -> list[dict]:
    # PHASE 4 STEP 8
    ai_library = load_factlens_ai_library()
    ai_library_json = json.dumps(ai_library, ensure_ascii=True, sort_keys=True)
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
        "If claim_type is OPINION, QUESTION, SATIRE, or PROMOTION, set ai_status to NOT_FACT_CHECKABLE, ai_confidence to 0.5, source_count to 0, source_quality to unknown, explain why in red_flags, and say in ai_summary that it is not a factual claim that can be verified as true or fake. "
        "Do not claim certainty. Do not say definitely true or definitely fake. "
        "Do not invent sources. If not enough evidence, say NEEDS_MORE_EVIDENCE. "
        "If source is weak or unknown, reduce confidence. "
        "No live search is available in this call, so source_count must be 0 unless the submitted text explicitly mentions corroborating sources. "
        f"FactLens AI Teaching Library: {ai_library_json}"
    )
    user_prompt = (
        f"Title: {title or ''}\n"
        f"Description: {description or ''}\n"
        f"Source URL: {source_url or ''}\n"
        f"Category: {category or 'Other'}"
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
def analyze_claim_with_openai_response(title: str, description: str, source_url: str, category: str) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key or OpenAI is None:
        print("[openai] OpenAI client unavailable or API key missing; using fallback source-risk logic", flush=True)
        return {
            "ok": True,
            **_fallback_source_risk_analysis(title, description, source_url, openai_missing=True),
        }

    model = get_openai_model()

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.parse(
            model=model,
            input=_build_prompt(title, description, source_url, category),
            text_format=FactLensAiPrecheckResult,
        )
        parsed = getattr(response, "output_parsed", None)

        if parsed is not None:
            print("[openai] AI pre-check success", flush=True)
            return {
                "ok": True,
                **_normalize_analysis(_model_to_dict(parsed)),
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
                **_normalize_analysis(raw_result),
            }

        return _invalid_json_response("")
    except json.JSONDecodeError as error:
        return _invalid_json_response(str(error))
    except Exception as error:
        print(f"[openai] AI pre-check failure: {error}", flush=True)
        return {
            "ok": False,
            **_error_analysis(),
            "error": "AI pre-check failed. Please retry.",
        }


def analyze_claim_with_openai(title: str, description: str, source_url: str, category: str) -> dict:
    result = analyze_claim_with_openai_response(title, description, source_url, category)

    if result.get("ok"):
        return {key: value for key, value in result.items() if key not in {"ok", "error", "raw"}}

    return _error_analysis()
