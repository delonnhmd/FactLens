# PHASE 6 STEP 3 — AI SEO tagging per claim (NEW file, additive feature).
#
# Generates SEO metadata (slug, meta title/description, keywords, Open Graph
# fields) for a claim with gpt-4.1-mini and stores it in the claim_seo table
# (upsert on claim_id + version). Two versions per claim:
#   'creation'      — generated right after the claim is created
#   'finalization'  — regenerated with the verdict once the claim finalizes
#
# HARD RULE: this module must NEVER block claim creation or finalization.
# Every public function catches all exceptions, logs, and returns None.
import json
import os
import re

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - Render installs this from requirements.txt.
    OpenAI = None


SEO_VERSIONS = {"creation", "finalization"}

_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def get_seo_model() -> str:
    # Same env-driven model selection as services/openai_factcheck.py.
    return os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")


def _get_supabase_client():
    # Mirrors get_supabase_client() in backend/main.py (not imported from
    # there to avoid a circular import: main.py imports this module).
    from supabase import create_client

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on backend.")

    return create_client(supabase_url, service_role_key)


def _slugify(value: str, max_length: int = 80) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower())
    return slug.strip("-")[:max_length].strip("-")


def _truncate(value: str, max_length: int) -> str:
    text = str(value or "").strip()

    if len(text) <= max_length:
        return text

    return text[:max_length].rstrip()


def _strip_code_fences(raw: str) -> str:
    text = str(raw or "").strip()
    # Models sometimes wrap JSON in ``` fences despite instructions.
    text = _FENCE_PATTERN.sub("", text).strip()
    return text


def _build_seo_prompt(title: str, description: str, category: str, verdict: str | None) -> list[dict]:
    system_prompt = (
        "Generate SEO metadata for a political fact-check claim.\n"
        "Return ONLY valid JSON, no markdown, no preamble:\n"
        "{\n"
        '  "slug": "url-friendly-slug-max-80-chars",\n'
        '  "meta_title": "max 60 chars, includes claim topic",\n'
        '  "meta_description": "max 160 chars, factual summary",\n'
        '  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],\n'
        '  "og_title": "social share title",\n'
        '  "og_description": "social share description"\n'
        "}\n"
        "Rules:\n"
        "- slug: lowercase, hyphens only, no special chars, includes year if a date is in the claim\n"
        "- keywords: 5-10 items; include politician names, topic, location, year, verdict if known\n"
        "- meta_description: neutral, factual, never clickbait\n"
        "- Never include partisan language in any field"
    )
    user_prompt = (
        f"Title: {title or ''}\n"
        f"Description: {description or ''}\n"
        f"Category: {category or 'Other'}\n"
        f"Verdict: {verdict or 'pending'}"
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _normalize_seo_payload(raw_result: dict, title: str, description: str, claim_id: str) -> dict:
    slug = _slugify(raw_result.get("slug") or title)
    if not slug:
        slug = f"claim-{str(claim_id)[:8]}"

    meta_title = _truncate(raw_result.get("meta_title") or title, 60)
    meta_description = _truncate(raw_result.get("meta_description") or description, 160)

    keywords_raw = raw_result.get("keywords")
    if not isinstance(keywords_raw, list):
        keywords_raw = []
    keywords = [str(keyword).strip() for keyword in keywords_raw if str(keyword).strip()][:10]

    og_title = _truncate(raw_result.get("og_title") or meta_title, 120)
    og_description = _truncate(raw_result.get("og_description") or meta_description, 300)

    return {
        "slug": slug,
        "meta_title": meta_title or "Verifact claim",
        "meta_description": meta_description or "Community fact-check on Verifact.",
        "keywords": keywords,
        "og_title": og_title or meta_title or "Verifact claim",
        "og_description": og_description or meta_description or "Community fact-check on Verifact.",
    }


def _ensure_unique_slug(supabase, slug: str, claim_id: str) -> str:
    """If the slug is already used by a DIFFERENT claim, suffix -{claim_id[:8]}."""
    try:
        existing = (
            supabase.table("claim_seo")
            .select("claim_id")
            .eq("slug", slug)
            .neq("claim_id", claim_id)
            .limit(1)
            .execute()
        )
    except Exception as error:
        print("[seo] slug uniqueness check failed:", str(error), flush=True)
        return slug

    if existing.data:
        return f"{slug[:71].rstrip('-')}-{str(claim_id)[:8]}"

    return slug


def _call_openai_for_seo(title: str, description: str, category: str, verdict: str | None) -> dict | None:
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key or OpenAI is None:
        print("[seo] OpenAI client unavailable or API key missing; skipping SEO generation", flush=True)
        return None

    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=get_seo_model(),
        input=_build_seo_prompt(title, description, category, verdict),
        temperature=0,
    )
    raw = _strip_code_fences(getattr(response, "output_text", "") or "")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        print("[seo] invalid AI JSON response:", raw[:200], flush=True)
        return None

    if not isinstance(parsed, dict):
        print("[seo] AI response was not a JSON object", flush=True)
        return None

    return parsed


def generate_claim_seo(
    claim_id: str,
    title: str,
    description: str,
    category: str,
    verdict: str | None = None,
    version: str = "creation",
) -> dict | None:
    """Generate + store SEO metadata for a claim. Returns the stored row's
    payload, or None on any failure. NEVER raises — SEO is best-effort and
    must not block claim creation or finalization."""
    try:
        claim_id = str(claim_id or "").strip()

        if not claim_id:
            print("[seo] missing claim_id; skipping", flush=True)
            return None

        if version not in SEO_VERSIONS:
            version = "creation"

        raw_result = _call_openai_for_seo(title, description, category, verdict)

        if raw_result is None:
            return None

        seo_payload = _normalize_seo_payload(raw_result, title, description, claim_id)

        supabase = _get_supabase_client()
        seo_payload["slug"] = _ensure_unique_slug(supabase, seo_payload["slug"], claim_id)

        upsert_row = {
            "claim_id": claim_id,
            "version": version,
            **seo_payload,
        }
        supabase.table("claim_seo").upsert(upsert_row, on_conflict="claim_id,version").execute()
        print(f"[seo] stored SEO metadata claim={claim_id} version={version} slug={seo_payload['slug']}", flush=True)
        return upsert_row
    except Exception as error:
        print("[seo] generation failed (non-fatal):", str(error), flush=True)
        return None


def fetch_latest_claim_seo(claim_id: str) -> dict | None:
    """Return the richest stored SEO row for a claim: 'finalization' if it
    exists, otherwise 'creation'. Returns None when nothing is stored or on
    any error."""
    try:
        supabase = _get_supabase_client()
        result = (
            supabase.table("claim_seo")
            .select("id,claim_id,version,slug,meta_title,meta_description,keywords,og_title,og_description,generated_at")
            .eq("claim_id", str(claim_id or "").strip())
            .execute()
        )
        rows = result.data or []
    except Exception as error:
        print("[seo] fetch failed:", str(error), flush=True)
        return None

    if not rows:
        return None

    for row in rows:
        if row.get("version") == "finalization":
            return row

    return rows[0]
