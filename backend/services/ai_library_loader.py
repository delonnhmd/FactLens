# PHASE 4 STEP 8
# PHASE 4 STEP 9
import json
from functools import lru_cache
from pathlib import Path
from typing import Any


AI_LIBRARY_DIR = Path(__file__).resolve().parents[1] / "ai_library"

AI_LIBRARY_FILES = {
    "factlens_rules": "factlens_rules.json",
    "claim_type_rules": "claim_type_rules.json",
    "source_quality_rules": "source_quality_rules.json",
    "red_flag_rules": "red_flag_rules.json",
    "confidence_rules": "confidence_rules.json",
    "source_credibility": "source_credibility.json",
}

DEFAULT_FACTLENS_AI_LIBRARY: dict[str, Any] = {
    "factlens_rules": {
        "platform_purpose": "FactLens is a community-driven news verification app.",
        "ai_role": "AI provides risk signals only. AI does not decide final truth.",
        "final_score_formula": "final_score = ai_confidence * 0.40 + weighted_community_score * 0.60",
        "community_weight": "Community voting is stronger than AI.",
        "ai_behavior_rules": [
            "Do not say a claim is definitely true or definitely fake.",
            "Do not invent sources.",
            "If evidence is weak, use NEEDS_MORE_EVIDENCE.",
            "If claim is opinion or subjective, use NOT_FACT_CHECKABLE.",
        ],
    },
    "claim_type_rules": {
        "allowed_claim_type": ["FACTUAL", "OPINION", "SATIRE", "QUESTION", "PROMOTION", "UNCLEAR"],
        "rules": {
            "FACTUAL": "Can be verified with evidence.",
            "OPINION": "Subjective preference, quality judgment, or feeling.",
            "SATIRE": "Joke or parody.",
            "QUESTION": "Asks instead of claims.",
            "PROMOTION": "Mainly advertising or affiliate content.",
            "UNCLEAR": "Too vague to classify.",
        },
    },
    "source_quality_rules": {
        "allowed_source_quality": ["official", "mainstream", "specialized", "social", "blog", "unknown"],
        "rules": {
            "official": [".gov", ".edu", "who.int", "cdc.gov", "fda.gov", "sec.gov", "federalreserve.gov"],
            "mainstream": ["reuters.com", "apnews.com", "bbc.com", "npr.org", "cnn.com"],
            "specialized": ["healthline.com", "webmd.com", "mayoclinic.org", "investopedia.com"],
            "social": ["youtube.com", "tiktok.com", "x.com", "facebook.com", "instagram.com", "reddit.com"],
            "blog": ["personal blogs", "affiliate articles", "medium posts", "unsourced newsletters"],
            "unknown": ["unrecognized website", "random domain", "missing source"],
        },
    },
    "source_credibility": {
        "domains": {},
        "unknown": {"score": 45, "quality": "Not in FactLens library", "lean": "Unknown"},
        "invalid": {"score": 20, "quality": "Invalid URL", "lean": "Unknown"},
    },
    "red_flag_rules": {
        "red_flags": [
            "missing source URL",
            "source not authoritative",
            "no corroborating evidence",
            "vague claim",
            "opinion presented as fact",
            "exaggerated wording",
        ],
    },
    "confidence_rules": {
        "non_fact_checkable": {
            "claim_type": ["OPINION", "QUESTION", "PROMOTION", "SATIRE"],
            "ai_confidence": 0.5,
            "ai_status": "NOT_FACT_CHECKABLE",
        },
    },
}


@lru_cache(maxsize=1)
def load_factlens_ai_library() -> dict[str, Any]:
    library: dict[str, Any] = {}

    for section, filename in AI_LIBRARY_FILES.items():
        path = AI_LIBRARY_DIR / filename

        try:
            with path.open("r", encoding="utf-8") as file:
                library[section] = json.load(file)
        except (OSError, json.JSONDecodeError):
            library[section] = DEFAULT_FACTLENS_AI_LIBRARY[section]

    print("[ai_library] loaded sections:", list(library.keys()), flush=True)
    return library
