#!/usr/bin/env python3
# PHASE 6 STEP 1 — Backfill embeddings for claims that don't have one yet.
#
# Standalone script. Run from the repo root:
#     python scripts/backfill_embeddings.py
#
# It generates the vector(1536) embedding for every claim where embedding IS NULL
# and writes it back. Claims whose embedding fails to generate are simply skipped
# and remain NULL, so a later run will retry them.
#
# Idempotent: it only ever touches rows with a NULL embedding, so re-running after
# a partial/failed run (or after new claims arrive) resumes cleanly and never
# re-embeds or overwrites a claim that already has one.

import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# Make the backend package importable so we reuse the exact same embedding logic
# the live API uses (single source of truth for the model + input construction).
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.services.embedding_service import generate_claim_embedding  # noqa: E402

# Load .env for local runs; on Render/CI the vars are already in the environment.
load_dotenv(REPO_ROOT / ".env")

BATCH_SIZE = 50
SLEEP_BETWEEN_BATCHES_SECONDS = 1


def get_client():
    """Build a service-role Supabase client from the environment.

    WHY service role: the backfill writes the embedding column across all claims
    regardless of author, which only the service role is permitted to do.
    """
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")

    return create_client(supabase_url, service_role_key)


def fetch_batch(supabase, limit: int) -> list[dict]:
    """Fetch the next batch of claims that still need an embedding.

    We always re-query for `embedding is null` rather than paginating by offset:
    rows we successfully embed drop out of the result set, so the "next" batch is
    simply the next `limit` still-null rows. That's what makes re-runs safe.
    """
    response = (
        supabase.table("claims")
        .select("id, title, description")
        .is_("embedding", "null")
        .limit(limit)
        .execute()
    )
    return response.data or []


def main() -> None:
    supabase = get_client()
    total_processed = 0
    total_stored = 0
    total_skipped = 0
    batch_number = 0

    print("[backfill] starting embedding backfill for claims with NULL embedding")

    while True:
        batch = fetch_batch(supabase, BATCH_SIZE)

        if not batch:
            break

        batch_number += 1
        print(f"[backfill] batch {batch_number}: {len(batch)} claim(s)")

        for claim in batch:
            claim_id = str(claim.get("id") or "")
            embedding = generate_claim_embedding(
                title=str(claim.get("title") or ""),
                description=str(claim.get("description") or ""),
            )
            total_processed += 1

            if embedding is None:
                # Leave it NULL so a future run retries it.
                total_skipped += 1
                print(f"[backfill]   skipped (no embedding): {claim_id}")
                continue

            supabase.table("claims").update({"embedding": embedding}).eq("id", claim_id).execute()
            total_stored += 1
            print(f"[backfill]   stored: {claim_id}")

        # If we got a short batch there are no more rows to process.
        if len(batch) < BATCH_SIZE:
            break

        print(f"[backfill] sleeping {SLEEP_BETWEEN_BATCHES_SECONDS}s before next batch...")
        time.sleep(SLEEP_BETWEEN_BATCHES_SECONDS)

    print(
        f"[backfill] done. processed={total_processed} stored={total_stored} "
        f"skipped={total_skipped}"
    )


if __name__ == "__main__":
    main()
