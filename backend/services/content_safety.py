# CONTENT SAFETY (additive) - objectionable-content gate at submission.
#
# This is separate from the truth/source AI analysis in openai_factcheck.py. It
# judges safety only: hate, harassment, threats/violence, sexual content
# including minors, self-harm, and obvious spam/fake engagement. It is
# deliberately politically neutral: a partisan, controversial, or hard-hitting
# factual claim is not objectionable here.
#
# Order matters:
# 1. Local blocklist loaded from backend/data/moderation_blocklist.json.
# 2. OpenAI Moderation API semantic categories.
# 3. gpt-4.1-mini semantic intent backstop.
#
# The local blocklist always runs. OpenAI failures fail open after layer 1 so a
# classifier outage cannot stop legitimate posting.

from __future__ import annotations

import json
import os
import re
import string
from pathlib import Path
from typing import Any

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - Render installs this from requirements.txt.
    OpenAI = None


MODERATION_MODEL = "omni-moderation-latest"
SEMANTIC_INTENT_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
OPENAI_TIMEOUT_SECONDS = 5.0
MAX_TEXT_CHARS = 2000

BLOCKLIST_PATH = Path(__file__).resolve().parents[1] / "data" / "moderation_blocklist.json"

# Preserve the exact local app-side threat/scam coverage that existed before
# this backend list, and cover fake-engagement spam requested by the test plan.
LEGACY_LOCAL_BLOCKLIST = [
    {
        "phrase": "i will kill",
        "category": "Category A: Violence & Harm",
        "subcategory": "Threats of Violence",
        "severity": "Critical",
        "action": "Immediate Ban & IP Log",
    },
    {
        "phrase": "i am going to kill",
        "category": "Category A: Violence & Harm",
        "subcategory": "Threats of Violence",
        "severity": "Critical",
        "action": "Immediate Ban & IP Log",
    },
    {
        "phrase": "we will kill",
        "category": "Category A: Violence & Harm",
        "subcategory": "Threats of Violence",
        "severity": "Critical",
        "action": "Immediate Ban & IP Log",
    },
    {
        "phrase": "go kill yourself",
        "category": "Category A: Violence & Harm",
        "subcategory": "Direct Call to Action",
        "severity": "Critical",
        "action": "Immediate Ban / Flag Account",
    },
    {
        "phrase": "buy followers",
        "category": "Spam",
        "subcategory": "Fake engagement",
        "severity": "High",
        "action": "Block Post & Warn User",
    },
]

