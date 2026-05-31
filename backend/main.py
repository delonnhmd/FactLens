# PHASE 4 STEP 1
import json
import os
from datetime import datetime, timezone
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(title="FactLens backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


OfficialQuality = Literal["official", "mainstream", "blog", "unknown"]
AiStatus = Literal["PENDING", "LOW_RISK", "MEDIUM_RISK", "NEEDS_MORE_EVIDENCE"]


class AiPrecheckRequest(BaseModel):
    claim_id: str = Field(..., min_length=1)
    title: str = ""
    description: str = ""
    source_url: str = ""
    category: str = ""


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
    return {"ok": True, "service": "FactLens backend"}


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


def update_claim_ai_fields(claim_id: str, analysis: dict) -> str | None:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        return "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on backend."

    update_url = f"{supabase_url}/rest/v1/claims?id=eq.{claim_id}"
    body = json.dumps(
        {
            "ai_confidence": analysis["ai_confidence"],
            "source_count": analysis["source_count"],
            "source_quality": analysis["source_quality"],
            "red_flags": analysis["red_flags"],
            "ai_summary": analysis["ai_summary"],
            "ai_status": analysis["ai_status"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).encode("utf-8")
    request = Request(
        update_url,
        data=body,
        method="PATCH",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )

    try:
        with urlopen(request, timeout=15) as response:
            if response.status >= 400:
                return f"Supabase update failed with HTTP {response.status}."
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        return f"Supabase update failed: HTTP {error.code}. {details}"
    except URLError as error:
        return f"Supabase update failed: {error.reason}"
    except TimeoutError:
        return "Supabase update timed out."

    return None


@app.post("/ai/precheck", response_model=AiPrecheckResponse)
def ai_precheck(payload: AiPrecheckRequest):
    analysis = analyze_claim(payload)
    update_error = update_claim_ai_fields(payload.claim_id, analysis)

    if update_error:
        return {
            "ok": False,
            "claim_id": payload.claim_id,
            **analysis,
            "error": update_error,
        }

    return {
        "ok": True,
        "claim_id": payload.claim_id,
        **analysis,
    }
