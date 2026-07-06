# VERDICT FORMULA v1 (NEW file, additive feature).
#
# Combines community votes with evidence quality into one verdict:
#   C = VOTE_WEIGHT * D + EVIDENCE_WEIGHT * E
# where D is the TRUE share of decisive votes and E is the TRUE share of
# quality-weighted, side-attributed evidence points.
#
# Inspection notes (2026-07-05):
# - Vote counts live on claims: votes_true / votes_fake / votes_unsure
#   (kept current by the vote RPCs; same columns finalize_expired_claim uses).
# - Evidence side attribution ALREADY exists: evidence.evidence_type is
#   'SUPPORTS_TRUE' | 'SUPPORTS_FAKE' | 'ADDS_CONTEXT' | 'UNCLEAR' (004), so
#   NO supports_side column is added. ADDS_CONTEXT / UNCLEAR have no side and
#   are excluded from the evidence score.
# - Evidence quality is evidence.source_quality_score (0-100, nullable; null
#   scores contribute 0 points and never count as credible).
# - There is NO evidence_votes table yet (verified against supabase/sql and
#   the live schema). helpfulness therefore resolves to 1.0 today; the query
#   probes for the table so Helpful/Misleading voting plugs in later with no
#   code change here.
# - naturally_true_category is set by the AI pre-check (openai_factcheck);
#   'VALUES_DISPUTE' is its no-ruling category.
# - Verdict storage: claims.status / verdict_reason / verdict_calculated_at
#   already exist. Migration 043 adds nullable combined_score,
#   decisive_ratio, evidence_ratio. The app's status enum has no DISPUTED
#   value, so DISPUTED stores as NEEDS_MORE_EVIDENCE (existing display keeps
#   working); the human explanation lives in verdict_reason.
#
# Every threshold is a named constant below — tuning is a one-line change.

from typing import Any

# --- Tunable constants (Verdict Formula v1) ---------------------------------
# Combined-score thresholds: C >= TRUE_THRESHOLD can be TRUE,
# C <= FAKE_THRESHOLD can be FAKE, anything else is DISPUTED.
COMBINED_TRUE_THRESHOLD = 0.65
COMBINED_FAKE_THRESHOLD = 0.35

# Weights for C = VOTE_WEIGHT * D + EVIDENCE_WEIGHT * E (must sum to 1.0).
VOTE_WEIGHT = 0.6
EVIDENCE_WEIGHT = 0.4

# Vote-ratio guards on top of C: TRUE also needs D >= this...
TRUE_VOTE_RATIO_FLOOR = 0.60
# ...and FAKE also needs D <= this.
FAKE_VOTE_RATIO_CEILING = 0.40

# Gate: fewer decisive (TRUE+FAKE) votes than this -> INSUFFICIENT_DATA.
MIN_DECISIVE_VOTES = 10

# Gate: NOT SURE share above this -> DISPUTED (high community uncertainty).
NOT_SURE_GATE = 0.40

# A verdict side needs at least one evidence item at or above this
# source_quality_score to count as credibly supported.
CREDIBLE_SOURCE_SCORE = 40

# Unvoted evidence still counts at this fraction of its quality weight once
# evidence_votes exists (today, with no table, helpfulness is always 1.0).
HELPFULNESS_FLOOR = 0.25
# -----------------------------------------------------------------------------

# Evidence sides come from the existing evidence_type check constraint (004).
EVIDENCE_SIDE_TRUE = "SUPPORTS_TRUE"
EVIDENCE_SIDE_FAKE = "SUPPORTS_FAKE"

# Storage mapping: the claims.status vocabulary the rest of the app already
# renders. DISPUTED intentionally maps onto NEEDS_MORE_EVIDENCE.
VERDICT_TO_CLAIM_STATUS = {
    "TRUE": "FINALIZED_TRUE",
    "FAKE": "FINALIZED_FAKE",
    "DISPUTED": "NEEDS_MORE_EVIDENCE",
    "INSUFFICIENT_DATA": "INSUFFICIENT_DATA",
}


def _fetch_evidence_helpfulness(supabase: Any, evidence_ids: list[str]) -> dict[str, float]:
    """helpful/misleading ratio per evidence id, floored at HELPFULNESS_FLOOR.

    Forward-compatible: evidence_votes does not exist yet, so this fails soft
    and every item gets helpfulness 1.0. When the table lands (expected
    columns: evidence_id, vote in HELPFUL|MISLEADING), this starts weighting
    with no changes elsewhere.
    """
    if not evidence_ids:
        return {}

    try:
        result = (
            supabase.table("evidence_votes")
            .select("evidence_id, vote")
            .in_("evidence_id", evidence_ids)
            .execute()
        )
    except Exception:
        return {}

    counts: dict[str, dict[str, int]] = {}

    for row in result.data or []:
        evidence_id = str(row.get("evidence_id") or "")
        vote = str(row.get("vote") or "").upper()

        if not evidence_id:
            continue

        bucket = counts.setdefault(evidence_id, {"helpful": 0, "misleading": 0})

        if vote == "HELPFUL":
            bucket["helpful"] += 1
        elif vote == "MISLEADING":
            bucket["misleading"] += 1

    helpfulness: dict[str, float] = {}

    for evidence_id, bucket in counts.items():
        total = bucket["helpful"] + bucket["misleading"]
        ratio = bucket["helpful"] / max(total, 1)
        helpfulness[evidence_id] = max(ratio, HELPFULNESS_FLOOR)

    return helpfulness