MODERATION_BLOCK_CATEGORIES = {
    "sexual_minors": "sexual",
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

SEMANTIC_ALLOWED_CATEGORIES = {"violence", "hate", "sexual", "spam", "none"}
PUNCTUATION_TRANSLATION = str.maketrans({char: " " for char in string.punctuation})
PERSON_OR_GROUP_TERMS = (
    "he",
    "she",
    "they",
    "them",
    "him",
    "her",
    "someone",
    "somebody",
    "everyone",
    "everybody",
    "anyone",
    "anybody",
    "people",
    "person",
    "president",
    "senator",
    "representative",
    "governor",
    "mayor",
    "judge",
    "candidate",
    "minister",
    "officer",
    "cop",
    "police",
    "teacher",
    "doctor",
    "boss",
    "neighbor",
    "family",
    "group",
)
INDIRECT_VIOLENCE_PATTERNS = [
    re.compile(
        rf"\b(?:{'|'.join(PERSON_OR_GROUP_TERMS)})\s+"
        r"(?:needs? to|should|must|has to|have to|deserves? to)\s+"
        r"(?:be\s+)?(?:killed|murdered|shot|stabbed|executed|assassinated|die)\b"
    ),
]


def _normalize_for_match(value: str) -> str:
    lowered = str(value or "").lower().translate(PUNCTUATION_TRANSLATION)
    return re.sub(r"\s+", " ", lowered).strip()


def _entry_with_matcher(entry: dict[str, Any]) -> dict[str, Any] | None:
    phrase = str(entry.get("phrase") or "").strip()
    normalized_phrase = _normalize_for_match(phrase)

    if not normalized_phrase:
        return None

    matcher = re.compile(rf"(?<!\w){re.escape(normalized_phrase)}(?!\w)")
    return {
        "phrase": phrase,
        "category": str(entry.get("category") or "objectionable").strip() or "objectionable",
        "subcategory": str(entry.get("subcategory") or "").strip(),
        "severity": str(entry.get("severity") or "").strip(),
        "action": str(entry.get("action") or "").strip(),
        "normalized_phrase": normalized_phrase,
        "matcher": matcher,
    }


def _load_blocklist() -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []

    if BLOCKLIST_PATH.exists():
        try:
            raw_entries = json.loads(BLOCKLIST_PATH.read_text(encoding="utf-8"))
            if isinstance(raw_entries, list):
                for raw_entry in raw_entries:
                    if isinstance(raw_entry, dict):
                        entry = _entry_with_matcher(raw_entry)
                        if entry is not None:
                            entries.append(entry)
            else:
                print(f"[content_safety] blocklist is not a list: {BLOCKLIST_PATH}", flush=True)
        except Exception as error:
            print(f"[content_safety] blocklist load failed: {error}", flush=True)
    else:
        print(f"[content_safety] blocklist missing: {BLOCKLIST_PATH}", flush=True)

    for raw_entry in LEGACY_LOCAL_BLOCKLIST:
        entry = _entry_with_matcher(raw_entry)
        if entry is not None:
            entries.append(entry)

    return entries


BLOCKLIST_ENTRIES = _load_blocklist()


def _safe(category: str = "", reason: str = "", severity: str = "", matched_layer: str = "") -> dict:
    return {
        "safe": True,
        "category": category,
        "severity": severity,
        "reason": reason,
        "matched_layer": matched_layer,
    }


def _blocked(category: str, reason: str, matched_layer: str, severity: str = "") -> dict:
    return {
        "safe": False,
        "category": category,
        "severity": severity,
        "reason": reason,
        "matched_layer": matched_layer,
    }


def _check_blocklist(text: str) -> dict | None:
    normalized_text = _normalize_for_match(text)

    if not normalized_text:
        return None

    for entry in BLOCKLIST_ENTRIES:
        if entry["matcher"].search(normalized_text):
            phrase = entry["phrase"]
            return _blocked(
                entry["category"],
                f"blocklist:{phrase}",
                "blocklist",
                entry["severity"],
            )

    return None


def _check_indirect_violence_patterns(text: str) -> dict | None:
    normalized_text = _normalize_for_match(text)

    if not normalized_text:
        return None

    for pattern in INDIRECT_VIOLENCE_PATTERNS:
        if pattern.search(normalized_text):
            return _blocked(
                "violence",
                "local_pattern:indirect_violence",
                "local_pattern",
                "Critical",
            )

    return None


def _get_client():
    """OpenAI client with the timeout baked in, or None if unusable."""
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key or OpenAI is None:
        print("[content_safety] OpenAI client unavailable - failing open after blocklist", flush=True)
        return None

    return OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)


def get_content_safety_openai_status() -> dict:
    """Admin diagnostic for the two OpenAI layers. Never returns secrets."""
    status = {
        "openai_api_key_configured": bool(os.environ.get("OPENAI_API_KEY", "")),
        "openai_sdk_available": OpenAI is not None,
        "moderation_model": MODERATION_MODEL,
        "semantic_intent_model": SEMANTIC_INTENT_MODEL,
        "moderation_ok": False,
        "semantic_intent_ok": False,
        "openai_ready": False,
        "error_stage": "",
        "error_type": "",
    }

    client = _get_client()
    if client is None:
        status["error_stage"] = "client"
        status["error_type"] = "missing_configuration"
        return status

    try:
        moderation = client.moderations.create(
            model=MODERATION_MODEL,
            input="Content safety OpenAI health check. This is a neutral test.",
        )
        result = moderation.results[0]
        status["moderation_ok"] = hasattr(result, "flagged")
    except Exception as error:
        print(f"[content_safety] OpenAI moderation health check failed: {error}", flush=True)
        status["error_stage"] = "moderation"
        status["error_type"] = type(error).__name__
        return status

    try:
        semantic_verdict = _semantic_intent_check(
            client,
            "The senator voted against the border bill.",
        )
        status["semantic_intent_ok"] = bool(semantic_verdict.get("safe", False))
    except Exception as error:
        print(f"[content_safety] OpenAI semantic health check failed: {error}", flush=True)
        status["error_stage"] = "semantic_intent"
        status["error_type"] = type(error).__name__
        return status

    status["openai_ready"] = bool(status["moderation_ok"] and status["semantic_intent_ok"])
    return status


