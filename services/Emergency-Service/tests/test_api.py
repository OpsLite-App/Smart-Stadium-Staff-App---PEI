import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import main
from main import app
from database import Base, get_db

# Set fake service URLs BEFORE importing main modules that read them
os.environ["ROUTING_SERVICE_URL"] = "http://fake-routing"
os.environ["MAP_SERVICE_URL"] = "http://fake-map"
os.environ["CONGESTION_SERVICE_URL"] = "http://fake-congestion"

# Use a shared in-memory SQLite database so all connections see the same data
SQLALCHEMY_DATABASE_URL = "sqlite:///file::memory:?cache=shared"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False, "uri": True}  # <-- Add uri=True
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def initialize_app():
    # Create tables in the shared in-memory database
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    # The TestClient triggers the startup event, which now uses the fake URLs from environment
    with TestClient(app) as c:
        yield c

def test_create_incident_api(client):
    incident_payload = {
        "incident_type": "fire",
        "location_node": "ZONE_A_01",
        "severity": "high",
        "description": "Fumo detetado",
        "detected_by": "sensor"
    }

    # Correct endpoint: plural
    response = client.post("/api/emergency/incidents", json=incident_payload)

    assert response.status_code == 201  # Created
    data = response.json()
    assert data["incident_type"] == "fire"
    assert "id" in data

def test_get_stats_api(client):
    response = client.get("/api/emergency/stats")
    assert response.status_code == 200
    stats = response.json()
    assert "total_incidents" in stats