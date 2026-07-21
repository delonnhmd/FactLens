"""Contract tests for the additive single-write-path endpoints."""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


AUTHOR_ID = "11111111-1111-4111-8111-111111111111"
CLAIM_ID = "22222222-2222-4222-8222-222222222222"


class FakeResponse:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count


class FakeQuery:
    def __init__(self, database, table_name):
        self.database = database
        self.table_name = table_name
        self.operation = "select"
        self.payload = None
        self.filters = {}
        self.count_requested = False

    def select(self, *_args, **kwargs):
        self.operation = "select"
        self.count_requested = kwargs.get("count") == "exact"
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = dict(payload)
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = dict(payload)
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def gte(self, column, value):
        self.filters[f"{column}__gte"] = value
        return self

    def limit(self, _value):
        return self

    def execute(self):
        if self.table_name == "profiles":
            return FakeResponse([self.database.profile] if self.database.profile else [])

        if self.table_name == "claims" and self.operation == "select":
            if self.count_requested:
                return FakeResponse([], count=self.database.claim_count)
            return FakeResponse([self.database.claim] if self.database.claim else [])

        if self.table_name == "claims" and self.operation == "insert":
            self.database.inserted_claim_payload = dict(self.payload)
            self.database.claim = {"id": CLAIM_ID, **self.payload}
            return FakeResponse([self.database.claim])

        if self.table_name == "claims" and self.operation == "update":
            self.database.claim = {**(self.database.claim or {}), **self.payload}
            return FakeResponse([self.database.claim])

        if self.table_name == "votes" and self.operation == "select":
            return FakeResponse([self.database.existing_vote] if self.database.existing_vote else [])

        if self.table_name == "votes" and self.operation == "insert":
            self.database.inserted_vote_payload = dict(self.payload)
            self.database.existing_vote = {"id": "vote-1", **self.payload}
            return FakeResponse([self.database.existing_vote])

        raise AssertionError(f"Unexpected fake query: {self.table_name} {self.operation}")


class FakeRpc:
    def execute(self):
        return FakeResponse([])


class FakeSupabase:
    def __init__(self):
        self.profile = {
            "id": AUTHOR_ID,
            "is_suspended": False,
            "is_deleted": False,
            "suspension_reason": None,
        }
        self.claim_count = 0
        self.claim = None
        self.existing_vote = None
        self.inserted_claim_payload = None
        self.inserted_vote_payload = None

    def table(self, table_name):
        return FakeQuery(self, table_name)

    def rpc(self, *_args, **_kwargs):
        return FakeRpc()


@pytest.fixture
def fake_database(monkeypatch):
    database = FakeSupabase()
    monkeypatch.setattr(main, "get_authenticated_user_id", lambda _request: AUTHOR_ID)
    monkeypatch.setattr(main, "get_supabase_client", lambda: database)
    monkeypatch.setattr(main, "enforce_rate_limit", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        main,
        "find_duplicate_claims",
        lambda *_args, **_kwargs: {"duplicates": [], "topic_cluster": None, "embedding": None},
    )
    monkeypatch.setattr(main, "check_content_safety", lambda *_args, **_kwargs: {"safe": True})
    monkeypatch.setattr(main, "log_content_safety_block", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "run_claim_post_insert_tasks", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "update_cluster_stats", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "fetch_claim_row", lambda _claim_id: database.claim)
    return database


client = TestClient(main.app)


def valid_claim_body():
    return {
        "title": "The council approved the transit budget",
        "description": "Minutes from the meeting show the measure passed on Tuesday.",
        "category": "Politics",
        "source_url": "example.com/council-minutes",
        "sub_category": "Government",
    }


def test_valid_claim_returns_201_full_row_and_server_author(fake_database):
    body = {**valid_claim_body(), "author_id": "attacker-controlled"}
    response = client.post("/api/claims", json=body)

    assert response.status_code == 201
    row = response.json()
    assert row["id"] == CLAIM_ID
    assert row["author_id"] == AUTHOR_ID
    assert row["title"] == body["title"]
    assert row["source_url"] == "https://example.com/council-minutes"
    assert row["safety_status"] == "APPROVED"
    assert row["share_url"].endswith(f"/claim/{CLAIM_ID}")
    assert fake_database.inserted_claim_payload["author_id"] == AUTHOR_ID


def test_violent_claim_returns_blocked_400(fake_database, monkeypatch):
    monkeypatch.setattr(
        main,
        "check_content_safety",
        lambda *_args, **_kwargs: {"safe": False, "category": "THREATENING_VIOLENCE", "reason": "blocked"},
    )
    response = client.post("/api/claims", json={**valid_claim_body(), "title": "Kill all abc"})

    assert response.status_code == 400
    assert response.json()["blocked"] is True
    assert response.json()["category"] == "THREATENING_VIOLENCE"
    assert fake_database.inserted_claim_payload is None


def test_suspended_user_returns_403(fake_database):
    fake_database.profile["is_suspended"] = True
    fake_database.profile["suspension_reason"] = "Suspended for testing."
    response = client.post("/api/claims", json=valid_claim_body())

    assert response.status_code == 403
    assert response.json()["detail"] == "Suspended for testing."
    assert fake_database.inserted_claim_payload is None


def test_missing_title_returns_422(fake_database):
    body = valid_claim_body()
    del body["title"]
    response = client.post("/api/claims", json=body)

    assert response.status_code == 422
    assert fake_database.inserted_claim_payload is None


def test_description_over_2000_chars_returns_422(fake_database):
    body = {**valid_claim_body(), "description": "x" * 2001}
    response = client.post("/api/claims", json=body)

    assert response.status_code == 422
    assert "2000" in response.json()["detail"]
    assert fake_database.inserted_claim_payload is None


def test_description_of_exactly_2000_chars_is_accepted(fake_database):
    body = {**valid_claim_body(), "description": "x" * 2000}
    response = client.post("/api/claims", json=body)

    assert response.status_code == 201
    assert fake_database.inserted_claim_payload["description"] == "x" * 2000


def test_description_between_old_and_new_limit_is_now_accepted(fake_database):
    # Proves the limit was actually raised from 1000 -> 2000, not left in place.
    body = {**valid_claim_body(), "description": "x" * 1500}
    response = client.post("/api/claims", json=body)

    assert response.status_code == 201


def test_vote_endpoint_enforces_server_user_and_returns_201(fake_database):
    fake_database.claim = {
        "id": CLAIM_ID,
        "status": "ACTIVE",
        "vote_accept_until": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "topic_cluster_id": None,
        "is_deleted": False,
    }
    response = client.post(f"/api/claims/{CLAIM_ID}/vote", json={"vote_type": "NOT_SURE"})

    assert response.status_code == 201
    assert response.json()["vote"]["user_id"] == AUTHOR_ID
    assert response.json()["vote"]["vote_type"] == "UNSURE"
    assert fake_database.inserted_vote_payload["user_id"] == AUTHOR_ID


def test_vote_endpoint_rejects_second_vote(fake_database):
    fake_database.claim = {
        "id": CLAIM_ID,
        "status": "ACTIVE",
        "vote_accept_until": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "topic_cluster_id": None,
        "is_deleted": False,
    }
    fake_database.existing_vote = {
        "id": "vote-1",
        "claim_id": CLAIM_ID,
        "user_id": AUTHOR_ID,
        "vote_type": "TRUE",
    }
    response = client.post(f"/api/claims/{CLAIM_ID}/vote", json={"vote_type": "FAKE"})

    assert response.status_code == 409
    assert response.json()["already_voted"] is True
    assert fake_database.inserted_vote_payload is None
