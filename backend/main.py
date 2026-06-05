# PHASE 4 STEP 1
# PHASE 4 STEP 2
# PHASE 4 STEP 3
# PHASE 4 STEP 4
# PHASE 4 STEP 5
# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
# PHASE 4 STEP 5F-2
# PHASE 4 STEP 7
# PHASE 4 STEP 8
# PHASE 4 STEP 9
# PHASE 4 STEP 10
# PHASE 4 STEP 17
# PHASE 4 STEP 18
# PHASE 4 STEP 27
import os
from datetime import datetime, timezone
from time import monotonic
from typing import Literal
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client

try:
    from services.openai_factcheck import (
        analyze_claim_with_openai,
        get_openai_model,
    )
    from services.ai_library_loader import load_factlens_ai_library
    from services.source_page_fetcher import fetch_source_page
    from services.source_credibility import score_source_url
except ModuleNotFoundError:  # Allows repo-root command: uvicorn backend.main:app
    from backend.services.openai_factcheck import (
        analyze_claim_with_openai,
        get_openai_model,
    )
    from backend.services.ai_library_loader import load_factlens_ai_library
    from backend.services.source_page_fetcher import fetch_source_page
    from backend.services.source_credibility import score_source_url


load_dotenv()
# PHASE 4 STEP 27
app = FastAPI(title="FactLens backend", docs_url=None, redoc_url=None, openapi_url=None)

# PHASE 4 STEP 20
# PHASE 4 STEP 20C
ALLOWED_SOURCE_QUALITIES = {
    "official",
    "mainstream",
    "specialized",
    "social",
    "blog",
    "unknown",
}


# PHASE 4 STEP 20C
def normalize_source_quality(value):
    if value is None:
        return "unknown"

    normalized_value = str(value).strip().lower()

    if normalized_value in ALLOWED_SOURCE_QUALITIES:
        return normalized_value

    return "unknown"


# PHASE 5 STEP 1B
RANK_ORDER = [
    "New Scout",
    "Claim Checker",
    "Trusted Verifier",
    "Source Hunter",
    "FactLens Guardian",
]


def calculate_trust_tier(trust_score):
    score = max(0, min(100, float(trust_score or 50)))
    if score >= 75:
        return "HIGH_TRUST"
    if score >= 55:
        return "TRUSTED"
    if score >= 30:
        return "BASIC"
    return "LOW_TRUST"


def calculate_rank_title(trust_score):
    score = max(0, min(100, float(trust_score or 50)))
    if score >= 90:
        return "FactLens Guardian"
    if score >= 75:
        return "Source Hunter"
    if score >= 55:
        return "Trusted Verifier"
    if score >= 30:
        return "Claim Checker"
    return "New Scout"


def calculate_vote_weight(trust_tier):
    weights = {
        "LOW_TRUST": 0.75,
        "BASIC": 1.0,
        "TRUSTED": 1.2,
        "HIGH_TRUST": 1.4,
    }
    return weights.get(str(trust_tier or "BASIC").upper(), 1.0)


def resolve_display_rank(current_rank, highest_rank_achieved):
    current_index = RANK_ORDER.index(current_rank) if current_rank in RANK_ORDER else 0
    highest_index = RANK_ORDER.index(highest_rank_achieved) if highest_rank_achieved in RANK_ORDER else 0
    return RANK_ORDER[max(current_index, highest_index)]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


ClaimType = Literal["FACTUAL", "OPINION", "SATIRE", "QUESTION", "PROMOTION", "UNCLEAR"]
AiStatus = Literal[
    "PENDING",
    "LOW_RISK",
    "MEDIUM_RISK",
    "HIGH_RISK",
    "NEEDS_MORE_EVIDENCE",
    "NOT_FACT_CHECKABLE",
    "ERROR",
]


# PHASE 4 STEP 27
AI_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
AI_RATE_LIMIT_MAX_REQUESTS = 30
AI_CLAIM_COOLDOWN_SECONDS = 45
SOURCE_SCORE_RATE_LIMIT_MAX_REQUESTS = 120
RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}
CLAIM_AI_COOLDOWNS: dict[str, float] = {}


# PHASE 4 STEP 27
def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or "unknown"

    return request.client.host if request.client else "unknown"


