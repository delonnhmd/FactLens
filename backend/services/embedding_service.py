# PHASE 6 STEP 1 — Semantic duplicate detection helpers.
#
# This module owns the two OpenAI calls used by duplicate detection:
#   1. generate_claim_embedding — turn a claim into a 1536-dim vector.
#   2. classify_claim_stance     — settle "are these the same assertion?" for
#      the ambiguous similarity band, so we don't tell a user their claim is a
#      duplicate of one that actually says the OPPOSITE thing.
#
# Design rule that drives everything here: an embedding/AI failure must NEVER
# block claim creation or claim posting. Every function fails soft (returns
# None / a safe default) and logs, rather than raising.

import json
import os

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - Render installs this from requirements.txt.
    OpenAI = None


# text-embedding-3-small is 1536 dimensions, which is why the DB column is
# vector(1536). Keep this in sync with the migration if the model ever changes.
EMBEDDING_MODEL = "text-embedding-3-small"

# The stance check is a cheap tie-breaker, so it uses the same small chat model
# the rest of the backend defaults to. Kept local (not imported from main) so
# this module stays standalone and importable by the backfill script.
STANCE_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")

# 5s hard ceiling per the spec — duplicate detection fires on every submission,
# so a slow OpenAI call can't be allowed to hold the request open.
OPENAI_TIMEOUT_SECONDS = 5.0

# Only the first 500 chars of the description feed the embedding. WHY: the title
# carries most of the semantic signal, long descriptions add noise/cost, and a
# fixed cap keeps embedding latency predictable across claims of any length.
DESCRIPTION_EMBED_CHARS = 500


def _get_openai_client() -> "OpenAI | None":
    """Build an OpenAI client with the 5s timeout baked in, or None if unusable.

    WHY return None instead of raising: callers treat "no client" identically to
    "the API errored" — both must fail soft so claim creation is never blocked by
    a missing key or an uninstalled SDK.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key or OpenAI is None:
        print("[embedding] OpenAI client unavailable or API key missing", flush=True)
        return None

    return OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)


def generate_claim_embedding(title: str, description: str) -> "list[float] | None":
    """Return the 1536-dim embedding for a claim, or None if generation fails.

    WHY None-on-failure: embeddings are an enhancement, not a gate. A claim with a
    NULL embedding is still a perfectly valid claim; it simply won't participate in
    duplicate matching until the backfill script fills it in later. Never let an
    OpenAI outage stop a user from posting.

    Input text is `title + " " + first 500 chars of description`, matching how we
    want claims compared: title-led with a bounded slice of supporting context.
    """
    client = _get_openai_client()

    if client is None:
        return None

    safe_title = (title or "").strip()
    safe_description = (description or "").strip()[:DESCRIPTION_EMBED_CHARS]
    input_text = f"{safe_title} {safe_description}".strip()

    if not input_text:
        # Nothing to embed — treat as a soft failure so callers skip storage.
        print("[embedding] empty input text; skipping", flush=True)
        return None

    try:
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=input_text)
        return response.data[0].embedding
    except Exception as error:
        print(f"[embedding] generation failed: {error}", flush=True)
        return None


def _strip_json_fences(raw: str) -> str:
    """Strip ```json ... ``` fences an LLM may wrap around its JSON.

    WHY: even at temperature 0 and with an explicit instruction, small models
    occasionally return fenced output. Parsing defensively here keeps the stance
    check from throwing on formatting noise.
    """
    text = (raw or "").strip()

    if text.startswith("```"):
        # Drop the opening fence line (``` or ```json) and any closing fence.
        text = text.split("\n", 1)[-1] if "\n" in text else ""
        if text.endswith("```"):
            text = text[: -len("```")]

    return text.strip()


def classify_claim_stance(new_title: str, existing_title: str) -> str:
    """Decide whether two claim titles make the SAME assertion.

    Returns one of "YES", "NO", "OPPOSITE". This disambiguates the fuzzy 0.85–0.95
    similarity band where two claims are topically close but may actually disagree
    (e.g. "Senator voted FOR the bill" vs "Senator voted AGAINST the bill" embed
    very similarly). Callers exclude NO/OPPOSITE results so we never nudge a user
    to vote on a claim that contradicts theirs.

    WHY it defaults to "YES" on any failure: this function only ever runs on a
    candidate that already cleared the >0.85 similarity bar. If the tie-breaker is
    unavailable we fall back to the embedding's judgement (keep the candidate)
    rather than silently dropping a likely-real duplicate.
    """
    client = _get_openai_client()

    if client is None:
        return "YES"

    prompt = (
        "You compare two news claims and decide if they assert the same thing.\n"
        f'Claim A: "{new_title}"\n'
        f'Claim B: "{existing_title}"\n'
        "Return STRICT JSON only, no prose, exactly this shape:\n"
        '{"same_assertion": "YES" | "NO" | "OPPOSITE"}\n'
        "Use OPPOSITE when they make directly contradictory assertions."
    )

    try:
        response = client.chat.completions.create(
            model=STANCE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=20,
        )
        raw = response.choices[0].message.content or ""
        data = json.loads(_strip_json_fences(raw))
        verdict = str(data.get("same_assertion", "")).strip().upper()

        if verdict in {"YES", "NO", "OPPOSITE"}:
            return verdict

        print(f"[embedding] unexpected stance verdict: {verdict!r}; keeping candidate", flush=True)
        return "YES"
    except Exception as error:
        # Fail soft toward keeping the candidate (see docstring).
        print(f"[embedding] stance check failed: {error}", flush=True)
        return "YES"