def compute_verdict(claim_id: str, supabase: Any) -> dict:
    """Verdict Formula v1. Returns the verdict plus every computed input so
    the caller can store them for the Glass Verdict display.

    Result keys: verdict, combined_score, decisive_ratio,
    evidence_ratio_true, total_votes, not_sure_pct, reason.
    Fields that a gate makes undefined come back as None.
    """
    claim_result = (
        supabase.table("claims")
        .select("id, votes_true, votes_fake, votes_unsure, naturally_true_category")
        .eq("id", claim_id)
        .single()
        .execute()
    )
    claim = claim_result.data or {}

    true_votes = int(claim.get("votes_true") or 0)
    fake_votes = int(claim.get("votes_fake") or 0)
    not_sure_votes = int(claim.get("votes_unsure") or 0)
    decisive = true_votes + fake_votes
    total_votes = decisive + not_sure_votes
    not_sure_pct = (not_sure_votes / total_votes) if total_votes > 0 else 0.0

    base = {
        "combined_score": None,
        "decisive_ratio": None,
        "evidence_ratio_true": None,
        "total_votes": total_votes,
        "not_sure_pct": round(not_sure_pct, 4),
    }

    # Gate a: values questions bypass all math.
    if (claim.get("naturally_true_category") or "").upper() == "VALUES_DISPUTE":
        return {
            **base,
            "verdict": "DISPUTED",
            "reason": "Values question — Verifact does not rule on values disputes.",
        }

    # Gate b: not enough decisive votes.
    if decisive < MIN_DECISIVE_VOTES:
        return {
            **base,
            "verdict": "INSUFFICIENT_DATA",
            "reason": f"Fewer than {MIN_DECISIVE_VOTES} decisive votes were cast.",
        }

    # Gate c: too much community uncertainty.
    if not_sure_pct > NOT_SURE_GATE:
        return {
            **base,
            "verdict": "DISPUTED",
            "reason": "High community uncertainty.",
        }

    # Evidence score per side: side_points = source_score * helpfulness.
    evidence_result = (
        supabase.table("evidence")
        .select("id, evidence_type, source_quality_score")
        .eq("claim_id", claim_id)
        .execute()
    )
    evidence_rows = evidence_result.data or []
    helpfulness_by_id = _fetch_evidence_helpfulness(
        supabase, [str(row.get("id")) for row in evidence_rows if row.get("id")]
    )

    ev_true = 0.0
    ev_fake = 0.0
    has_credible_true = False
    has_credible_fake = False

    for row in evidence_rows:
        side = str(row.get("evidence_type") or "")

        # No side attribution (ADDS_CONTEXT / UNCLEAR): excluded.
        if side not in (EVIDENCE_SIDE_TRUE, EVIDENCE_SIDE_FAKE):
            continue

        source_score = float(row.get("source_quality_score") or 0)
        item_helpfulness = helpfulness_by_id.get(str(row.get("id")), 1.0)
        side_points = source_score * item_helpfulness

        if side == EVIDENCE_SIDE_TRUE:
            ev_true += side_points
            has_credible_true = has_credible_true or source_score >= CREDIBLE_SOURCE_SCORE
        else:
            ev_fake += side_points
            has_credible_fake = has_credible_fake or source_score >= CREDIBLE_SOURCE_SCORE

    decisive_ratio = true_votes / decisive
    evidence_total = ev_true + ev_fake
    evidence_ratio_true = (ev_true / evidence_total) if evidence_total > 0 else 0.5
    combined_score = VOTE_WEIGHT * decisive_ratio + EVIDENCE_WEIGHT * evidence_ratio_true

    computed = {
        **base,
        "combined_score": round(combined_score, 4),
        "decisive_ratio": round(decisive_ratio, 4),
        "evidence_ratio_true": round(evidence_ratio_true, 4),
    }

    if (
        combined_score >= COMBINED_TRUE_THRESHOLD
        and decisive_ratio >= TRUE_VOTE_RATIO_FLOOR
        and has_credible_true
    ):
        return {
            **computed,
            "verdict": "TRUE",
            "reason": "Community majority and credible supporting evidence both point to true.",
        }

    if (
        combined_score <= COMBINED_FAKE_THRESHOLD
        and decisive_ratio <= FAKE_VOTE_RATIO_CEILING
        and has_credible_fake
    ):
        return {
            **computed,
            "verdict": "FAKE",
            "reason": "Community majority and credible evidence both point to fake.",
        }

    # DISPUTED: say which condition failed, most specific first.
    if combined_score >= COMBINED_TRUE_THRESHOLD and decisive_ratio >= TRUE_VOTE_RATIO_FLOOR:
        reason = "Majority leaned TRUE but no credible supporting evidence."
    elif combined_score <= COMBINED_FAKE_THRESHOLD and decisive_ratio <= FAKE_VOTE_RATIO_CEILING:
        reason = "Majority leaned FAKE but no credible supporting evidence."
    elif combined_score >= COMBINED_TRUE_THRESHOLD:
        reason = (
            f"Evidence leaned TRUE but the vote margin was below the "
            f"{int(TRUE_VOTE_RATIO_FLOOR * 100)}% threshold."
        )
    elif combined_score <= COMBINED_FAKE_THRESHOLD:
        reason = (
            f"Evidence leaned FAKE but the vote share was above the "
            f"{int(FAKE_VOTE_RATIO_CEILING * 100)}% threshold."
        )
    else:
        reason = (
            f"Vote margin below {int(COMBINED_TRUE_THRESHOLD * 100)}% threshold — "
            "the combined vote and evidence score landed between the True and Fake thresholds."
        )

    return {
        **computed,
        "verdict": "DISPUTED",
        "reason": reason,
    }


def map_verdict_to_claim_status(verdict: str) -> str:
    """The claims.status value the rest of the app already renders."""
    return VERDICT_TO_CLAIM_STATUS.get(verdict, "NEEDS_MORE_EVIDENCE")
