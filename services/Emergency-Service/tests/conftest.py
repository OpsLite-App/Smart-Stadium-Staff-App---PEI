"""
Pytest configuration and fixtures for Emergency Service tests
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Generator

from models import Base, EmergencyIncident, IncidentType, IncidentStatus, IncidentSeverity
from database import get_db
from incident_manager import IncidentManager
from evacuation_coordinator import EvacuationCoordinator


# Test database setup
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine"""
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_engine):
    """Create a fresh database session for each test"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def incident_manager():
    """Create IncidentManager with mocked service URLs"""
    return IncidentManager(
        routing_service_url="http://mock-routing:8002",
        map_service_url="http://mock-map:8000"
    )


@pytest.fixture
def evacuation_coordinator():
    """Create EvacuationCoordinator with mocked service URLs"""
    return EvacuationCoordinator(
        routing_service_url="http://mock-routing:8002",
        map_service_url="http://mock-map:8000",
        congestion_service_url="http://mock-congestion:8003"
    )


@pytest.fixture
def sample_incident_data():
    """Sample incident data for testing"""
    return {
        "incident_type": "fire",
        "location_node": "N42",
        "severity": "high",
        "description": "Test fire incident",
        "detected_by": "system"
    }


@pytest.fixture
def sample_sensor_alert():
    """Sample sensor alert data"""
    return {
        "sensor_id": "sensor_001",
        "sensor_type": "smoke",
        "location_node": "N42",
        "reading_value": 150.0,
        "threshold": 100.0,
        "unit": "ppm",
        "severity": "high"
    }