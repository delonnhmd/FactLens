# PHASE 6 STEP 4 — Topic Clustering (NEW file, additive feature).
#
# Groups claims about the same topic into claim_topics rows. Users still post
# freely — no forced merging; each claim keeps its own votes, author, evidence,
# and accuracy-score impact. The cluster only aggregates.
#
# Design rule (same as embedding_service / seo_service): clustering is an
# enhancement, never a gate. Every public function fails soft — try/except,
# log, return None — so claim creation and voting are never blocked.
import json
import os
import re
from datetime import datetime, timezone

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - Render installs this from requirements.txt.
    OpenAI = None

# Reuse the existing embedding helper — NOT duplicated here. Using the same
# function for claims and cluster matching is load-bearing: a cluster's stored
# embedding is only comparable to a new claim's embedding if both were built
# from the same model AND the same text recipe (title + first 500 chars of
# description — the shared helper's cap wins over the spec's 300 so cluster
# vectors stay comparable with the claim embeddings already in the DB).
try:
    from services.embedding_service import generate_claim_embedding
except ModuleNotFoundError:  # Allows repo-root command: uvicorn backend.main:app
    from backend.services.embedding_service import generate_claim_embedding


# A claim joins an existing cluster above this cosine similarity.
CLUSTER_MATCH_THRESHOLD = 0.82

# Below this many combined votes, a cluster verdict is not meaningful.
CLUSTER_MIN_VOTES_FOR_VERDICT = 10

SEO_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
OPENAI_TIMEOUT_SECONDS = 5.0


def _get_supabase_client():
    # Mirrors get_supabase_client() in backend/main.py (kept local so this
    # module stays standalone and importable by the backfill script without
    # importing main).
    from supabase import create_client

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on backend.")

    return create_client(supabase_url, service_role_key)


def _get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key or OpenAI is None:
        print("[topic_cluster] OpenAI client unavailable or API key missing", flush=True)
        return None

    return OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)


def _slugify(value: str, max_length: int = 80) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower())
    return slug.strip("-")[:max_length].strip("-")