def _normalize_category_key(key: str) -> str:
    return str(key or "").replace("/", "_").replace("-", "_")


def _to_dict(obj: Any) -> dict[str, Any]:
    """Best-effort turn an OpenAI categories object into a plain dict."""
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


def _moderation_verdict(result: Any) -> dict | None:
    """Return a blocked verdict from an OpenAI moderation result, or None."""
    if not bool(getattr(result, "flagged", False)):
        return None

    categories = {
        _normalize_category_key(key): value
        for key, value in _to_dict(getattr(result, "categories", None)).items()
    }

    for key, label in MODERATION_BLOCK_CATEGORIES.items():
        if categories.get(key) is True:
            return _blocked(label, f"moderation:{key}", "moderation", "High")

    return None


def _semantic_intent_check(client: Any, text: str) -> dict:
    prompt = (
        "Does this text call for, threaten, endorse, or wish death or violence "
        "against any person or group - including indirect or third-person "
        "phrasing (e.g. 'X should be killed', 'someone needs to die')? Also "
        "flag sexual content involving minors, targeted hate, and obvious spam "
        "or fake engagement. A neutral political or factual claim is NOT a "
        "violation. Return JSON {\"violation\": true|false, "
        "\"category\": \"violence|hate|sexual|spam|none\"}."
    )

    response = client.chat.completions.create(
        model=SEMANTIC_INTENT_MODEL,
        temperature=0,
        max_tokens=40,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text},
        ],
    )
    content = (response.choices[0].message.content or "").strip()
    data = json.loads(content)

    if bool(data.get("violation")):
        category = str(data.get("category") or "violence").strip().lower().replace(" ", "_")
        if category not in SEMANTIC_ALLOWED_CATEGORIES or category == "none":
            category = "violence"
        return _blocked(category, f"semantic_intent:{category}", "semantic_intent", "High")

    return _safe()


def check_content_safety(title: str, description: str) -> dict:
    """Classify a claim's safety, not truth or politics.

    Returns {"safe", "category", "severity", "reason", "matched_layer"}.
    The local blocklist always runs. OpenAI errors fail open after layer 1.
    """
    text = f"{(title or '').strip()}\n\n{(description or '').strip()}".strip()[:MAX_TEXT_CHARS]

    if not text:
        return _safe()

    blocklist_verdict = _check_blocklist(text)
    if blocklist_verdict is not None:
        print(
            f"[content_safety] blocked by blocklist: {blocklist_verdict['reason']}",
            flush=True,
        )
        return blocklist_verdict

    indirect_violence_verdict = _check_indirect_violence_patterns(text)
    if indirect_violence_verdict is not None:
        print(
            f"[content_safety] blocked by local pattern: {indirect_violence_verdict['reason']}",
            flush=True,
        )
        return indirect_violence_verdict

    client = _get_client()
    if client is None:
        return _safe()

    try:
        moderation = client.moderations.create(model=MODERATION_MODEL, input=text)
        result = moderation.results[0]
    except Exception as error:
        print(f"[content_safety] moderation error - failing open after blocklist: {error}", flush=True)
        return _safe()

    moderation_verdict = _moderation_verdict(result)
    if moderation_verdict is not None:
        print(f"[content_safety] blocked by moderation: {moderation_verdict['category']}", flush=True)
        return moderation_verdict

    try:
        semantic_verdict = _semantic_intent_check(client, text)
    except Exception as error:
        print(f"[content_safety] semantic intent error - failing open after blocklist: {error}", flush=True)
        return _safe()

    if not semantic_verdict.get("safe", True):
        print(f"[content_safety] blocked by semantic intent: {semantic_verdict['category']}", flush=True)

    return semantic_verdict
