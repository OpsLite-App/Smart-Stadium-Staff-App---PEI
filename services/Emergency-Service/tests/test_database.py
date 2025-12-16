"""
Tests for database setup and operations
"""
import pytest
from sqlalchemy.exc import IntegrityError
from models import EmergencyIncident, IncidentType, IncidentStatus, IncidentSeverity


def test_database_creation(db_session):
    """Test database tables can be created"""
    # Check that we can create a session
    assert db_session is not None
    
    # Check that we can query (tables exist)
    result = db_session.query(EmergencyIncident).all()
    # Could be 0 or more depending on other tests
    assert isinstance(result, list)


def test_insert_incident(db_session):
    """Test inserting an incident into database"""
    incident = EmergencyIncident(
        id="inc-test-001",
        incident_type=IncidentType.FIRE,
        status=IncidentStatus.ACTIVE,
        severity=IncidentSeverity.HIGH,
        location_node="N42",
        description="Test fire incident",
        detected_by="system"
    )
    
    db_session.add(incident)
    db_session.commit()
    
    # Retrieve from database
    retrieved = db_session.query(EmergencyIncident).filter_by(id="inc-test-001").first()
    
    assert retrieved is not None
    assert retrieved.id == "inc-test-001"
    assert retrieved.incident_type == IncidentType.FIRE
    assert retrieved.location_node == "N42"


def test_unique_constraint(db_session):
    """Test that duplicate primary keys are rejected"""
    # First, delete any existing incident with this ID
    existing = db_session.query(EmergencyIncident).filter_by(id="inc-duplicate").first()
    if existing:
        db_session.delete(existing)
        db_session.commit()
    
    incident1 = EmergencyIncident(
        id="inc-duplicate",
        incident_type=IncidentType.FIRE,
        status=IncidentStatus.ACTIVE,
        severity=IncidentSeverity.MEDIUM,
        location_node="N42",
        detected_by="system"
    )
    
    db_session.add(incident1)
    db_session.commit()
    
    # Now try to create another with same ID
    incident2 = EmergencyIncident(
        id="inc-duplicate",  # Same ID
        incident_type=IncidentType.SMOKE,
        status=IncidentStatus.ACTIVE,
        severity=IncidentSeverity.MEDIUM,
        location_node="N43",
        detected_by="sensor"
    )
    
    db_session.add(incident2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    
    db_session.rollback()


def test_null_constraints(db_session):
    """Test that required fields cannot be null"""
    # Test with missing required fields
    with pytest.raises(Exception):  # Could be IntegrityError or other
        incident = EmergencyIncident(
            id="inc-test-null",
            # Missing required fields: incident_type, status, severity, location_node
        )
        
        db_session.add(incident)
        db_session.commit()
        db_session.rollback()


def test_indexed_fields(db_session):
    """Test that indexed fields work correctly"""
    # Clear any existing incidents first
    db_session.query(EmergencyIncident).delete()
    db_session.commit()
    
    # Create multiple incidents
    for i in range(5):
        incident = EmergencyIncident(
            id=f"inc-index-{i}",
            incident_type=IncidentType.FIRE if i % 2 == 0 else IncidentType.MEDICAL,
            status=IncidentStatus.ACTIVE,
            severity=IncidentSeverity.HIGH if i < 3 else IncidentSeverity.LOW,
            location_node=f"N{i}",
            detected_by="system"
        )
        db_session.add(incident)
    
    db_session.commit()
    
    # Query by indexed field
    results = db_session.query(EmergencyIncident).filter_by(
        incident_type=IncidentType.FIRE
    ).all()
    
    # Should have 3 fires (indices 0, 2, 4)
    assert len(results) == 3
    
    # Query by another indexed field
    results = db_session.query(EmergencyIncident).filter_by(
        severity=IncidentSeverity.HIGH
    ).all()
    
    # Should have 3 high severity (indices 0, 1, 2)
    assert len(results) == 3


def test_json_field_storage(db_session):
    """Test that JSON fields store and retrieve data correctly"""
    incident = EmergencyIncident(
        id="inc-json-test",
        incident_type=IncidentType.FIRE,
        status=IncidentStatus.ACTIVE,
        severity=IncidentSeverity.HIGH,
        location_node="N42",
        detected_by="system",
        external_services_alerted=["fire_brigade", "police"],
        incident_metadata={"sensor_id": "sensor_001", "temperature": 45.5}
    )
    
    db_session.add(incident)
    db_session.commit()
    
    # Retrieve and check JSON fields
    retrieved = db_session.query(EmergencyIncident).filter_by(id="inc-json-test").first()
    
    assert retrieved.external_services_alerted == ["fire_brigade", "police"]
    assert retrieved.incident_metadata["sensor_id"] == "sensor_001"
    assert retrieved.incident_metadata["temperature"] == 45.5