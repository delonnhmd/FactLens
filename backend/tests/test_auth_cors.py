"""Production web CORS contract tests for browser authentication calls."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


client = TestClient(main.app)


def preflight(origin: str):
    return client.options(
        "/api/claims/00000000-0000-4000-8000-000000000010/vote",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )


def test_factfight_production_origins_are_allowed():
    for origin in ("https://factfight.com", "https://www.factfight.com"):
        response = preflight(origin)
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_unapproved_origin_receives_no_cors_permission():
    response = preflight("https://evil.example")

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_legacy_and_local_origins_are_explicitly_preserved():
    for origin in (
        "https://verifact.pennyfloat.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ):
        assert preflight(origin).headers["access-control-allow-origin"] == origin


def test_configured_origins_are_validated_and_never_fall_back_to_wildcard(monkeypatch):
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS",
        "https://preview.example,*,javascript:alert(1),https://preview.example/path,https://preview.example?bad=1",
    )

    assert main.get_cors_allowed_origins() == ["https://preview.example"]
