"""Deterministic content-safety pattern tests.

These exercise the deterministic layer of backend/services/content_safety.py
(the blocklist + INDIRECT_VIOLENCE_PATTERNS) which ALWAYS runs and never depends
on OpenAI. The OpenAI moderation/semantic layers are intentionally not exercised
here (no network in CI); this file guarantees that targeted threats are blocked
even with the OpenAI key absent, and that legitimate reporting is not.

Run:  cd backend && python -m pytest tests/test_content_safety_patterns.py -v
      (or plain: python tests/test_content_safety_patterns.py)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Force the deterministic-only path: no OpenAI client, so a block can only come
# from the blocklist or the local threat patterns.
os.environ.pop("OPENAI_API_KEY", None)

from services.content_safety import BLOCKLIST_ENTRIES, check_content_safety  # noqa: E402


def _blocked(title, description=""):
    return not check_content_safety(title, description).get("safe", True)


MUST_BLOCK = [
    "he need to be killed",
    "he needs to be killed",
    "she should be killed",
    "they deserve to die",
    "kill him",
    "kill her now",
    "someone should shoot him",
    "assassinate the president",
    "hang them all",
    "kill her",
    "kill them",
    "shoot him",
    "shoot her",
    "stab him",
    "assassinate him",
    "execute her",
    "hang them",
    "someone should murder him",
    "I will kill you",
    "we are going to shoot them",
    "going to bomb the place",
]

MUST_ALLOW = [
    "The victim was killed according to police.",
    "Was the bill killed in committee?",
    "This policy killed jobs.",
    "The character was killed in the movie.",
    "Did the report accurately state that someone was killed?",
    "The senator voted against the border bill.",
    "Did the policy kill 10,000 jobs?",
    "The report says the victim was killed.",
]

# uppercase / extra spaces / punctuation-between-words evasions
NORMALIZATION_BLOCK = [
    "HE NEED TO BE KILLED",
    "he    need   to   be   killed",
    "he,need.to!be?killed",
]


def test_must_block():
    for text in MUST_BLOCK:
        assert _blocked(text), f"expected BLOCK: {text!r}"


def test_blocklist_entries_block():
    for entry in BLOCKLIST_ENTRIES:
        phrase = entry["phrase"]
        assert _blocked(phrase), f"expected BLOCK from blocklist: {phrase!r}"


def test_must_allow():
    for text in MUST_ALLOW:
        assert not _blocked(text), f"expected ALLOW: {text!r}"


def test_normalization_evasions_blocked():
    for text in NORMALIZATION_BLOCK:
        assert _blocked(text), f"expected BLOCK after normalization: {text!r}"


def test_title_only():
    assert _blocked("he needs to be killed", "")


def test_description_only():
    assert _blocked("Breaking news update", "he needs to be killed")


def test_title_and_description_combined():
    assert _blocked("Local update", "everyone says they deserve to die")


def test_allow_split_across_fields():
    assert not _blocked("The victim was killed", "according to the police report")


def test_missing_openai_key_still_blocks_deterministically():
    # No OPENAI_API_KEY in env (popped above) => OpenAI layers unavailable, yet
    # the deterministic layer must still block a targeted threat.
    assert "OPENAI_API_KEY" not in os.environ
    assert _blocked("he needs to be killed")


def test_missing_openai_key_fails_open_for_benign():
    assert not _blocked("The mayor approved the new transit budget.")


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS  {name}")
            except AssertionError as exc:
                failures += 1
                print(f"  FAIL  {name}: {exc}")
    print(f"\n{'ALL PASSED' if failures == 0 else f'{failures} FAILED'}")
    sys.exit(1 if failures else 0)
