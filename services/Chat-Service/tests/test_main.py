import os
# Force the DATABASE_URL to SQLite BEFORE importing the app or engine
os.environ["DATABASE_URI"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
import models

# Configure an in-memory SQLite database for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the get_db dependency to use the test DB
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    """Create tables before each test and drop them afterward."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

# --- UNIT AND INTEGRATION TESTS ---

def test_create_message_success():
    """Checks that creating a message via POST works correctly."""
    payload = {
        "room": "norte_01",
        "sender_id": "user_123",
        "sender_name": "Cristiano",
        "text": "Golo!"
    }
    response = client.post("/messages/", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Golo!"
    assert "id" in data

def test_get_messages_by_room():
    """Tests retrieving messages from a specific room."""
    # Insert test message
    client.post("/messages/", json={
        "room": "sul", "sender_id": "1", "sender_name": "A", "text": "Msg 1"
    })
    
    response = client.get("/messages/sul")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["room"] == "sul"

def test_schema_validation_error():
    """Ensures the system rejects invalid payloads (missing fields)."""
    payload = {"room": "norte_01"}  # Faltam campos obrigatórios
    response = client.post("/messages/", json=payload)
    
    assert response.status_code == 422  # Unprocessable Entity (Pydantic error)

def test_mqtt_payload_processing():
    """
    Tests the internal logic that MQTT would use to process data.
    Here we simulate what the on_message function does.
    """
    from main import SessionLocal
    from schemas import ChatMessageCreate
    
    data = {
        "room": "mqtt_room",
        "sender_id": "iot_01",
        "sender_name": "Sensor",
        "text": "Update via MQTT"
    }
    
    # Simulate schema validation that occurs inside on_message
    message_data = ChatMessageCreate(**data)
    assert message_data.room == "mqtt_room"
    assert message_data.text == "Update via MQTT"