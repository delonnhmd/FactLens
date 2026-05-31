# PHASE 4 STEP 1
# PHASE 4 STEP 2
# PHASE 4 STEP 3
# PHASE 4 STEP 4
# PHASE 4 STEP 5
# PHASE 4 STEP 5B
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
    supabase_updated: bool | None = None
    updated_claim: dict | None = None


@app.get("/")
def home():
    return {"message": "FactLens API running"}


@app.get("/health")
def health():
    return {"ok": True, "service": "FactLens backend", "version": "phase-4-step-5"}


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
def build_claim_ai_update_payload(analysis: dict) -> dict:
    return {
        "ai_confidence": analysis["ai_confidence"],
        "source_count": analysis["source_count"],
        "source_quality": analysis["source_quality"],
        "red_flags": analysis["red_flags"],
        "ai_summary": analysis["ai_summary"],
        "ai_status": analysis["ai_status"],
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


# PHASE 4 STEP 5B
def fetch_claim_ai_fields(claim_id: str) -> dict | None:
    supabase = get_supabase_client()
    response = (
        supabase.table("claims")
        .select("ai_status,ai_confidence,source_quality,red_flags,ai_summary")
        .eq("id", claim_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []

    if isinstance(rows, dict):
        return rows

    if not rows:
        return None

    return rows[0]


# PHASE 4 STEP 5B
def update_claim_ai_fields(claim_id: str, analysis: dict) -> dict:
    payload = build_claim_ai_update_payload(analysis)
    print(f"[supabase] project_ref={get_supabase_project_ref()}", flush=True)
    print(f"[supabase] claim_id={claim_id}", flush=True)
    print(f"[supabase] update_payload={payload}", flush=True)

    try:
        supabase = get_supabase_client()
        supabase.table("claims").update(payload).eq("id", claim_id).execute()
        updated_claim = fetch_claim_ai_fields(claim_id)
    except Exception as error:
        formatted_error = format_supabase_error(error)
        print(f"[supabase] update_error={formatted_error}", flush=True)
        return {
            "ok": False,
            **formatted_error,
        }

    print(f"[supabase] updated_claim={updated_claim}", flush=True)

    if not updated_claim:
        return {
            "ok": False,
            "error": "Supabase update verification failed.",
            "details": "No claim row was returned after update.",
            "hint": "Check claim_id and claims SELECT policy/service role access.",
        }

    return {
        "ok": True,
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
    result = update_claim_ai_fields(claim_id, error_analysis)

    if not result.get("ok"):
        return str(result.get("error") or "Supabase error status update failed.")

    return None


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
    analysis = analyze_claim(payload)
    print("[ai/precheck] called", flush=True)
    print(f"[ai/precheck] OPENAI_MODEL={get_openai_model()}", flush=True)
    print(f"[ai/precheck] claim_id={payload.claim_id}", flush=True)
    print(f"[ai/precheck] source_url={payload.source_url}", flush=True)
    print(f"[ai/precheck] ai_status={analysis['ai_status']}", flush=True)
    print(f"[ai/precheck] ai_confidence={analysis['ai_confidence']}", flush=True)
    print(f"[ai/precheck] source_quality={analysis['source_quality']}", flush=True)
    print("[ai/precheck] OpenAI analysis completed", flush=True)
    update_result = update_claim_ai_fields(payload.claim_id, analysis)

    if not update_result.get("ok"):
        print(f"[ai/precheck] Supabase update failure: {update_result}", flush=True)
        error_update = mark_claim_ai_error(payload.claim_id)

        if error_update:
            print(f"[ai/precheck] Supabase ERROR status update failure: {error_update}", flush=True)
        else:
            print("[ai/precheck] Supabase ERROR status update success", flush=True)

        return {
            "ok": False,
            "claim_id": payload.claim_id,
            "error": update_result.get("error"),
            "details": update_result.get("details"),
            "hint": update_result.get("hint"),
        }

    print("[ai/precheck] Supabase update success", flush=True)
    return {
        "ok": True,
        "claim_id": payload.claim_id,
        "supabase_updated": True,
        "updated_claim": update_result.get("updated_claim"),
        **analysis,
        "error": None,
    }


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

        analysis = analyze_claim(build_precheck_payload_from_claim(claim))
        print(f"[ai/precheck/retry] new_ai_status={analysis['ai_status']}", flush=True)
        print(f"[ai/precheck/retry] ai_confidence={analysis['ai_confidence']}", flush=True)
        print(f"[ai/precheck/retry] source_quality={analysis['source_quality']}", flush=True)
        print("[ai/precheck/retry] OpenAI analysis completed", flush=True)
        update_result = update_claim_ai_fields(claim_id, analysis)

        if not update_result.get("ok"):
            print(f"[ai/precheck/retry] Supabase update failure: {update_result}", flush=True)
            return {
                "ok": False,
                "claim_id": claim_id,
                "error": update_result.get("error"),
                "details": update_result.get("details"),
                "hint": update_result.get("hint"),
            }

        print("[ai/precheck/retry] Supabase update success", flush=True)
        return {
            "ok": True,
            "claim_id": claim_id,
            "supabase_updated": True,
            "updated_claim": update_result.get("updated_claim"),
            **analysis,
            "error": None,
        }
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
