import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, EmergencyIncident, IncidentSeverity
from incident_manager import IncidentManager
from schemas import IncidentCreate

# Setup the in-memory database for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

def test_create_incident_persistence(db_session):
    # Setup
    manager = IncidentManager("http://routing", "http://map")
    incident_in = IncidentCreate(
        incident_type="fire",
        location_node="N_ENTRANCE_1",
        severity="critical",
        description="Fogo detetado na entrada principal"
    )
    
    # Action
    created_incident = manager.create_incident(db_session, incident_in)
    
    # Verification
    db_incident = db_session.query(EmergencyIncident).filter_by(id=created_incident.id).first()
    assert db_incident is not None
    assert db_incident.severity == IncidentSeverity.CRITICAL
    assert db_incident.location_node == "N_ENTRANCE_1"