# PHASE 4 STEP 27
def enforce_rate_limit(request: Request, bucket: str, max_requests: int, window_seconds: int) -> None:
    now = monotonic()
    key = f"{bucket}:{get_client_ip(request)}"
    recent_requests = [
        timestamp
        for timestamp in RATE_LIMIT_BUCKETS.get(key, [])
        if now - timestamp < window_seconds
    ]

    if len(recent_requests) >= max_requests:
        print("[rate-limit] blocked:", bucket, get_client_ip(request), flush=True)
        raise HTTPException(status_code=429, detail="Too many actions. Please try again later.")

    recent_requests.append(now)
    RATE_LIMIT_BUCKETS[key] = recent_requests


# PHASE 4 STEP 27
def enforce_claim_ai_cooldown(claim_id: str) -> None:
    now = monotonic()
    last_request = CLAIM_AI_COOLDOWNS.get(claim_id)

    if last_request is not None and now - last_request < AI_CLAIM_COOLDOWN_SECONDS:
        print("[ai cooldown] blocked claim:", claim_id, flush=True)
        raise HTTPException(status_code=429, detail="AI pre-check was just run. Please try again later.")

    CLAIM_AI_COOLDOWNS[claim_id] = now


class AiPrecheckRequest(BaseModel):
    claim_id: str = ""
    title: str = ""
    description: str = ""
    source_url: str = ""
    category: str = ""


# PHASE 4 STEP 3
class AiPrecheckRetryRequest(BaseModel):
    claim_id: str = ""


# PHASE 5 STEP 1B
class AdminOverrideRequest(BaseModel):
    claim_id: str = ""
    new_status: str = ""
    reason: str = ""


# PHASE 5 STEP 2
class AdminReportActionRequest(BaseModel):
    status: str = "RESOLVED"
    admin_note: str = ""
    hide_target: bool = False


# PHASE 5 STEP 3
class AdminContentVisibilityRequest(BaseModel):
    target_type: str = "CLAIM"
    target_id: str = ""
    reason: str = ""


class AiPrecheckResponse(BaseModel):
    ok: bool
    claim_id: str
    # PHASE 4 STEP 7
    claim_type: ClaimType | None = None
    ai_confidence: float | None = None
    source_count: int | None = None
    source_quality: str | None = None
    # PHASE 4 STEP 9
    source_domain: str | None = None
    source_score: int | None = None
    source_reason: str | None = None
    # PHASE 4 STEP 21
    source_read_status: str | None = None
    source_page_title: str | None = None
    source_supports_claim: bool | None = None
    source_support_summary: str | None = None
    # PHASE 4 STEP 10
    evidence_used_count: int | None = None
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
    # PHASE 4 STEP 21B
    return {"ok": True, "service": "FactLens backend", "version": "phase-4-step-21b"}


# PHASE 5 STEP 1B
@app.get("/leaderboard")
def leaderboard(request: Request, type: str = "monthly", limit: int = 20):
    enforce_rate_limit(request, "leaderboard", 120, AI_RATE_LIMIT_WINDOW_SECONDS)
    leaderboard_type = "monthly" if type != "alltime" else "alltime"
    # PHASE 5 STEP 1C
    safe_limit = max(1, min(50, int(limit or 50)))
    supabase = get_supabase_client()
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    if leaderboard_type == "monthly":
        reset_result = (
            supabase.table("profiles")
            .update({
                "monthly_reputation_points": 0,
                "monthly_reset_at": datetime.now(timezone.utc).isoformat(),
            })
            .lt("monthly_reset_at", month_start)
            .execute()
        )
        print("[leaderboard] monthly reset rows:", len(reset_result.data or []), flush=True)
        order_column = "monthly_reputation_points"
    else:
        order_column = "reputation_points"

    result = (
        supabase.table("profiles")
        .select("id, username, trust_score, trust_tier, rank_title, highest_rank_achieved, reputation_points, monthly_reputation_points, badge_list")
        .order(order_column, desc=True)
        .order("trust_score", desc=True)
        .limit(safe_limit)
        .execute()
    )

    rows = result.data or []
    users = []
    for index, row in enumerate(rows):
        trust_score = row.get("trust_score") or 50
        current_rank = calculate_rank_title(trust_score)
        display_rank = resolve_display_rank(current_rank, row.get("highest_rank_achieved") or row.get("rank_title"))
        badges = row.get("badge_list") or []
        badge_count = len(badges) if isinstance(badges, list) else 0
        users.append({
            "rank_position": index + 1,
            "id": row.get("id"),
            "username": row.get("username"),
            "rank_title": display_rank,
            "current_rank_title": current_rank,
            "highest_rank_achieved": row.get("highest_rank_achieved") or display_rank,
            "reputation_points": row.get("reputation_points") or 0,
            "monthly_reputation_points": row.get("monthly_reputation_points") or 0,
            "badge_list": badges if isinstance(badges, list) else [],
            "badge_count": badge_count,
            "trust_score": trust_score,
        })

    next_reset = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_reset_month = 1 if next_reset.month == 12 else next_reset.month + 1
    next_reset_year = next_reset.year + 1 if next_reset.month == 12 else next_reset.year
    next_reset = next_reset.replace(year=next_reset_year, month=next_reset_month)

    return {
        "ok": True,
        "type": leaderboard_type,
        "limit": safe_limit,
        "next_monthly_reset_at": next_reset.isoformat(),
        "users": users,
    }


