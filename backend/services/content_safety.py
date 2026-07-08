# CONTENT SAFETY (NEW, additive) — objectionable-content gate at submission.
#
# This is a SEPARATE gate from the truth/source AI analysis in
# openai_factcheck.py (which this module does NOT touch). It judges SAFETY only:
# hate, harassment, threats/violence, sexual content (incl. minors), self-harm,
# and spam. It is deliberately POLITICALLY NEUTRAL — a partisan, controversial,
# or hard-hitting FACTUAL claim is never objectionable here. OpenAI's moderation
# has no "political" category, so partisan claims are not flagged by layer A, and
# layer B is instructed explicitly to allow them.
#
# Design rule (same as embedding_service): the safety check must NEVER block
# posting because the safety API itself failed. Every path FAILS OPEN — on a
# missing key, timeout, or error it returns safe=True and logs. The report flow
# still catches anything that slips through.

import json
import os

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - Render installs this from requirements.txt.
    OpenAI = None


# Purpose-built, fast, and free — the first line of defense.
MODERATION_MODEL = "omni-moderation-latest"
# Cheap second pass; also the only layer that can see "spam" (moderation has no
# spam category). Kept in sync with the rest of the backend's default model.
SECOND_PASS_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")

# 5s hard ceiling per submission — a slow OpenAI call can't hold posting open.
OPENAI_TIMEOUT_SECONDS = 5.0

# Only the leading text feeds the classifier; long bodies add cost/latency.
MAX_TEXT_CHARS = 2000

# Moderation categories we treat as hard blocks, normalized to underscores so we
# match whether the SDK hands us alias ("sexual/minors") or field ("sexual_minors")
# names. Value = the simple label we log / surface.
BLOCK_CATEGORIES = {
    "sexual_minors": "sexual_minors",
    "sexual": "sexual",
    "hate": "hate",
    "hate_threatening": "hate",
    "harassment": "harassment",
    "harassment_threatening": "harassment",
    "violence": "violence",
    "violence_graphic": "violence",
    "self_harm": "self_harm",
    "self_harm_intent": "self_harm",
    "self_harm_instructions": "self_harm",
}

# A category-score at/above HARD is blocked even if the boolean flag is False;
# scores in [BORDER, HARD) are "unclear" and defer to the layer-B LLM.
HARD_SCORE = 0.5
BORDER_SCORE = 0.3


def _safe(category: str = "", reason: str = "") -> dict:
    return {"safe": True, "category": category, "reason": reason}


def _blocked(category: str, reason: str) -> dict:
    return {"safe": False, "category": category, "reason": reason}


def _get_client():
    """OpenAI client with the 5s timeout baked in, or None if unusable.

    None is treated by callers identically to an API error: fail open.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key or OpenAI is None:
        print("[content_safety] OpenAI client unavailable — failing open (safe)", flush=True)
        return None

    return OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)


def _normalize_key(key: str) -> str:
    return key.replace("/", "_").replace("-", "_")


def _to_dict(obj) -> dict:
    """Best-effort turn an OpenAI categories/scores object into a plain dict.

    Defensive across SDK versions: model_dump (pydantic v2), dict fallback.
    """
    if obj is None:
        return {}

    dump = getattr(obj, "model_dump", None)
    if callable(dump):
        try:
            return dump()
        except Exception:
            pass

    if isinstance(obj, dict):
        return obj

    try:
        return dict(obj)
    except Exception:
        return {}


def _moderation_verdict(result) -> "dict | None":
    """Return a blocked verdict from a moderation result, or None if clean.

    Blocks when a block-category boolean is True OR its score >= HARD_SCORE.
    """
    categories = {_normalize_key(k): v for k, v in _to_dict(getattr(result, "categories", None)).items()}
    scores = {_normalize_key(k): v for k, v in _to_dict(getattr(result, "category_scores", None)).items()}

    for key, label in BLOCK_CATEGORIES.items():
        flagged = categories.get(key) is True

        try:
            score = float(scores.get(key) or 0.0)
        except (TypeError, ValueError):
            score = 0.0

        if flagged or score >= HARD_SCORE:
            return _blocked(label, f"moderation:{key}")

    return None


def _is_borderline(result) -> bool:
    scores = {_normalize_key(k): v for k, v in _to_dict(getattr(result, "category_scores", None)).items()}

    for key in BLOCK_CATEGORIES:
        try:
            score = float(scores.get(key) or 0.0)
        except (TypeError, ValueError):
            score = 0.0

        if BORDER_SCORE <= score < HARD_SCORE:
            return True

    return False


def _second_pass(client, text: str) -> dict:
    """gpt-4.1-mini backstop: catches spam (no moderation category) and borderline
    safety cases. Explicitly told political/controversial factual claims are fine.
    """
    prompt = (
        "You are a content-safety filter. Is this content hate speech, harassment, "
        "a threat, sexual content, or spam? A political or controversial FACTUAL "
        "claim is NOT objectionable. Return JSON "
        '{"objectionable": true|false, "category": "..."}.'
    )

    response = client.chat.completions.create(
        model=SECOND_PASS_MODEL,
        temperature=0,
        max_tokens=30,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text},
        ],
    )
    content = (response.choices[0].message.content or "").strip()
    data = json.loads(content)

    if bool(data.get("objectionable")):
        category = str(data.get("category") or "objectionable").strip().lower().replace(" ", "_")[:40]
        return _blocked(category or "objectionable", "llm:objectionable")

    return _safe()


def check_content_safety(title: str, description: str) -> dict:
    """Classify a claim's SAFETY (not truth, not politics).

    Returns {"safe": bool, "category": str, "reason": str}. Fails OPEN on any
    error/timeout/missing key.
    """
    text = f"{(title or '').strip()}\n\n{(description or '').strip()}".strip()[:MAX_TEXT_CHARS]

    if not text:
        return _safe()

    client = _get_client()

    if client is None:
        return _safe()  # fail open

    # Layer A — OpenAI Moderation API (purpose-built, free, fast).
    try:
        moderation = client.moderations.create(model=MODERATION_MODEL, input=text)
        result = moderation.results[0]
    except Exception as error:
        print(f"[content_safety] moderation error — failing open: {error}", flush=True)
        return _safe()  # fail open

    verdict = _moderation_verdict(result)

    if verdict is not None:
        print(f"[content_safety] blocked by moderation: {verdict['category']}", flush=True)
        return verdict

    # Layer B — gpt-4.1-mini backstop. Moderation has no "spam" category, so this
    # runs whenever layer A did not hard-block: it is what catches spam, and it
    # resolves borderline safety scores. Fails open on any error.
    try:
        return _second_pass(client, text)
    except Exception as error:
        print(f"[content_safety] second-pass error — failing open: {error}", flush=True)
        return _safe()  # fail open
