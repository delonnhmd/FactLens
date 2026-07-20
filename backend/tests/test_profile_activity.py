"""Privacy contract tests for public profile activity and owner-only votes."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


PROFILE_ID = "11111111-1111-4111-8111-111111111111"
OTHER_ID = "22222222-2222-4222-8222-222222222222"
CLAIM_ID = "33333333-3333-4333-8333-333333333333"


@pytest.fixture
def profile_contract(monkeypatch):
    profile = {
        "id": PROFILE_ID,
        "username": "fact_checker",
        "display_name": "Fact Checker",
        "profile_visibility": "public",
        "is_deleted": False,
    }
    monkeypatch.setattr(main, "enforce_rate_limit", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "get_public_profile_activity_context", lambda *_args: (object(), profile))
    return profile


client = TestClient(main.app)


def test_public_posts_never_return_vote_choices_or_internal_fields(profile_contract, monkeypatch):
    monkeypatch.setattr(
        main,
        "fetch_public_profile_posts",
        lambda *_args: [
            {
                "id": CLAIM_ID,
                "title": "A public claim",
                "description_preview": "Public preview",
                "final_verdict": "TRUE",
                "vote_totals": {"true": 4, "fake": 1, "unsure": 2, "total": 7},
                "created_at": "2026-07-19T00:00:00Z",
            }
        ],
    )

    response = client.get("/profiles/fact_checker/posts")

    assert response.status_code == 200
    body = response.json()
    serialized = str(body).lower()
    assert body["count"] == 1
    assert "vote_type" not in serialized
    assert "trust_weight" not in serialized
    assert "suspicious" not in serialized
    assert "moderation" not in serialized


def test_public_replies_and_evidence_are_content_only(profile_contract, monkeypatch):
    monkeypatch.setattr(main, "fetch_public_profile_replies", lambda *_args: [])
    monkeypatch.setattr(
        main,
        "fetch_public_profile_evidence",
        lambda *_args: [
            {
                "id": "44444444-4444-4444-8444-444444444444",
                "evidence_type": "ADDS_CONTEXT",
                "note": "Public evidence note",
                "claim_id": CLAIM_ID,
                "claim_title": "A public claim",
            }
        ],
    )

    replies = client.get("/profiles/fact_checker/replies")
    evidence = client.get("/profiles/fact_checker/evidence")

    assert replies.status_code == 200
    assert replies.json() == {"ok": True, "replies": [], "count": 0}
    assert evidence.status_code == 200
    assert evidence.json()["evidence"][0]["note"] == "Public evidence note"
    assert "vote_type" not in str(evidence.json()).lower()


def test_private_votes_derive_owner_from_token_and_have_no_public_user_id(monkeypatch):
    requested_user_ids = []
    monkeypatch.setattr(main, "get_authenticated_user_id", lambda _request: PROFILE_ID)
    monkeypatch.setattr(main, "get_supabase_client", lambda: object())

    def fake_history(_supabase, user_id):
        requested_user_ids.append(user_id)
        return [
            {
                "claim_id": CLAIM_ID,
                "claim_title": "A public claim",
                "vote_type": "TRUE",
                "final_verdict": "TRUE",
                "result": "MATCHED",
                "voted_at": "2026-07-19T00:00:00Z",
            }
        ]

    monkeypatch.setattr(main, "fetch_private_vote_history", fake_history)

    response = client.get(f"/profiles/me/votes?user_id={OTHER_ID}")

    assert response.status_code == 200
    assert requested_user_ids == [PROFILE_ID]
    assert response.json()["votes"][0]["vote_type"] == "TRUE"
    assert client.get(f"/profiles/{OTHER_ID}/votes").status_code == 404


def test_deleted_hidden_and_unapproved_claims_are_not_public():
    base = {
        "id": CLAIM_ID,
        "is_deleted": False,
        "is_hidden": False,
        "hidden": False,
        "safety_status": "APPROVED",
    }

    assert main.is_public_profile_claim(base) is True
    assert main.is_public_profile_claim({**base, "is_deleted": True}) is False
    assert main.is_public_profile_claim({**base, "is_hidden": True}) is False
    assert main.is_public_profile_claim({**base, "hidden": True}) is False
    assert main.is_public_profile_claim({**base, "safety_status": "PENDING"}) is False


def test_removed_or_rejected_evidence_is_not_public():
    assert main.is_public_evidence_row({"hidden": False}) is True
    assert main.is_public_evidence_row({"hidden": True}) is False
    assert main.is_public_evidence_row({"moderation_status": "REJECTED"}) is False