def _strip_json_fences(raw: str) -> str:
    # Same defensive parse as embedding_service._strip_json_fences: small
    # models occasionally fence JSON despite instructions.
    text = (raw or "").strip()

    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else ""
        if text.endswith("```"):
            text = text[: -len("```")]

    return text.strip()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_claim_embedding(supabase, claim_id: str, title: str, description: str) -> "list | None":
    """Reuse the embedding already stored on the claim row when it exists.

    /api/claims/embed stores the claim's embedding moments before clustering
    runs, so in the normal flow this avoids paying for a second OpenAI call.
    Falls back to generating one (backfill script, embed failures)."""
    try:
        response = (
            supabase.table("claims")
            .select("embedding")
            .eq("id", claim_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        stored = rows[0].get("embedding") if rows else None

        if stored:
            # supabase returns vector columns as a JSON string; normalize.
            if isinstance(stored, str):
                stored = json.loads(stored)
            if isinstance(stored, list) and stored:
                return stored
    except Exception as error:
        print(f"[topic_cluster] stored-embedding read failed: {error}", flush=True)

    return generate_claim_embedding(title=title, description=description)


def _generate_topic_label(title: str, description: str, category: str) -> str:
    """Short neutral topic label via gpt-4.1-mini; falls back to the title."""
    fallback = (title or "Untitled topic").strip()[:80]
    client = _get_openai_client()

    if client is None:
        return fallback

    prompt = (
        "Generate a short, neutral topic label (3 to 8 words, no quotes, no "
        "trailing punctuation) for a political fact-check topic grouping.\n"
        f"Claim title: {title}\n"
        f"Claim description: {(description or '')[:300]}\n"
        f"Category: {category or 'Other'}\n"
        "Never include partisan language. Return ONLY the label text."
    )

    try:
        response = client.chat.completions.create(
            model=SEO_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=30,
        )
        label = (response.choices[0].message.content or "").strip().strip('"').strip()
        return label[:120] if label else fallback
    except Exception as error:
        print(f"[topic_cluster] label generation failed: {error}", flush=True)
        return fallback


def generate_cluster_seo(topic_label: str, sample_titles: "list[str]") -> dict:
    """Generate slug/meta/keywords for a new topic cluster.

    Called once at cluster creation. Returns safe defaults on any failure —
    never raises."""
    safe_defaults = {
        "slug": _slugify(topic_label)[:80] or "topic",
        "meta_title": (topic_label or "")[:60],
        "meta_description": f"Community claims about {topic_label}"[:160],
        "keywords": [],
        "og_title": (topic_label or "")[:60],
    }
    client = _get_openai_client()

    if client is None:
        return safe_defaults

    joined_titles = " | ".join([str(sample) for sample in (sample_titles or [])[:5]])
    prompt = (
        "Generate SEO metadata for a topic cluster on a political fact-check "
        "platform.\n"
        f"Topic: {topic_label}\n"
        f"Sample claims: {joined_titles}\n\n"
        "Return ONLY valid JSON, no markdown:\n"
        "{\n"
        '  "slug": "url-friendly-max-80-chars",\n'
        '  "meta_title": "max 60 chars",\n'
        '  "meta_description": "max 160 chars, neutral factual",\n'
        '  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],\n'
        '  "og_title": "social share title"\n'
        "}\n"
        "Never include partisan language."
    )

    try:
        response = client.chat.completions.create(
            model=SEO_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            # The spec asked for max_tokens=120, but the requested JSON (160-char
            # description + 8 keywords) does not reliably fit in 120 tokens, which
            # would truncate the JSON and make the fallback the NORM. 300 keeps the
            # call cheap while letting the full object through.
            max_tokens=300,
        )
        raw = _strip_json_fences(response.choices[0].message.content or "")
        parsed = json.loads(raw)

        if not isinstance(parsed, dict):
            return safe_defaults

        keywords = parsed.get("keywords")
        if not isinstance(keywords, list):
            keywords = []

        return {
            "slug": _slugify(parsed.get("slug") or topic_label)[:80] or safe_defaults["slug"],
            "meta_title": str(parsed.get("meta_title") or topic_label).strip()[:60],
            "meta_description": str(parsed.get("meta_description") or safe_defaults["meta_description"]).strip()[:160],
            "keywords": [str(keyword).strip() for keyword in keywords if str(keyword).strip()][:10],
            "og_title": str(parsed.get("og_title") or topic_label).strip()[:80],
        }
    except Exception as error:
        print(f"[topic_cluster] SEO generation failed: {error}", flush=True)
        return safe_defaults


def _ensure_unique_slug(supabase, slug: str, claim_id: str) -> str:
    """Append -{claim_id[:6]} if the slug is already taken."""
    try:
        existing = (
            supabase.table("claim_topics")
            .select("id")
            .eq("slug", slug)
            .limit(1)
            .execute()
        )
        if existing.data:
            return f"{slug[:73].rstrip('-')}-{str(claim_id)[:6]}"
    except Exception as error:
        print(f"[topic_cluster] slug uniqueness check failed: {error}", flush=True)

    return slug


def update_cluster_stats(cluster_id: str) -> None:
    """Recompute and save aggregate vote totals + cluster_verdict.

    Called after cluster membership changes, and lazily from the read
    endpoints (see main.py: there is no backend vote-recording endpoint to
    hook — votes are inserted client-side straight into Supabase — so stats
    are refreshed on read instead; eventually consistent by design).
    Fails silently."""
    try:
        supabase = _get_supabase_client()
        # Vote column mapping (INSPECTED): claims has votes_true, votes_fake,
        # votes_unsure. The spec's "disputed_votes" maps to votes_unsure —
        # the closest existing signal; there is no disputed column on claims.
        rows_response = (
            supabase.table("claims")
            .select("votes_true,votes_fake,votes_unsure")
            .eq("topic_cluster_id", cluster_id)
            .execute()
        )
        rows = rows_response.data or []

        total_true = sum(int(row.get("votes_true") or 0) for row in rows)
        total_fake = sum(int(row.get("votes_fake") or 0) for row in rows)
        total_disputed = sum(int(row.get("votes_unsure") or 0) for row in rows)
        total = total_true + total_fake + total_disputed

        if total < CLUSTER_MIN_VOTES_FOR_VERDICT:
            cluster_verdict = "INSUFFICIENT_DATA"
        elif total_true >= total_fake * 1.2 and total_true > total_disputed:
            cluster_verdict = "TRUE"
        elif total_fake >= total_true * 1.2 and total_fake > total_disputed:
            cluster_verdict = "FAKE"
        else:
            cluster_verdict = "DISPUTED"

        supabase.table("claim_topics").update(
            {
                "total_true_votes": total_true,
                "total_fake_votes": total_fake,
                "total_disputed_votes": total_disputed,
                "total_vote_count": total,
                "cluster_verdict": cluster_verdict,
                "claim_count": len(rows),
                "last_claim_at": _now_iso(),
                "updated_at": _now_iso(),
            }
        ).eq("id", cluster_id).execute()
    except Exception as error:
        # Silent by contract — stats are eventually consistent.
        print(f"[topic_cluster] stats update failed for {cluster_id}: {error}", flush=True)


def find_or_create_topic_cluster(claim_id: str, title: str, description: str, category: str) -> "str | None":
    """Attach a claim to the nearest topic cluster, creating one if needed.

    Returns topic_cluster_id, or None on any failure. NEVER raises — failure
    must never block claim creation."""
    try:
        claim_id = str(claim_id or "").strip()

        if not claim_id:
            return None

        supabase = _get_supabase_client()
        embedding = _get_claim_embedding(supabase, claim_id, title, description)

        if embedding is None:
            # No embedding, no clustering — the backfill script retries later.
            print(f"[topic_cluster] no embedding for claim {claim_id}; skipping", flush=True)
            return None

        # Nearest existing cluster above the similarity floor.
        match_response = supabase.rpc(
            "match_claim_topics",
            {
                "query_embedding": embedding,
                "match_threshold": CLUSTER_MATCH_THRESHOLD,
                "match_count": 1,
            },
        ).execute()
        matches = match_response.data or []

        if matches:
            cluster_id = str(matches[0].get("id") or "")
            supabase.table("claims").update({"topic_cluster_id": cluster_id}).eq("id", claim_id).execute()
            update_cluster_stats(cluster_id)
            print(
                f"[topic_cluster] claim {claim_id} joined cluster {cluster_id} "
                f"(sim={float(matches[0].get('similarity') or 0):.3f})",
                flush=True,
            )
            return cluster_id

        # No match — create a new cluster seeded with this claim's embedding.
        topic_label = _generate_topic_label(title, description, category)
        seo = generate_cluster_seo(topic_label, [title])
        slug = _ensure_unique_slug(supabase, seo["slug"], claim_id)

        insert_response = (
            supabase.table("claim_topics")
            .insert(
                {
                    "topic_label": topic_label,
                    "slug": slug,
                    "meta_title": seo["meta_title"],
                    "meta_description": seo["meta_description"],
                    "keywords": seo["keywords"],
                    "embedding": embedding,
                    "first_claim_at": _now_iso(),
                }
            )
            .execute()
        )
        inserted = insert_response.data or []

        if not inserted:
            print(f"[topic_cluster] cluster insert returned no row for claim {claim_id}", flush=True)
            return None

        cluster_id = str(inserted[0].get("id") or "")
        supabase.table("claims").update({"topic_cluster_id": cluster_id}).eq("id", claim_id).execute()
        update_cluster_stats(cluster_id)
        print(f"[topic_cluster] created cluster {cluster_id} ('{topic_label}') for claim {claim_id}", flush=True)
        return cluster_id
    except Exception as error:
        print(f"[topic_cluster] find_or_create failed for {claim_id}: {error}", flush=True)
        return None


def fetch_topic_row(cluster_id: str) -> "dict | None":
    """Full claim_topics row by id, or None (soft failure)."""
    try:
        supabase = _get_supabase_client()
        response = (
            supabase.table("claim_topics")
            .select("*")
            .eq("id", str(cluster_id or "").strip())
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            return None
        row = dict(rows[0])
        # The raw embedding is large and useless to clients; drop it from API output.
        row.pop("embedding", None)
        return row
    except Exception as error:
        print(f"[topic_cluster] topic fetch failed: {error}", flush=True)
        return None
