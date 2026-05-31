# PHASE 4 STEP 1
# PHASE 4 STEP 2
# PHASE 4 STEP 3
import os
from datetime import datetime, timezone
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client


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
AiStatus = Literal["PENDING", "LOW_RISK", "MEDIUM_RISK", "NEEDS_MORE_EVIDENCE", "ERROR"]


class AiPrecheckRequest(BaseModel):
    claim_id: str = ""
    title: str = ""
    description: str = ""
    source_url: str = ""
    category: str = ""


# PHASE 4 STEP 3
class AiPrecheckRetryRequest(BaseModel):
    claim_id: str = ""


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


@app.get("/")
def home():
    return {"message": "FactLens API running"}


@app.get("/health")
def health():
    return {"ok": True, "service": "FactLens backend", "version": "phase-4-step-2"}


def analyze_claim(payload: AiPrecheckRequest) -> dict:
    source_url = payload.source_url.strip()
    source_url_lower = source_url.lower()
    searchable_text = f"{payload.title} {payload.description}".lower()
    red_flags: list[str] = []

    ai_confidence = 0.50
    source_count = 0
    source_quality: OfficialQuality = "unknown"
    ai_summary = "No strong source signal found. Community voting and evidence are needed."
    ai_status: AiStatus = "PENDING"

    if not source_url:
        return {
            "ai_confidence": 0.35,
            "source_count": 0,
            "source_quality": "unknown",
            "red_flags": ["Missing source URL"],
            "ai_summary": "The claim is missing a source URL.",
            "ai_status": "NEEDS_MORE_EVIDENCE",
        }

    if any(domain in source_url_lower for domain in OFFICIAL_DOMAINS):
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

    if red_flags:
        ai_confidence = max(ai_confidence - 0.15, 0.20)
        ai_status = "MEDIUM_RISK"

        if source_quality == "unknown":
            ai_summary = "The claim contains suspicious wording and needs more community evidence."

    return {
        "ai_confidence": round(ai_confidence, 2),
        "source_count": source_count,
        "source_quality": source_quality,
        "red_flags": red_flags,
        "ai_summary": ai_summary,
        "ai_status": ai_status,
    }


def get_supabase_client() -> Client:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on backend.")

    return create_client(supabase_url, service_role_key)


def update_claim_ai_fields(claim_id: str, analysis: dict) -> str | None:
    try:
        supabase = get_supabase_client()
        supabase.table("claims").update(
            {
                "ai_confidence": analysis["ai_confidence"],
                "source_count": analysis["source_count"],
                "source_quality": analysis["source_quality"],
                "red_flags": analysis["red_flags"],
                "ai_summary": analysis["ai_summary"],
                "ai_status": analysis["ai_status"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", claim_id).execute()
    except Exception as error:
        return f"Supabase update failed: {error}"

    return None


# PHASE 4 STEP 3
def build_ai_error_analysis() -> dict:
    return {
        "ai_confidence": 0.5,
        "source_count": 0,
        "source_quality": "unknown",
        "red_flags": [],
        "ai_summary": "AI pre-check failed. Please retry.",
        "ai_status": "ERROR",
    }


# PHASE 4 STEP 3
def mark_claim_ai_error(claim_id: str) -> str | None:
    error_analysis = build_ai_error_analysis()
    try:
        supabase = get_supabase_client()
        supabase.table("claims").update(
            {
                "ai_confidence": error_analysis["ai_confidence"],
                "source_count": error_analysis["source_count"],
                "source_quality": error_analysis["source_quality"],
                "red_flags": error_analysis["red_flags"],
                "ai_summary": error_analysis["ai_summary"],
                "ai_status": error_analysis["ai_status"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", claim_id).execute()
    except Exception as error:
        return f"Supabase error status update failed: {error}"

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


@app.post("/ai/precheck", response_model=AiPrecheckResponse)
def ai_precheck(payload: AiPrecheckRequest):
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    payload.claim_id = claim_id
    analysis = analyze_claim(payload)
    print("[ai/precheck] called", flush=True)
    print(f"[ai/precheck] claim_id={payload.claim_id}", flush=True)
    print(f"[ai/precheck] source_url={payload.source_url}", flush=True)
    print(f"[ai/precheck] ai_status={analysis['ai_status']}", flush=True)
    print(f"[ai/precheck] ai_confidence={analysis['ai_confidence']}", flush=True)
    update_error = update_claim_ai_fields(payload.claim_id, analysis)

    if update_error:
        print(f"[ai/precheck] Supabase update failure: {update_error}", flush=True)
        error_update = mark_claim_ai_error(payload.claim_id)

        if error_update:
            print(f"[ai/precheck] Supabase ERROR status update failure: {error_update}", flush=True)
        else:
            print("[ai/precheck] Supabase ERROR status update success", flush=True)

        return {
            "ok": False,
            "claim_id": payload.claim_id,
            **build_ai_error_analysis(),
            "error": update_error,
        }

    print("[ai/precheck] Supabase update success", flush=True)
    return {
        "ok": True,
        "claim_id": payload.claim_id,
        **analysis,
    }


# PHASE 4 STEP 3
@app.post("/ai/precheck/retry", response_model=AiPrecheckResponse)
def retry_ai_precheck(payload: AiPrecheckRetryRequest):
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    print("[ai/precheck/retry] called", flush=True)
    print(f"[ai/precheck/retry] claim_id={claim_id}", flush=True)

    try:
        claim = fetch_claim_row(claim_id)

        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        previous_status = claim.get("ai_status") or "PENDING"
        print(f"[ai/precheck/retry] previous_ai_status={previous_status}", flush=True)

        analysis = analyze_claim(build_precheck_payload_from_claim(claim))
        print(f"[ai/precheck/retry] new_ai_status={analysis['ai_status']}", flush=True)
        update_error = update_claim_ai_fields(claim_id, analysis)

        if update_error:
            raise RuntimeError(update_error)

        print("[ai/precheck/retry] Supabase update success", flush=True)
        return {
            "ok": True,
            "claim_id": claim_id,
            **analysis,
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
