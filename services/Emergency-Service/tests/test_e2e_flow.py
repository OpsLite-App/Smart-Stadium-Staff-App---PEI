import pytest
import json
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app, IncidentManager
import main
from mqtt_listener import on_message
from database import Base, get_db

# Shared in-memory database for all test connections
SQLALCHEMY_DATABASE_URL = "sqlite:///file::memory:?cache=shared"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False, "uri": True}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
def e2e_setup():
    # Create tables in the shared in-memory database
    Base.metadata.create_all(bind=engine)

    # Set fake URLs so managers don't attempt real HTTP calls
    main.incident_manager = IncidentManager("http://fake-routing", "http://fake-map")
    main.evacuation_coordinator = MagicMock()

    # Patch the SessionLocal at its source so mqtt_listener uses the test database
    mock_session = TestingSessionLocal()  # a single session instance for this test
    with patch("database.SessionLocal", return_value=mock_session):
        with TestClient(app) as client:
            yield client

    # Clean up
    Base.metadata.drop_all(bind=engine)

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
    assert fire_incident["incident_type"] == "fire"
    assert fire_incident["severity"] == "high"   # production hardcodes "high"

