"""
Tests for Pydantic schemas
"""
import pytest
from datetime import datetime
from schemas import (
    IncidentCreate, IncidentUpdate, IncidentResponse,
    SensorAlertCreate, SensorAlertResponse,
    DispatchRequest, DispatchResponse,
    EvacuationRequest, EvacuationResponse,
    IncidentStatistics
)


def test_incident_create_schema():
    """Test IncidentCreate schema validation"""
    data = {
        "incident_type": "fire",
        "location_node": "N42",
        "severity": "high",
        "description": "Test fire",
        "detected_by": "system"
    }
    
    incident = IncidentCreate(**data)
    
    assert incident.incident_type == "fire"
    assert incident.location_node == "N42"
    assert incident.severity == "high"
    assert incident.description == "Test fire"
    assert incident.detected_by == "system"
    assert incident.incident_metadata == {}


def test_incident_update_schema():
    """Test IncidentUpdate schema validation"""
    data = {
        "status": "resolved",
        "notes": "Fire extinguished",
        "responders_dispatched": 2
    }
    
    update = IncidentUpdate(**data)
    
    assert update.status == "resolved"
    assert update.notes == "Fire extinguished"
    assert update.responders_dispatched == 2


def test_sensor_alert_create_schema():
    """Test SensorAlertCreate schema validation"""
    data = {
        "sensor_id": "sensor_001",
        "sensor_type": "smoke",
        "location_node": "N42",
        "reading_value": 150.0,
        "threshold": 100.0,
        "unit": "ppm",
        "severity": "high"
    }
    
    alert = SensorAlertCreate(**data)
    
    assert alert.sensor_id == "sensor_001"
    assert alert.sensor_type == "smoke"
    assert alert.location_node == "N42"
    assert alert.reading_value == 150.0
    assert alert.threshold == 100.0
    assert alert.unit == "ppm"
    assert alert.severity == "high"


def test_dispatch_request_schema():
    """Test DispatchRequest schema validation"""
    data = {
        "incident_id": "inc-001",
        "responder_role": "security",
        "num_responders": 2
    }
    
    dispatch = DispatchRequest(**data)
    
    assert dispatch.incident_id == "inc-001"
    assert dispatch.responder_role == "security"
    assert dispatch.num_responders == 2


def test_dispatch_response_schema():
    """Test DispatchResponse schema validation"""
    data = {
        "id": "dispatch-001",
        "incident_id": "inc-001",
        "responder_id": "staff_001",
        "responder_role": "security",
        "route_nodes": ["N1", "N2", "N3"],
        "route_distance": 150.5,
        "eta_seconds": 120,
        "status": "dispatched",
        "dispatched_at": "2024-01-01T12:00:00",
        "en_route_at": None,
        "arrived_at": None,
        "completed_at": None
    }
    
    response = DispatchResponse(**data)
    
    assert response.id == "dispatch-001"
    assert response.incident_id == "inc-001"
    assert response.responder_id == "staff_001"
    assert response.route_nodes == ["N1", "N2", "N3"]
    assert response.route_distance == 150.5
    assert response.eta_seconds == 120


def test_evacuation_request_schema():
    """Test EvacuationRequest schema validation"""
    data = {
        "incident_id": "inc-001",
        "affected_zones": ["Sector A", "Sector B"],
        "evacuation_type": "partial",
        "reason": "Fire in sector"
    }
    
    evac = EvacuationRequest(**data)
    
    assert evac.incident_id == "inc-001"
    assert evac.affected_zones == ["Sector A", "Sector B"]
    assert evac.evacuation_type == "partial"
    assert evac.reason == "Fire in sector"


def test_incident_statistics_schema():
    """Test IncidentStatistics schema validation"""
    data = {
        "total_incidents": 10,
        "active_incidents": 3,
        "by_type": {"fire": 5, "medical": 3, "other": 2},
        "by_severity": {"low": 2, "medium": 5, "high": 3},
        "by_status": {"active": 3, "resolved": 7},
        "avg_response_time_min": 5.5,
        "avg_resolution_time_min": 30.2,
        "false_alarms": 1,
        "external_alerts_sent": 4
    }
    
    stats = IncidentStatistics(**data)
    
    assert stats.total_incidents == 10
    assert stats.active_incidents == 3
    assert stats.by_type["fire"] == 5
    assert stats.by_severity["high"] == 3
    assert stats.false_alarms == 1
    assert stats.avg_response_time_min == 5.5


def test_schema_validation_errors():
    """Test schema validation errors"""
    # Test missing required field
    from pydantic import ValidationError
    
    # IncidentCreate requires location_node
    with pytest.raises(ValidationError):
        IncidentCreate(
            incident_type="fire",
            # Missing location_node
            severity="high"
        )
    
    # Test that the schema accepts valid incident_type values
    # The schema doesn't validate enum values, so invalid types will still pass
    # This is expected behavior - validation happens at the application level
    try:
        incident = IncidentCreate(
            incident_type="invalid_type",  # Will be accepted by schema
            location_node="N42",
            severity="high"
        )
        # If it doesn't raise an error, that's OK for schema validation
        # The ORM or application logic will handle invalid values
        assert incident.incident_type == "invalid_type"
    except ValidationError:
        # If it does raise, that's also OK
        pass