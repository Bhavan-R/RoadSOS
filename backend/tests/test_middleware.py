"""Smoke tests for the FastAPI app with middleware wired in."""
from fastapi.testclient import TestClient

# Import the app — this also tests that all imports + wiring work
from main import app

client = TestClient(app)


class TestRoot:
    def test_index(self):
        r = client.get("/")
        assert r.status_code == 200
        body = r.json()
        assert body["service"] == "RoadSOS API"
        assert "version" in body
        assert "/search" in body["endpoints"]

    def test_index_has_request_id_header(self):
        r = client.get("/")
        assert "x-request-id" in r.headers
        # Should be a non-empty value
        assert len(r.headers["x-request-id"]) > 8

    def test_propagates_provided_request_id(self):
        r = client.get("/", headers={"x-request-id": "my-test-id-12345"})
        assert r.headers["x-request-id"] == "my-test-id-12345"


class TestHealth:
    def test_health_responds(self):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "version" in body
        assert "uptime_seconds" in body
        assert "cache" in body
        assert "configured" in body

    def test_health_cache_block_structure(self):
        r = client.get("/health")
        body = r.json()
        for cache_name in ("overpass", "google_places", "geocode"):
            assert cache_name in body["cache"]
            stats = body["cache"][cache_name]
            for key in ("size", "hits", "misses", "hit_rate"):
                assert key in stats


class TestSearchValidation:
    def test_invalid_lat_rejected(self):
        r = client.get("/search?lat=200&lon=0")
        assert r.status_code == 422  # Pydantic validation

    def test_invalid_lon_rejected(self):
        r = client.get("/search?lat=0&lon=999")
        assert r.status_code == 422

    def test_missing_params_rejected(self):
        r = client.get("/search")
        assert r.status_code == 422


class TestTriageValidation:
    def test_empty_contacts_returns_valid_shape(self):
        r = client.post("/triage", json={"injured": True, "blocking": False, "contacts": []})
        assert r.status_code == 200
        body = r.json()
        assert body["contacts"] == []
        assert isinstance(body["reason"], str)

    def test_missing_field_rejected(self):
        r = client.post("/triage", json={"injured": True})  # blocking missing
        assert r.status_code == 422


class TestDispatchValidation:
    def test_valid_request_returns_summary(self):
        r = client.post("/dispatch-summary", json={
            "lat": 12.97, "lon": 77.59,
            "landmark": "Bannerghatta Road",
            "injured": True, "blocking": True,
        })
        assert r.status_code == 200
        body = r.json()
        assert "summary" in body
        assert "source" in body
        assert body["source"] in ("ai", "template")

    def test_invalid_coordinates_rejected(self):
        r = client.post("/dispatch-summary", json={
            "lat": 999, "lon": 0,
            "injured": False, "blocking": False,
        })
        assert r.status_code == 422
