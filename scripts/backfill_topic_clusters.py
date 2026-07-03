# PHASE 6 STEP 4 — Backfill topic clusters for existing claims.
#
# Standalone, idempotent (safe to re-run): it only ever touches claims WHERE
# topic_cluster_id IS NULL, so already-clustered claims are never reprocessed.
# Claims whose embedding generation fails are logged and skipped; the next run
# picks them up again.
#
# Usage (from the repo root, same env vars as the backend):
#   python scripts/backfill_topic_clusters.py
#
# Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
import os
import sys
import time

# Make backend imports work when run from the repo root (same pattern as
# scripts/backfill_embeddings.py needs: the service lives under backend/).
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")

for path in (REPO_ROOT, BACKEND_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(BACKEND_DIR, ".env"))
    load_dotenv()
except ImportError:
    pass

from services.topic_cluster_service import _get_supabase_client, find_or_create_topic_cluster  # noqa: E402

BATCH_SIZE = 20
SLEEP_BETWEEN_BATCHES_SECONDS = 2


def fetch_unclustered_batch(supabase, batch_size: int) -> list:
    response = (
        supabase.table("claims")
        .select("id,title,description,category")
        .is_("topic_cluster_id", "null")
        .order("created_at", desc=False)
        .limit(batch_size)
        .execute()
    )
    return response.data or []


def count_unclustered(supabase) -> int:
    response = (
        supabase.table("claims")
        .select("id", count="exact")
        .is_("topic_cluster_id", "null")
        .limit(1)
        .execute()
    )
    return int(response.count or 0)


def main() -> None:
    supabase = _get_supabase_client()
    total = count_unclustered(supabase)
    print(f"[backfill] {total} claims without a topic cluster", flush=True)

    processed = 0
    failed_claim_ids: set = set()

    while True:
        batch = fetch_unclustered_batch(supabase, BATCH_SIZE)
        # Claims that keep failing stay topic_cluster_id IS NULL and would be
        # re-fetched forever; skip anything we already failed on this run.
        batch = [claim for claim in batch if claim.get("id") not in failed_claim_ids]

        if not batch:
            break

        for claim in batch:
            claim_id = str(claim.get("id") or "")
            processed += 1

            try:
                cluster_id = find_or_create_topic_cluster(
                    claim_id=claim_id,
                    title=str(claim.get("title") or ""),
                    description=str(claim.get("description") or ""),
                    category=str(claim.get("category") or ""),
                )

                if cluster_id is None:
                    failed_claim_ids.add(claim_id)
                    print(f"[backfill] no cluster for claim {claim_id} (soft failure); continuing", flush=True)
            except Exception as error:
                # find_or_create is fail-soft already; this is belt-and-suspenders.
                failed_claim_ids.add(claim_id)
                print(f"[backfill] error on claim {claim_id}: {error}; continuing", flush=True)

            print(f"Processed {processed}/{total} claims", flush=True)

        # Rate-limit courtesy for OpenAI embeddings.
        time.sleep(SLEEP_BETWEEN_BATCHES_SECONDS)

    print(
        f"[backfill] done. processed={processed}, failures={len(failed_claim_ids)}"
        + (f" (ids: {sorted(failed_claim_ids)[:10]}...)" if failed_claim_ids else ""),
        flush=True,
    )


if __name__ == "__main__":
    main()
