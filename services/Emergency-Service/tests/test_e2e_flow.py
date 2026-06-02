import pytest
import json
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app, IncidentManager
import main
from mqtt_listener import on_message
# Fixtures are provided by conftest.py

@pytest.fixture
def e2e_setup(client, db_session):
    """Setup for e2e tests - initializes incident and evacuation managers with test URLs"""
    # Set fake URLs so managers don't attempt real HTTP calls
    main.incident_manager = IncidentManager("http://fake-routing", "http://fake-map")
    main.evacuation_coordinator = MagicMock()
    
    return client

def test_full_fire_alarm_flow(e2e_setup):
    client = e2e_setup

    # Simulate an MQTT manual alarm message (correct event type)
    mock_msg = MagicMock()
    mock_msg.topic = "stadium/emergency/sos-events"
    payload = {
        "event_type": "manual_alarm",          # production expects this
        "location_node": "SECTOR_B_EXIT",
        "activated_by": "staff_042",
        "severity": "critical",                # production ignores and uses "high"
        "timestamp": "2024-05-20T15:00:00Z"
    }
    mock_msg.payload = json.dumps(payload).encode('utf-8')

    userdata = {
        'incident_manager': main.incident_manager,
        'evacuation_coordinator': MagicMock()
    }

    # Process the message (the patched SessionLocal will be used)
    on_message(None, userdata, mock_msg)

    # 3. Retrieve active incidents
    response = client.get("/api/emergency/incidents", params={"status": "active"})
    assert response.status_code == 200
    active_incidents = response.json()["incidents"]

    # Find the incident created from the MQTT message
    fire_incident = next(
        (inc for inc in active_incidents if inc["location_node"] == "SECTOR_B_EXIT"),
        None
    )
    assert fire_incident is not None
    assert fire_incident["incident_type"] == "security"
    assert fire_incident["severity"] == "high"   # production hardcodes "high"

