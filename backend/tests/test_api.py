"""Integration tests using FastAPI TestClient."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_status_shape():
    r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    for key in ("ambient_temp", "target_temp", "mode", "action", "origin", "updated_at"):
        assert key in body


def test_post_telemetry_updates_status():
    payload = {
        "temperature": 68.0,
        "target_temp": 72.0,
        "mode": "AUTO",
        "action": "OFF",
        "origin": "pytest",
    }
    r = client.post("/api/telemetry", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["ambient_temp"] == 68.0
    assert body["target_temp"] == 72.0
    assert body["action"] == "HEATING"  # 68 < 72 - 0.5

    r2 = client.get("/api/status")
    assert r2.json()["origin"] == "pytest"


def test_post_telemetry_validates_setpoint():
    r = client.post(
        "/api/telemetry",
        json={"temperature": 70, "target_temp": 120, "mode": "AUTO", "action": "OFF"},
    )
    assert r.status_code == 422
