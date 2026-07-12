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
# Keep these patterns in lockstep with the frontend VIOLENCE_PATTERNS in
# utils/claimSafety.ts — both are exercised by the same must-block / must-allow
# lists (backend/tests/test_content_safety_patterns.py and
# utils/__tests__/claimSafety.test.ts). Base-form verb lists (kill, shoot, …)
# deliberately exclude past participles (killed, shot) so factual reporting like
# "the victim was killed" is NOT blocked, while commands ("kill him") are.
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
    "politician",
    "congressman",
    "congresswoman",
)
_PERSON_GROUP = "(?:%s)" % "|".join(PERSON_OR_GROUP_TERMS)
_VIOLENCE_VERB = "(?:kill|shoot|stab|execute|assassinate|hang|murder|behead|lynch|strangle|slaughter)"
# Targets include third-person pronouns AND person nouns (optionally preceded by
# "the"), so "assassinate the president" is caught while "kill jobs" is not.
_DIRECT_TARGET = (
    "(?:him|her|them|you|us|me|president|senator|representative|governor|mayor|"
    "judge|candidate|minister|officer|cop|police|politician|congressman|"
    "congresswoman|prime\\s+minister)"
)
# Patterns run on text already passed through _normalize_for_match (lowercased,
# punctuation -> space, whitespace collapsed), so no IGNORECASE flag is needed.
INDIRECT_VIOLENCE_PATTERNS = [
    # 1. First-person / group stated intent.
    re.compile(
        r"\b(?:i|we)\s+(?:will|shall|am going to|are going to|gonna|plan to|want to|intend to)\s+"
        r"(?:kill|shoot|stab|bomb|attack|murder|assassinate|behead|lynch)\b"
    ),
    re.compile(r"\bgoing to\s+(?:kill|shoot|stab|bomb|attack|murder|assassinate)\b"),
    # 2. Advocacy / wish that a person or group be killed (incl. third-person phrasing).
    re.compile(
        rf"\b(?:the\s+)?{_PERSON_GROUP}\s+"
        r"(?:needs? to|should|must|has to|have to|deserves? to|ought to|gotta)\s+"
        r"(?:be\s+)?(?:killed|murdered|shot|stabbed|executed|assassinated|hanged|hung|lynched|beheaded|die|died|dead)\b"
    ),
    # 3. Bare "... should/needs to die".
    re.compile(r"\b(?:needs? to|should|must|has to|have to|deserves? to|ought to)\s+die\b"),
    # 4. Imperative / command to attack a target (base-form verb keeps reporting safe).
    re.compile(rf"\b{_VIOLENCE_VERB}\s+(?:the\s+)?{_DIRECT_TARGET}\b"),
    # 5. Literal death threat.
    re.compile(r"\bdeath\s+threat\b"),
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

    # flagged=True but no MAPPED category matched (e.g. a category OpenAI adds
    # later, or a non-bool value). Every omni-moderation category is harmful, so
    # any flagged result blocks. Report the true categories for observability.
    flagged_keys = sorted(key for key, value in categories.items() if value is True)
    return _blocked(
        "objectionable",
        f"moderation:flagged:{','.join(flagged_keys) or 'unmapped'}",
        "moderation",
        "High",
    )


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
    safe_title = (title or "").strip()
    safe_description = (description or "").strip()
    text = f"{safe_title}\n\n{safe_description}".strip()[:MAX_TEXT_CHARS]
    log_context = {
        "title_length": len(safe_title),
        "description_length": len(safe_description),
        "deterministic_safe": True,
        "deterministic_layer": "",
        "openai_moderation": "not_run",
        "openai_semantic": "not_run",
        "final_allowed": True,
        "final_layer": "",
    }

    if not text:
        print(f"[content_safety] decision {log_context}", flush=True)
        return _safe()

    blocklist_verdict = _check_blocklist(text)
    if blocklist_verdict is not None:
        log_context.update({
            "deterministic_safe": False,
            "deterministic_layer": blocklist_verdict.get("matched_layer", "blocklist"),
            "final_allowed": False,
            "final_layer": blocklist_verdict.get("matched_layer", "blocklist"),
        })
        print(
            f"[content_safety] blocked by blocklist: {blocklist_verdict['reason']}",
            flush=True,
        )
        print(f"[content_safety] decision {log_context}", flush=True)
        return blocklist_verdict

    indirect_violence_verdict = _check_indirect_violence_patterns(text)
    if indirect_violence_verdict is not None:
        log_context.update({
            "deterministic_safe": False,
            "deterministic_layer": indirect_violence_verdict.get("matched_layer", "local_pattern"),
            "final_allowed": False,
            "final_layer": indirect_violence_verdict.get("matched_layer", "local_pattern"),
        })
        print(
            f"[content_safety] blocked by local pattern: {indirect_violence_verdict['reason']}",
            flush=True,
        )
        print(f"[content_safety] decision {log_context}", flush=True)
        return indirect_violence_verdict

    client = _get_client()
    if client is None:
        log_context["openai_moderation"] = "unavailable"
        log_context["openai_semantic"] = "unavailable"
        print(f"[content_safety] decision {log_context}", flush=True)
        return _safe()

    try:
        moderation = client.moderations.create(model=MODERATION_MODEL, input=text)
        result = moderation.results[0]
    except Exception as error:
        print(f"[content_safety] moderation error - failing open after blocklist: {error}", flush=True)
        log_context["openai_moderation"] = f"error:{type(error).__name__}"
        log_context["openai_semantic"] = "not_run"
        print(f"[content_safety] decision {log_context}", flush=True)
        return _safe()

    moderation_verdict = _moderation_verdict(result)
    if moderation_verdict is not None:
        log_context.update({
            "openai_moderation": f"blocked:{moderation_verdict.get('category', '')}",
            "final_allowed": False,
            "final_layer": moderation_verdict.get("matched_layer", "moderation"),
        })
        print(f"[content_safety] blocked by moderation: {moderation_verdict['category']}", flush=True)
        print(f"[content_safety] decision {log_context}", flush=True)
        return moderation_verdict

    log_context["openai_moderation"] = "allowed"

    try:
        semantic_verdict = _semantic_intent_check(client, text)
    except Exception as error:
        print(f"[content_safety] semantic intent error - failing open after blocklist: {error}", flush=True)
        log_context["openai_semantic"] = f"error:{type(error).__name__}"
        print(f"[content_safety] decision {log_context}", flush=True)
        return _safe()

    if not semantic_verdict.get("safe", True):
        log_context.update({
            "openai_semantic": f"blocked:{semantic_verdict.get('category', '')}",
            "final_allowed": False,
            "final_layer": semantic_verdict.get("matched_layer", "semantic_intent"),
        })
        print(f"[content_safety] blocked by semantic intent: {semantic_verdict['category']}", flush=True)
        print(f"[content_safety] decision {log_context}", flush=True)
        return semantic_verdict

    log_context["openai_semantic"] = "allowed"
    print(f"[content_safety] decision {log_context}", flush=True)
    return semantic_verdict


def classify_for_gate(title: str, description: str, log_id: str = "") -> dict:
    """Strict gate classification for the server-side webhook/sweep (Part 1c).

    Shares every layer helper with check_content_safety() — one implementation,
    two entry points — but with the OPPOSITE failure posture. check_content_safety
    fails OPEN (a classifier outage returns "safe" so a legitimate post is never
    blocked from the user-facing /check-safety path). This gate fails CLOSED: when
    the OpenAI layers cannot run or error, it returns decision "PENDING" so the
    claim stays under review and the retry sweep re-checks it. It NEVER approves
    on error.

    Returns {"decision": "BLOCKED"|"APPROVED"|"PENDING", "category", "severity",
             "reason", "matched_layer"}.
    """
    safe_title = (title or "").strip()
    safe_description = (description or "").strip()
    text = f"{safe_title}\n\n{safe_description}".strip()[:MAX_TEXT_CHARS]

    if not text:
        return {"decision": "APPROVED", "category": "", "severity": "", "reason": "empty", "matched_layer": ""}

    # Layer 0 — deterministic, always runs (blocklist + indirect-violence regex).
    deterministic = _check_blocklist(text) or _check_indirect_violence_patterns(text)
    if deterministic is not None:
        print(f"[safety-gate] {log_id} BLOCKED deterministic {deterministic['reason']}", flush=True)
        return {
            "decision": "BLOCKED",
            "category": deterministic.get("category", "objectionable"),
            "severity": deterministic.get("severity", ""),
            "reason": deterministic.get("reason", ""),
            "matched_layer": deterministic.get("matched_layer", ""),
        }

    client = _get_client()
    if client is None:
        # Fail CLOSED: cannot verify -> leave PENDING for the sweep. Never approve.
        print(f"[safety-gate] {log_id} PENDING openai_unavailable", flush=True)
        return {"decision": "PENDING", "category": "", "severity": "", "reason": "openai_unavailable", "matched_layer": ""}

    # Layer 1 — OpenAI moderation. Log the RAW response for Render-log proof.
    try:
        moderation = client.moderations.create(model=MODERATION_MODEL, input=text)
        result = moderation.results[0]
        flagged = bool(getattr(result, "flagged", False))
        categories_json = json.dumps(_to_dict(getattr(result, "categories", None)), default=str)
        print("[moderation raw]", log_id, flagged, categories_json, flush=True)
    except Exception as error:
        print(f"[safety-gate] {log_id} PENDING moderation_error:{type(error).__name__}", flush=True)
        return {"decision": "PENDING", "category": "", "severity": "", "reason": f"moderation_error:{type(error).__name__}", "matched_layer": ""}

    moderation_verdict = _moderation_verdict(result)
    if moderation_verdict is not None:
        print(f"[safety-gate] {log_id} BLOCKED moderation {moderation_verdict['reason']}", flush=True)
        return {
            "decision": "BLOCKED",
            "category": moderation_verdict.get("category", "objectionable"),
            "severity": moderation_verdict.get("severity", ""),
            "reason": moderation_verdict.get("reason", ""),
            "matched_layer": moderation_verdict.get("matched_layer", "moderation"),
        }

    # Layer 2 — gpt-4.1-mini semantic intent backstop.
    try:
        semantic_verdict = _semantic_intent_check(client, text)
    except Exception as error:
        print(f"[safety-gate] {log_id} PENDING semantic_error:{type(error).__name__}", flush=True)
        return {"decision": "PENDING", "category": "", "severity": "", "reason": f"semantic_error:{type(error).__name__}", "matched_layer": ""}

    if not semantic_verdict.get("safe", True):
        print(f"[safety-gate] {log_id} BLOCKED semantic {semantic_verdict['reason']}", flush=True)
        return {
            "decision": "BLOCKED",
            "category": semantic_verdict.get("category", "violence"),
            "severity": semantic_verdict.get("severity", ""),
            "reason": semantic_verdict.get("reason", ""),
            "matched_layer": semantic_verdict.get("matched_layer", "semantic_intent"),
        }

    print(f"[safety-gate] {log_id} APPROVED", flush=True)
    return {"decision": "APPROVED", "category": "", "severity": "", "reason": "", "matched_layer": ""}
