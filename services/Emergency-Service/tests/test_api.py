import pytest
# Fixtures are provided by conftest.py

def test_create_incident_api(client):
    incident_payload = {
        "incident_type": "security",
        "location_node": "ZONE_A_01",
        "severity": "high",
        "description": "Fumo detetado",
        "detected_by": "sensor"
    }

    # Correct endpoint: plural
    response = client.post("/api/emergency/incidents", json=incident_payload)

    assert response.status_code == 201  # Created
    data = response.json()
    assert data["incident_type"] == "security"
    assert "id" in data

def test_get_stats_api(client):
    response = client.get("/api/emergency/stats")
    assert response.status_code == 200
    stats = response.json()
    assert "total_incidents" in stats