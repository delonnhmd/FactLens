# PHASE 4 STEP 1
# PHASE 4 STEP 2
# PHASE 4 STEP 3
# PHASE 4 STEP 4
# PHASE 4 STEP 5
# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
# PHASE 4 STEP 5F-2
import os
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client

try:
    from services.openai_factcheck import (
        analyze_claim_with_openai,
        analyze_claim_with_openai_response,
        get_openai_model,
        test_openai_connection,
    )
except ModuleNotFoundError:  # Allows repo-root command: uvicorn backend.main:app
    from backend.services.openai_factcheck import (
        analyze_claim_with_openai,
        analyze_claim_with_openai_response,
        get_openai_model,
        test_openai_connection,
    )


load_dotenv()
app = FastAPI(title="FactLens backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


OfficialQuality = Literal["official", "mainstream", "blog", "unknown"]
AiStatus = Literal["PENDING", "LOW_RISK", "MEDIUM_RISK", "HIGH_RISK", "NEEDS_MORE_EVIDENCE", "ERROR"]


# PHASE 4 STEP 5F-2
def get_key_role(token: str | None) -> str:
    try:
        import base64
        import json

        if not token:
            return "missing"

        if token.startswith("sb_secret_"):
            return "secret_key"

        if token.startswith("sb_publishable_"):
            return "publishable_key"

        parts = token.split(".")
        if len(parts) < 2:
            return "unknown"

        payload = parts[1]
        payload += "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload.encode())
        data = json.loads(decoded)
        return data.get("role", "unknown")
    except Exception:
        return "decode_error"


# PHASE 4 STEP 5F-2
print(
    "[supabase] service role key role:",
    get_key_role(os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")),
    flush=True,
)


class AiPrecheckRequest(BaseModel):
    claim_id: str = ""
    title: str = ""
    description: str = ""
    source_url: str = ""
    category: str = ""


# PHASE 4 STEP 3
class AiPrecheckRetryRequest(BaseModel):
    claim_id: str = ""


# PHASE 4 STEP 5
class AiPrecheckTestRequest(BaseModel):
    title: str = "Coffee without sugar helps burn fat"
    description: str = "This is a test claim."
    source_url: str = "https://www.healthline.com"
    category: str = "Health"


class AiPrecheckResponse(BaseModel):
    ok: bool
    claim_id: str
    ai_confidence: float | None = None
    source_count: int | None = None
    source_quality: OfficialQuality | None = None
    red_flags: list[str] | None = None
    ai_summary: str | None = None
    ai_status: AiStatus | None = None
    error: str | None = None
    # PHASE 4 STEP 5B
    details: str | None = None
    hint: str | None = None
    ai_result: dict | None = None
    update_payload: dict | None = None
    supabase_updated: bool | None = None
    updated_claim: dict | None = None


@app.get("/")
def home():
    return {"message": "FactLens API running"}


@app.get("/health")
def health():
    return {"ok": True, "service": "FactLens backend", "version": "phase-4-step-5"}


# PHASE 4 STEP 5F-2
@app.get("/debug/supabase-role")
def debug_supabase_role():
    supabase_url = os.environ.get("SUPABASE_URL", "")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    return {
        "ok": True,
        "supabase_url_configured": bool(supabase_url),
        "service_role_key_configured": bool(service_role_key),
        "key_role": get_key_role(service_role_key),
    }


def analyze_claim(payload: AiPrecheckRequest) -> dict:
    return analyze_claim_with_openai(
        title=payload.title,
        description=payload.description,
        source_url=payload.source_url,
        category=payload.category,
    )


def get_supabase_client() -> Client:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on backend.")

    return create_client(supabase_url, service_role_key)


# PHASE 4 STEP 5B
def get_supabase_project_ref() -> str:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    hostname = urlparse(supabase_url).hostname or ""

    if hostname.endswith(".supabase.co"):
        return hostname.split(".")[0]

    return hostname or "unknown"


# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
def normalize_red_flags(red_flags: object) -> list[str]:
    if red_flags is None:
        return []

    if isinstance(red_flags, str):
        return [red_flags]

    if isinstance(red_flags, list):
        return [str(flag) for flag in red_flags]

    return [str(red_flags)]


# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
def build_claim_ai_update_payload(analysis: dict) -> dict:
    return {
        "ai_status": analysis["ai_status"],
        "ai_confidence": analysis["ai_confidence"],
        "source_quality": analysis["source_quality"],
        "source_count": analysis["source_count"],
        "red_flags": normalize_red_flags(analysis.get("red_flags")),
        "ai_summary": analysis["ai_summary"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# PHASE 4 STEP 5B
def format_supabase_error(error: Exception) -> dict:
    error_dict = getattr(error, "dict", None)

    if callable(error_dict):
        try:
            data = error_dict()
            return {
                "error": str(data.get("message") or error),
                "details": None if data.get("details") is None else str(data.get("details")),
                "hint": None if data.get("hint") is None else str(data.get("hint")),
            }
        except Exception:
            pass

    return {
        "error": str(getattr(error, "message", None) or error),
        "details": None if getattr(error, "details", None) is None else str(getattr(error, "details")),
        "hint": None if getattr(error, "hint", None) is None else str(getattr(error, "hint")),
    }


# PHASE 4 STEP 5C
def format_supabase_response_error(error: object) -> dict:
    if isinstance(error, dict):
        return {
            "error": str(error.get("message") or error),
            "details": None if error.get("details") is None else str(error.get("details")),
            "hint": None if error.get("hint") is None else str(error.get("hint")),
        }

    return {
        "error": str(getattr(error, "message", None) or error),
        "details": None if getattr(error, "details", None) is None else str(getattr(error, "details")),
        "hint": None if getattr(error, "hint", None) is None else str(getattr(error, "hint")),
    }


# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
def update_claim_ai_fields(claim_id: str, ai_result: dict, endpoint_label: str) -> dict:
    update_payload = build_claim_ai_update_payload(ai_result)
    print(f"[{endpoint_label}] Supabase project_ref:", get_supabase_project_ref(), flush=True)
    print(f"[{endpoint_label}] claim_id:", claim_id, flush=True)
    print(f"[{endpoint_label}] AI result:", ai_result, flush=True)
    print(f"[{endpoint_label}] update_payload:", update_payload, flush=True)

    try:
        supabase = get_supabase_client()
        update_result = (
            supabase.table("claims")
            .update(update_payload)
            .eq("id", claim_id)
            .execute()
        )
        print(f"[{endpoint_label}] update_result.data:", update_result.data, flush=True)

        update_error = getattr(update_result, "error", None)
        if update_error:
            formatted_error = format_supabase_response_error(update_error)
            print(f"[{endpoint_label}] update_error:", formatted_error, flush=True)
            return {
                "ok": False,
                "update_payload": update_payload,
                **formatted_error,
            }

        fetch_result = (
            supabase.table("claims")
            .select("id, ai_status, ai_confidence, source_quality, red_flags, ai_summary, source_count, updated_at")
            .eq("id", claim_id)
            .execute()
        )
    except Exception as error:
        formatted_error = format_supabase_error(error)
        print(f"[{endpoint_label}] update_error:", formatted_error, flush=True)
        return {
            "ok": False,
            "update_payload": update_payload,
            **formatted_error,
        }

    fetch_error = getattr(fetch_result, "error", None)
    if fetch_error:
        formatted_error = format_supabase_response_error(fetch_error)
        print(f"[{endpoint_label}] fetch_error:", formatted_error, flush=True)
        return {
            "ok": False,
            "update_payload": update_payload,
            **formatted_error,
        }

    updated_claim = fetch_result.data
    if isinstance(updated_claim, list):
        updated_claim = updated_claim[0] if updated_claim else None

    print(f"[{endpoint_label}] fetched updated claim:", updated_claim, flush=True)

    if not updated_claim:
        return {
            "ok": False,
            "claim_id": claim_id,
            "error": "Supabase update ran but updated claim could not be fetched",
            "update_payload": update_payload,
        }

    if updated_claim.get("ai_summary") != update_payload["ai_summary"]:
        return {
            "ok": False,
            "claim_id": claim_id,
            "error": "Supabase update did not persist new AI fields",
            "ai_result": ai_result,
            "update_payload": update_payload,
            "updated_claim": updated_claim,
        }

    return {
        "ok": True,
        "ai_result": ai_result,
        "update_payload": update_payload,
        "updated_claim": updated_claim,
    }


# PHASE 4 STEP 3
def build_ai_error_analysis() -> dict:
    return {
        "ai_confidence": 0.5,
        "source_count": 0,
        "source_quality": "unknown",
        "red_flags": ["AI pre-check failed"],
        "ai_summary": "AI pre-check failed. Community voting and evidence are still available.",
        "ai_status": "ERROR",
    }


# PHASE 4 STEP 3
def mark_claim_ai_error(claim_id: str) -> str | None:
    error_analysis = build_ai_error_analysis()
    result = update_claim_ai_fields(claim_id, error_analysis, "ai/precheck/error")

    if not result.get("ok"):
        return str(result.get("error") or "Supabase error status update failed.")

    return None


# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
def build_ai_precheck_response(claim_id: str, update_result: dict) -> dict:
    updated_claim = update_result["updated_claim"]
    red_flags = normalize_red_flags(updated_claim.get("red_flags"))

    return {
        "ok": True,
        "claim_id": claim_id,
        "ai_result": update_result.get("ai_result"),
        "update_payload": update_result.get("update_payload"),
        "ai_confidence": updated_claim.get("ai_confidence"),
        "source_count": updated_claim.get("source_count"),
        "source_quality": updated_claim.get("source_quality"),
        "red_flags": red_flags,
        "ai_summary": updated_claim.get("ai_summary"),
        "ai_status": updated_claim.get("ai_status"),
        "error": None,
        "details": None,
        "hint": None,
        "supabase_updated": True,
        "updated_claim": {
            **updated_claim,
            "red_flags": red_flags,
        },
    }


# PHASE 4 STEP 3
def fetch_claim_row(claim_id: str) -> dict | None:
    supabase = get_supabase_client()
    response = supabase.table("claims").select("*").eq("id", claim_id).limit(1).execute()
    rows = response.data or []

    if isinstance(rows, dict):
        return rows

    if not rows:
        return None

    return rows[0]


# PHASE 4 STEP 3
def build_precheck_payload_from_claim(claim: dict) -> AiPrecheckRequest:
    return AiPrecheckRequest(
        claim_id=str(claim.get("id") or ""),
        title=str(claim.get("title") or ""),
        description=str(claim.get("description") or ""),
        source_url=str(claim.get("source_url") or ""),
        category=str(claim.get("category") or ""),
    )


# PHASE 4 STEP 5
@app.get("/ai/test")
def ai_test():
    print("[ai/test] endpoint called", flush=True)
    print(f"[ai/test] OPENAI_MODEL={get_openai_model()}", flush=True)
    result = test_openai_connection()

    if result.get("ok"):
        print("[ai/test] OpenAI success", flush=True)
    else:
        print(f"[ai/test] OpenAI failure: {result.get('error')}", flush=True)

    return result


# PHASE 4 STEP 5
@app.post("/ai/precheck/test")
def ai_precheck_test(payload: AiPrecheckTestRequest):
    print("[ai/precheck/test] endpoint called", flush=True)
    print(f"[ai/precheck/test] OPENAI_MODEL={get_openai_model()}", flush=True)
    result = analyze_claim_with_openai_response(
        title=payload.title,
        description=payload.description,
        source_url=payload.source_url,
        category=payload.category,
    )

    if result.get("ok"):
        print(f"[ai/precheck/test] ai_status={result.get('ai_status')}", flush=True)
        print(f"[ai/precheck/test] ai_confidence={result.get('ai_confidence')}", flush=True)
    else:
        print(f"[ai/precheck/test] error={result.get('error')}", flush=True)

    return result


@app.post("/ai/precheck", response_model=AiPrecheckResponse)
def ai_precheck(payload: AiPrecheckRequest):
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    payload.claim_id = claim_id
    ai_result = analyze_claim_with_openai(
        title=payload.title,
        description=payload.description,
        source_url=payload.source_url,
        category=payload.category,
    )
    print("[ai/precheck] called", flush=True)
    print(f"[ai/precheck] OPENAI_MODEL={get_openai_model()}", flush=True)
    print(f"[ai/precheck] claim_id={payload.claim_id}", flush=True)
    print(f"[ai/precheck] source_url={payload.source_url}", flush=True)
    print(f"[ai/precheck] ai_status={ai_result['ai_status']}", flush=True)
    print(f"[ai/precheck] ai_confidence={ai_result['ai_confidence']}", flush=True)
    print(f"[ai/precheck] source_quality={ai_result['source_quality']}", flush=True)
    print("[ai/precheck] OpenAI analysis completed", flush=True)
    update_result = update_claim_ai_fields(payload.claim_id, ai_result, "ai/precheck")

    if not update_result.get("ok"):
        print(f"[ai/precheck] Supabase update failure: {update_result}", flush=True)
        return {
            "ok": False,
            "claim_id": payload.claim_id,
            "error": update_result.get("error"),
            "details": update_result.get("details"),
            "hint": update_result.get("hint"),
            "ai_result": update_result.get("ai_result"),
            "update_payload": update_result.get("update_payload"),
            "updated_claim": update_result.get("updated_claim"),
        }

    print("[ai/precheck] Supabase update success", flush=True)
    return build_ai_precheck_response(payload.claim_id, update_result)


# PHASE 4 STEP 3
@app.post("/ai/precheck/retry", response_model=AiPrecheckResponse)
def retry_ai_precheck(payload: AiPrecheckRetryRequest):
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    print("[ai/precheck/retry] called", flush=True)
    print(f"[ai/precheck/retry] OPENAI_MODEL={get_openai_model()}", flush=True)
    print(f"[ai/precheck/retry] claim_id={claim_id}", flush=True)

    try:
        claim = fetch_claim_row(claim_id)

        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        previous_status = claim.get("ai_status") or "PENDING"
        print(f"[ai/precheck/retry] previous_ai_status={previous_status}", flush=True)

        retry_payload = build_precheck_payload_from_claim(claim)
        ai_result = analyze_claim_with_openai(
            title=retry_payload.title,
            description=retry_payload.description,
            source_url=retry_payload.source_url,
            category=retry_payload.category,
        )
        print(f"[ai/precheck/retry] new_ai_status={ai_result['ai_status']}", flush=True)
        print(f"[ai/precheck/retry] ai_confidence={ai_result['ai_confidence']}", flush=True)
        print(f"[ai/precheck/retry] source_quality={ai_result['source_quality']}", flush=True)
        print("[ai/precheck/retry] OpenAI analysis completed", flush=True)
        update_result = update_claim_ai_fields(claim_id, ai_result, "ai/precheck/retry")

        if not update_result.get("ok"):
            print(f"[ai/precheck/retry] Supabase update failure: {update_result}", flush=True)
            return {
                "ok": False,
                "claim_id": claim_id,
                "error": update_result.get("error"),
                "details": update_result.get("details"),
                "hint": update_result.get("hint"),
                "ai_result": update_result.get("ai_result"),
                "update_payload": update_result.get("update_payload"),
                "updated_claim": update_result.get("updated_claim"),
            }

        print("[ai/precheck/retry] Supabase update success", flush=True)
        return build_ai_precheck_response(claim_id, update_result)
    except HTTPException:
        raise
    except Exception as error:
        print(f"[ai/precheck/retry] failure: {error}", flush=True)
        error_update = mark_claim_ai_error(claim_id)

        if error_update:
            print(f"[ai/precheck/retry] Supabase update failure: {error_update}", flush=True)
        else:
            print("[ai/precheck/retry] Supabase ERROR status update success", flush=True)

        error_analysis = build_ai_error_analysis()
        return {
            "ok": False,
            "claim_id": claim_id,
            **error_analysis,
            "error": "AI pre-check failed. Please retry.",
        }
