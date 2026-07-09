import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.services.content_safety import check_content_safety


BLOCKED_TITLES = [
    "he need to be killed",
    "he needs to be killed",
    "he should be killed",
    "they should be killed",
    "kill him",
    "kill her",
    "kill them",
    "needs to die",
    "should die",
    "shoot him",
    "shoot her",
    "stab him",
    "execute him",
    "assassinate him",
    "hang him",
    "murder him",
    "death threat",
]

ALLOWED_TITLES = [
    "The movie character was killed in the story",
    "The bill was killed in committee",
    "The team killed the clock",
    "This policy killed jobs",
]


def main() -> int:
    for title in BLOCKED_TITLES:
        verdict = check_content_safety(title, "")
        assert verdict.get("safe") is False, f"{title!r} should be blocked: {verdict}"
        assert verdict.get("matched_layer") in {
            "local_pattern",
            "blocklist",
        }, f"{title!r} should be deterministic: {verdict}"

    for title in ALLOWED_TITLES:
        verdict = check_content_safety(title, "")
        assert verdict.get("safe") is True, f"{title!r} should be allowed: {verdict}"

    print("Content safety backend tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