# PHASE 5 STEP 1D
@app.get("/profile/reputation-events")
def profile_reputation_events(request: Request, limit: int = 50):
    authenticated_user_id = get_authenticated_user_id(request)
    safe_limit = max(1, min(50, int(limit or 50)))
    supabase = get_supabase_client()

    result = (
        supabase.table("reputation_events")
        .select("event_type, points_delta, trust_delta, badge_unlocked, rank_before, rank_after, reason, created_at, claim_id")
        .eq("user_id", authenticated_user_id)
        .order("created_at", desc=True)
        .limit(safe_limit)
        .execute()
    )

    return {
        "ok": True,
        "limit": safe_limit,
        "events": result.data or [],
    }


# PHASE 5 STEP 2
@app.delete("/account")
def delete_account(request: Request):
    authenticated_user_id = get_authenticated_user_id(request)
    supabase = get_supabase_client()

    try:
        supabase.table("profiles").delete().eq("id", authenticated_user_id).execute()
        supabase.auth.admin.delete_user(authenticated_user_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not delete account right now.")

    return {"ok": True}


# PHASE 5 STEP 2
@app.get("/admin/reports")
def admin_list_reports(request: Request, status: str = "OPEN", limit: int = 50):
    require_admin_key(request)
    safe_limit = max(1, min(100, int(limit or 50)))
    report_status = status.strip().upper() if status else "OPEN"
    supabase = get_supabase_client()

    query = (
        supabase.table("reports")
        .select("id,target_type,claim_id,evidence_id,profile_id,user_id,reason,note,status,created_at,updated_at,resolved_at,admin_note")
        .order("created_at", desc=True)
        .limit(safe_limit)
    )

    if report_status != "ALL":
        query = query.eq("status", report_status)

    result = query.execute()
    reports = result.data or []
    supabase = get_supabase_client()

    for report in reports:
        target_type = report.get("target_type") or "CLAIM"
        target = None
        if target_type == "CLAIM" and report.get("claim_id"):
            target_result = supabase.table("claims").select("id,title,hidden,hidden_reason,created_at").eq("id", report["claim_id"]).execute()
            target = (target_result.data or [None])[0]
        elif target_type == "EVIDENCE" and report.get("evidence_id"):
            target_result = supabase.table("evidence").select("id,note,url,hidden,hidden_reason,created_at").eq("id", report["evidence_id"]).execute()
            target = (target_result.data or [None])[0]
        elif target_type == "PROFILE" and report.get("profile_id"):
            target_result = supabase.table("profiles").select("id,username,display_name,profile_visibility,created_at").eq("id", report["profile_id"]).execute()
            target = (target_result.data or [None])[0]

        report["target"] = target

    return {"ok": True, "reports": reports}


# PHASE 5 STEP 2
@app.post("/admin/reports/{report_id}/resolve")
def admin_resolve_report(report_id: str, payload: AdminReportActionRequest, request: Request):
    require_admin_key(request)
    admin_user_id = get_authenticated_user_id(request)
    supabase = get_supabase_client()
    next_status = payload.status.strip().upper() if payload.status else "RESOLVED"

    if next_status not in {"OPEN", "REVIEWING", "RESOLVED", "DISMISSED"}:
        raise HTTPException(status_code=400, detail="Unsupported report status.")

    report_result = supabase.table("reports").select("*").eq("id", report_id).execute()
    report_row = (report_result.data or [None])[0]

    if not report_row:
        raise HTTPException(status_code=404, detail="Report not found.")

    if payload.hide_target:
        target_type = report_row.get("target_type") or "CLAIM"
        if target_type == "CLAIM" and report_row.get("claim_id"):
            supabase.table("claims").update({
                "hidden": True,
                "hidden_reason": payload.admin_note.strip() or "Removed for violating community guidelines.",
                "hidden_at": datetime.now(timezone.utc).isoformat(),
                "hidden_by": admin_user_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", report_row["claim_id"]).execute()
        elif target_type == "EVIDENCE" and report_row.get("evidence_id"):
            supabase.table("evidence").update({
                "hidden": True,
                "hidden_reason": payload.admin_note.strip() or "Removed for violating community guidelines.",
                "hidden_at": datetime.now(timezone.utc).isoformat(),
                "hidden_by": admin_user_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", report_row["evidence_id"]).execute()
        elif target_type == "PROFILE" and report_row.get("profile_id"):
            supabase.table("profiles").update({
                "profile_visibility": "private",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", report_row["profile_id"]).execute()

    update_result = (
        supabase.table("reports")
        .update({
            "status": next_status,
            "resolved_at": datetime.now(timezone.utc).isoformat() if next_status in {"RESOLVED", "DISMISSED"} else None,
            "resolved_by": admin_user_id if next_status in {"RESOLVED", "DISMISSED"} else None,
            "admin_note": payload.admin_note.strip() or None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", report_id)
        .execute()
    )

    return {"ok": True, "report": (update_result.data or [None])[0]}


# PHASE 5 STEP 3
@app.post("/admin/content/hide")
def admin_hide_content(payload: AdminContentVisibilityRequest, request: Request):
    require_admin_key(request)
    admin_user_id = get_authenticated_user_id(request)
    target_type = payload.target_type.strip().upper()
    target_id = payload.target_id.strip()
    reason = payload.reason.strip() or "Removed for violating community guidelines."
    supabase = get_supabase_client()

    if target_type not in {"CLAIM", "EVIDENCE"} or not target_id:
        raise HTTPException(status_code=400, detail="Unsupported content target.")

    table_name = "claims" if target_type == "CLAIM" else "evidence"
    result = (
        supabase.table(table_name)
        .update({
            "hidden": True,
            "hidden_reason": reason,
            "hidden_at": datetime.now(timezone.utc).isoformat(),
            "hidden_by": admin_user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", target_id)
        .execute()
    )

    return {"ok": True, "target_type": target_type, "target_id": target_id, "updated": len(result.data or [])}


# PHASE 5 STEP 3
@app.post("/admin/content/restore")
def admin_restore_content(payload: AdminContentVisibilityRequest, request: Request):
    require_admin_key(request)
    get_authenticated_user_id(request)
    target_type = payload.target_type.strip().upper()
    target_id = payload.target_id.strip()
    supabase = get_supabase_client()

    if target_type not in {"CLAIM", "EVIDENCE"} or not target_id:
        raise HTTPException(status_code=400, detail="Unsupported content target.")

    table_name = "claims" if target_type == "CLAIM" else "evidence"
    result = (
        supabase.table(table_name)
        .update({
            "hidden": False,
            "hidden_reason": None,
            "hidden_at": None,
            "hidden_by": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", target_id)
        .execute()
    )

    return {"ok": True, "target_type": target_type, "target_id": target_id, "updated": len(result.data or [])}


# PHASE 5 STEP 1C
@app.post("/admin/reputation/reset-monthly")
def admin_reset_monthly_reputation(request: Request):
    require_admin_key(request)
    supabase = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    result = (
        supabase.table("profiles")
        .update({
            "monthly_reputation_points": 0,
            "monthly_reset_at": now_iso,
        })
        .execute()
    )

    print("[admin monthly reset] rows:", len(result.data or []), flush=True)

    return {
        "ok": True,
        "reset_at": now_iso,
        "rows": len(result.data or []),
    }


# PHASE 5 STEP 1B
@app.post("/admin/claims/override")
def admin_override_claim(payload: AdminOverrideRequest, request: Request):
    require_admin_key(request)
    claim_id = payload.claim_id.strip()
    new_status = payload.new_status.strip().upper()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    if new_status not in {"FINALIZED_TRUE", "FINALIZED_FAKE", "INSUFFICIENT_DATA", "NEEDS_MORE_EVIDENCE"}:
        raise HTTPException(status_code=400, detail="Unsupported override status.")

    supabase = get_supabase_client()
    print("[admin override] claim_id:", claim_id, flush=True)
    print("[admin override] new_status:", new_status, flush=True)

    reverse_result = supabase.rpc("reverse_claim_reputation", {"target_claim_id": claim_id}).execute()
    print("[admin override] reverse rows:", reverse_result.data, flush=True)

    update_result = (
        supabase.table("claims")
        .update({
            "status": new_status,
            "verdict_reason": payload.reason.strip() or "Admin override applied.",
            "verdict_calculated_at": datetime.now(timezone.utc).isoformat(),
            "published_at": datetime.now(timezone.utc).isoformat(),
            "phase4_locked": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", claim_id)
        .execute()
    )

    print("[admin override] updated rows:", len(update_result.data or []), flush=True)

    process_result = supabase.rpc("process_claim_reputation", {"target_claim_id": claim_id}).execute()
    print("[admin override] process result:", process_result.data, flush=True)

    return {
        "ok": True,
        "claim_id": claim_id,
        "status": new_status,
    }


# PHASE 4 STEP 8
@app.get("/ai/library")
def ai_library():
    library = load_factlens_ai_library()
    sections = [
        "factlens_rules",
        "claim_type_rules",
        "source_quality_rules",
        "red_flag_rules",
        "confidence_rules",
        "source_credibility",
    ]

    return {
        "ok": True,
        "rules_loaded": all(section in library for section in sections),
        "sections": sections,
    }


def analyze_claim(payload: AiPrecheckRequest) -> dict:
    # PHASE 4 STEP 9
    source_metadata = score_source_url(payload.source_url)
    # PHASE 4 STEP 21
    source_page = fetch_source_page(payload.source_url)
    return analyze_claim_with_openai(
        title=payload.title,
        description=payload.description,
        source_url=payload.source_url,
        category=payload.category,
        source_metadata=source_metadata,
        source_page=source_page,
    )


# PHASE 4 STEP 9
def log_source_score(endpoint_label: str, source_metadata: dict) -> None:
    print("[source] domain:", source_metadata.get("domain"), flush=True)
    print("[source] quality:", source_metadata.get("source_quality"), flush=True)
    print("[source] score:", source_metadata.get("source_score"), flush=True)


# PHASE 4 STEP 21
def log_source_page(endpoint_label: str, source_page: dict) -> None:
    print(f"[{endpoint_label}] source_read_status:", source_page.get("status"), flush=True)
    print(f"[{endpoint_label}] source_page_title:", source_page.get("title"), flush=True)
    if source_page.get("error"):
        print(f"[{endpoint_label}] source_page_error:", source_page.get("error"), flush=True)
    print(f"[{endpoint_label}] source_excerpt_chars:", len(str(source_page.get("excerpt") or "")), flush=True)


# PHASE 4 STEP 10
def fetch_evidence_rows(claim_id: str) -> list[dict]:
    print("[ai evidence] claim_id:", claim_id, flush=True)
    supabase = get_supabase_client()
    response = (
        supabase.table("evidence")
        .select("id, url, note, evidence_type, source_quality_label, source_quality_score, created_at")
        .eq("claim_id", claim_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    evidence_rows = response.data or []

    if isinstance(evidence_rows, dict):
        evidence_rows = [evidence_rows]

    print("[ai evidence] evidence_count:", len(evidence_rows), flush=True)
    return evidence_rows


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


# PHASE 4 STEP 27
def get_authenticated_user_id(request: Request) -> str:
    authorization = request.headers.get("authorization", "")

    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    access_token = authorization.split(" ", 1)[1].strip()

    if not access_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        auth_response = get_supabase_client().auth.get_user(access_token)
        auth_user = getattr(auth_response, "user", None)
        user_id = getattr(auth_user, "id", None)
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication required.")

    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")

    return str(user_id)


# PHASE 5 STEP 1B
def require_admin_key(request: Request) -> None:
    expected_key = os.environ.get("FACTLENS_ADMIN_API_KEY", "")

    if not expected_key:
        raise HTTPException(status_code=503, detail="Admin actions are not configured.")

    provided_key = request.headers.get("x-admin-key", "")

    if provided_key != expected_key:
        raise HTTPException(status_code=403, detail="Admin access required.")


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
# PHASE 4 STEP 16
# PHASE 4 STEP 17
# PHASE 4 STEP 20
# PHASE 4 STEP 20B
def build_claim_ai_update_payload(analysis: dict) -> dict:
    claim_type = str(analysis.get("claim_type") or "UNCLEAR").upper()
    if claim_type not in {"FACTUAL", "OPINION", "SATIRE", "QUESTION", "PROMOTION", "UNCLEAR"}:
        claim_type = "UNCLEAR"

    source_quality = normalize_source_quality(analysis.get("source_quality"))
    ai_status = analysis["ai_status"]
    ai_confidence = analysis["ai_confidence"]
    source_count = analysis["source_count"]

    if claim_type in {"OPINION", "QUESTION", "SATIRE", "PROMOTION"}:
        ai_status = "NOT_FACT_CHECKABLE"
        ai_confidence = 0.5
        source_quality = normalize_source_quality(source_quality)
        source_count = 0

    return {
        # PHASE 4 STEP 7
        "claim_type": claim_type,
        "ai_status": ai_status,
        "ai_confidence": ai_confidence,
        "source_quality": source_quality,
        # PHASE 4 STEP 9
        "source_domain": analysis.get("source_domain"),
        "source_score": analysis.get("source_score"),
        "source_reason": analysis.get("source_reason"),
        # PHASE 4 STEP 21
        "source_read_status": analysis.get("source_read_status") or "not_read",
        "source_page_title": analysis.get("source_page_title") or None,
        "source_excerpt": analysis.get("source_excerpt") or None,
        "source_supports_claim": analysis.get("source_supports_claim"),
        "source_support_summary": analysis.get("source_support_summary") or None,
        # PHASE 4 STEP 10
        "evidence_used_count": analysis.get("evidence_used_count", 0),
        "source_count": source_count,
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
# PHASE 4 STEP 16
# PHASE 4 STEP 20
# PHASE 4 STEP 20B
# PHASE 4 STEP 20C
def update_claim_ai_fields(claim_id: str, ai_result: dict, endpoint_label: str) -> dict:
    update_payload = build_claim_ai_update_payload(ai_result)
    # PHASE 4 STEP 17
    # PHASE 4 STEP 20
    # PHASE 4 STEP 20B
    # PHASE 4 STEP 20C
    update_payload["source_quality"] = normalize_source_quality(update_payload.get("source_quality"))
    if update_payload["source_quality"] not in ALLOWED_SOURCE_QUALITIES:
        print("[ai] invalid source_quality blocked:", update_payload["source_quality"], flush=True)
        update_payload["source_quality"] = "unknown"

    print(f"[{endpoint_label}] Supabase project_ref:", get_supabase_project_ref(), flush=True)
    print(f"[{endpoint_label}] claim_id:", claim_id, flush=True)
    print("[AI UPDATE FINAL SOURCE QUALITY]", update_payload["source_quality"], flush=True)
    print("[ai] normalized source_quality:", update_payload["source_quality"], flush=True)
    print("[ai] claim_type:", update_payload.get("claim_type"), flush=True)
    # PHASE 4 STEP 27
    print(
        f"[{endpoint_label}] AI result summary:",
        {
            "ai_status": ai_result.get("ai_status"),
            "ai_confidence": ai_result.get("ai_confidence"),
            "source_read_status": ai_result.get("source_read_status"),
            "source_supports_claim": ai_result.get("source_supports_claim"),
        },
        flush=True,
    )

    try:
        supabase = get_supabase_client()
        update_result = (
            supabase.table("claims")
            .update(update_payload)
            .eq("id", claim_id)
            .execute()
        )
        print(f"[{endpoint_label}] update_result rows:", len(update_result.data or []), flush=True)

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
            .select("id, claim_type, ai_status, ai_confidence, source_quality, source_domain, source_score, source_reason, source_read_status, source_page_title, source_supports_claim, source_support_summary, evidence_used_count, red_flags, ai_summary, source_count, updated_at")
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

    print(
        f"[{endpoint_label}] fetched updated claim summary:",
        {
            "id": updated_claim.get("id") if updated_claim else None,
            "ai_status": updated_claim.get("ai_status") if updated_claim else None,
            "source_read_status": updated_claim.get("source_read_status") if updated_claim else None,
        },
        flush=True,
    )

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
# PHASE 4 STEP 17
def build_ai_error_analysis() -> dict:
    return {
        # PHASE 4 STEP 7
        "claim_type": "UNCLEAR",
        "ai_confidence": 0.5,
        "source_count": 0,
        "source_quality": "unknown",
        # PHASE 4 STEP 21
        "source_read_status": "not_read",
        "source_page_title": None,
        "source_excerpt": None,
        "source_supports_claim": None,
        "source_support_summary": "Source page was not read because AI pre-check failed.",
        # PHASE 4 STEP 10
        "evidence_used_count": 0,
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
# PHASE 4 STEP 16
def build_ai_precheck_response(claim_id: str, update_result: dict) -> dict:
    updated_claim = update_result["updated_claim"]
    red_flags = normalize_red_flags(updated_claim.get("red_flags"))
    # PHASE 4 STEP 27
    safe_updated_claim = {
        "id": updated_claim.get("id"),
        "claim_type": updated_claim.get("claim_type"),
        "ai_status": updated_claim.get("ai_status"),
        "ai_confidence": updated_claim.get("ai_confidence"),
        "source_quality": updated_claim.get("source_quality"),
        "source_domain": updated_claim.get("source_domain"),
        "source_score": updated_claim.get("source_score"),
        "source_reason": updated_claim.get("source_reason"),
        "source_read_status": updated_claim.get("source_read_status"),
        "source_page_title": updated_claim.get("source_page_title"),
        "source_supports_claim": updated_claim.get("source_supports_claim"),
        "source_support_summary": updated_claim.get("source_support_summary"),
        "evidence_used_count": updated_claim.get("evidence_used_count"),
        "red_flags": red_flags,
        "ai_summary": updated_claim.get("ai_summary"),
        "source_count": updated_claim.get("source_count"),
        "updated_at": updated_claim.get("updated_at"),
    }

    return {
        "ok": True,
        "claim_id": claim_id,
        # PHASE 4 STEP 7
        "claim_type": updated_claim.get("claim_type"),
        "ai_confidence": updated_claim.get("ai_confidence"),
        "source_count": updated_claim.get("source_count"),
        "source_quality": updated_claim.get("source_quality"),
        # PHASE 4 STEP 9
        "source_domain": updated_claim.get("source_domain"),
        "source_score": updated_claim.get("source_score"),
        "source_reason": updated_claim.get("source_reason"),
        # PHASE 4 STEP 21
        "source_read_status": updated_claim.get("source_read_status"),
        "source_page_title": updated_claim.get("source_page_title"),
        "source_supports_claim": updated_claim.get("source_supports_claim"),
        "source_support_summary": updated_claim.get("source_support_summary"),
        # PHASE 4 STEP 10
        "evidence_used_count": updated_claim.get("evidence_used_count"),
        "red_flags": red_flags,
        "ai_summary": updated_claim.get("ai_summary"),
        "ai_status": updated_claim.get("ai_status"),
        "error": None,
        "details": None,
        "hint": None,
        "supabase_updated": True,
        "updated_claim": safe_updated_claim,
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


# PHASE 4 STEP 9
@app.get("/ai/source-score")
def ai_source_score(request: Request, url: str = ""):
    # PHASE 4 STEP 27
    enforce_rate_limit(request, "ai_source_score", SOURCE_SCORE_RATE_LIMIT_MAX_REQUESTS, AI_RATE_LIMIT_WINDOW_SECONDS)
    source_metadata = score_source_url(url)
    log_source_score("ai/source-score", source_metadata)
    return source_metadata


@app.post("/ai/precheck", response_model=AiPrecheckResponse, response_model_exclude_none=True)
def ai_precheck(payload: AiPrecheckRequest, request: Request):
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    # PHASE 4 STEP 27
    enforce_rate_limit(request, "ai_precheck", AI_RATE_LIMIT_MAX_REQUESTS, AI_RATE_LIMIT_WINDOW_SECONDS)
    authenticated_user_id = get_authenticated_user_id(request)
    enforce_claim_ai_cooldown(claim_id)
    claim = fetch_claim_row(claim_id)

    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    payload = build_precheck_payload_from_claim(claim)
    print("[ai/precheck] authenticated user:", authenticated_user_id, flush=True)
    # PHASE 4 STEP 9
    source_metadata = score_source_url(payload.source_url)
    log_source_score("ai/precheck", source_metadata)
    # PHASE 4 STEP 21
    source_page = fetch_source_page(payload.source_url)
    log_source_page("ai/precheck", source_page)
    ai_result = analyze_claim_with_openai(
        title=payload.title,
        description=payload.description,
        source_url=payload.source_url,
        category=payload.category,
        source_metadata=source_metadata,
        source_page=source_page,
    )
    print("[ai/precheck] called", flush=True)
    print(f"[ai/precheck] OPENAI_MODEL={get_openai_model()}", flush=True)
    print(f"[ai/precheck] claim_id={payload.claim_id}", flush=True)
    print(f"[ai/precheck] source_url={payload.source_url}", flush=True)
    # PHASE 4 STEP 7
    print("[ai] claim_type:", ai_result.get("claim_type"), flush=True)
    print(f"[ai/precheck] ai_status={ai_result['ai_status']}", flush=True)
    print(f"[ai/precheck] ai_confidence={ai_result['ai_confidence']}", flush=True)
    print(f"[ai/precheck] source_quality={ai_result['source_quality']}", flush=True)
    print("[ai/precheck] OpenAI analysis completed", flush=True)
    update_result = update_claim_ai_fields(payload.claim_id, ai_result, "ai/precheck")

    if not update_result.get("ok"):
        print(f"[ai/precheck] Supabase update failure: {update_result.get('error')}", flush=True)
        return {
            "ok": False,
            "claim_id": payload.claim_id,
            "error": update_result.get("error"),
            "details": update_result.get("details"),
            "hint": update_result.get("hint"),
        }

    print("[ai/precheck] Supabase update success", flush=True)
    return build_ai_precheck_response(payload.claim_id, update_result)


# PHASE 4 STEP 3
@app.post("/ai/precheck/retry", response_model=AiPrecheckResponse, response_model_exclude_none=True)
def retry_ai_precheck(payload: AiPrecheckRetryRequest, request: Request):
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    # PHASE 4 STEP 27
    enforce_rate_limit(request, "ai_precheck_retry", AI_RATE_LIMIT_MAX_REQUESTS, AI_RATE_LIMIT_WINDOW_SECONDS)
    authenticated_user_id = get_authenticated_user_id(request)
    enforce_claim_ai_cooldown(claim_id)
    print("[ai/precheck/retry] called", flush=True)
    print(f"[ai/precheck/retry] OPENAI_MODEL={get_openai_model()}", flush=True)
    print(f"[ai/precheck/retry] claim_id={claim_id}", flush=True)
    print("[ai/precheck/retry] authenticated user:", authenticated_user_id, flush=True)

    try:
        claim = fetch_claim_row(claim_id)

        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        previous_status = claim.get("ai_status") or "PENDING"
        print(f"[ai/precheck/retry] previous_ai_status={previous_status}", flush=True)

        retry_payload = build_precheck_payload_from_claim(claim)
        # PHASE 4 STEP 9
        source_metadata = score_source_url(retry_payload.source_url)
        log_source_score("ai/precheck/retry", source_metadata)
        # PHASE 4 STEP 21
        source_page = fetch_source_page(retry_payload.source_url)
        log_source_page("ai/precheck/retry", source_page)
        # PHASE 4 STEP 10
        evidence_rows = fetch_evidence_rows(claim_id)
        ai_result = analyze_claim_with_openai(
            title=retry_payload.title,
            description=retry_payload.description,
            source_url=retry_payload.source_url,
            category=retry_payload.category,
            source_metadata=source_metadata,
            source_page=source_page,
            evidence_rows=evidence_rows,
        )
        # PHASE 4 STEP 7
        print("[ai] claim_type:", ai_result.get("claim_type"), flush=True)
        print(f"[ai/precheck/retry] new_ai_status={ai_result['ai_status']}", flush=True)
        print(f"[ai/precheck/retry] ai_confidence={ai_result['ai_confidence']}", flush=True)
        print(f"[ai/precheck/retry] source_quality={ai_result['source_quality']}", flush=True)
        print("[ai/precheck/retry] OpenAI analysis completed", flush=True)
        update_result = update_claim_ai_fields(claim_id, ai_result, "ai/precheck/retry")

        if not update_result.get("ok"):
            print(f"[ai/precheck/retry] Supabase update failure: {update_result.get('error')}", flush=True)
            return {
                "ok": False,
                "claim_id": claim_id,
                "error": update_result.get("error"),
                "details": update_result.get("details"),
                "hint": update_result.get("hint"),
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
