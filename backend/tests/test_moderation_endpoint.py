"""Endpoint contract tests for POST /moderation/check.

Auth and rate limiting are patched so the test exercises the moderation
contract (request validation + {ok, allowed, flagged, category, message} shape)
without a live Supabase session. OpenAI is absent, so blocks come from the
deterministic layer only — which is exactly the guarantee we want to prove.

Run:  cd backend && python -m pytest tests/test_moderation_endpoint.py -v
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.pop("OPENAI_API_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture(autouse=True)
def _patch_auth(monkeypatch):
    monkeypatch.setattr(main, "enforce_rate_limit", lambda *args, **kwargs: None)
    # Don't touch Supabase when logging a block.
    monkeypatch.setattr(main, "log_content_safety_block", lambda *args, **kwargs: None)
    yield


client = TestClient(main.app)


def _post(title, description=""):
    return client.post("/moderation/check", json={"title": title, "description": description})


def test_blocks_targeted_threat():
    r = _post("he need to be killed")
    assert r.status_code == 200
    body = r.json()
    assert body == {
        "ok": True,
        "allowed": False,
        "flagged": True,
        "category": "THREATENING_VIOLENCE",
        "message": "This claim may contain violent or threatening language. Please rewrite it before posting.",
    }


def test_blocks_assassinate_president():
    body = _post("assassinate the president").json()
    assert body["allowed"] is False
    assert body["flagged"] is True
    assert body["category"] == "THREATENING_VIOLENCE"


def test_allows_legitimate_reporting():
    body = _post("The victim was killed according to police.").json()
    assert body == {"ok": True, "allowed": True, "flagged": False, "category": None, "message": None}


def test_allows_benign_claim():
    body = _post("The mayor approved the new transit budget.").json()
    assert body["allowed"] is True
    assert body["flagged"] is False


def test_rejects_empty_title():
    r = _post("   ")
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_INPUT"


def test_rejects_overlong_title():
    r = _post("x" * 301)
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_INPUT"


def test_description_only_threat_blocks():
    body = _post("Breaking news", "everyone thinks they deserve to die").json()
    assert body["allowed"] is False


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
