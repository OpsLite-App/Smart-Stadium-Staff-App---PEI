"""
Tests for SQLAlchemy models
"""
import pytest
from datetime import datetime
from models import (
    EmergencyIncident, IncidentType, IncidentStatus, IncidentSeverity,
    SensorAlert, SensorType, ResponderDispatch, EvacuationZone,
    EvacuationType, CorridorClosure, IncidentLog, ExternalAlert
)


def test_emergency_incident_creation():
    """Test EmergencyIncident model creation"""
    incident = EmergencyIncident(
        id="inc-test-001",
        incident_type=IncidentType.FIRE,
        status=IncidentStatus.ACTIVE,
        severity=IncidentSeverity.HIGH,
        location_node="N42",
        description="Test fire incident",
        detected_by="system",
        responders_dispatched=0,
        evacuation_triggered=False,
        escalation_count=0,
        external_services_alerted=[],
        incident_metadata={},
        created_at=datetime.now(),
        detected_at=datetime.now()
    )
    
    assert incident.id == "inc-test-001"
    assert incident.incident_type == IncidentType.FIRE
    assert incident.status == IncidentStatus.ACTIVE
    assert incident.severity == IncidentSeverity.HIGH
    assert incident.location_node == "N42"
    assert incident.detected_by == "system"
    assert incident.responders_dispatched == 0
    assert incident.evacuation_triggered == False
    assert incident.escalation_count == 0
    assert incident.created_at is not None


def test_sensor_alert_creation():
    """Test SensorAlert model creation"""
    alert = SensorAlert(
        id="alert-test-001",
        sensor_id="sensor_001",
        sensor_type=SensorType.SMOKE,
        location_node="N42",
        reading_value=150.0,
        threshold=100.0,
        unit="ppm",
        severity=IncidentSeverity.HIGH,
        status="active",
        incident_metadata={},
        detected_at=datetime.now()
    )
    
    assert alert.id == "alert-test-001"
    assert alert.sensor_id == "sensor_001"
    assert alert.sensor_type == SensorType.SMOKE
    assert alert.reading_value == 150.0
    assert alert.threshold == 100.0
    assert alert.unit == "ppm"
    assert alert.severity == IncidentSeverity.HIGH
    assert alert.status == "active"


def test_responder_dispatch_creation():
    """Test ResponderDispatch model creation"""
    dispatch = ResponderDispatch(
        id="dispatch-test-001",
        incident_id="inc-001",
        responder_id="staff_001",
        responder_role="security",
        status="dispatched",
        route_nodes=[],
        incident_metadata={},
        dispatched_at=datetime.now()
    )
    
    assert dispatch.id == "dispatch-test-001"
    assert dispatch.incident_id == "inc-001"
    assert dispatch.responder_id == "staff_001"
    assert dispatch.responder_role == "security"
    assert dispatch.status == "dispatched"


def test_evacuation_zone_creation():
    """Test EvacuationZone model creation"""
    evac = EvacuationZone(
        id="evac-test-001",
        incident_id="inc-001",
        evacuation_type=EvacuationType.PARTIAL,
        affected_zones=["Sector A", "Sector B"],
        status="active",
        reason="Fire in sector A",
        evacuated_count=0,
        affected_nodes=[],
        exit_routes={},
        blocked_corridors=[],
        incident_metadata={},
        initiated_at=datetime.now()
    )
    
    assert evac.id == "evac-test-001"
    assert evac.incident_id == "inc-001"
    assert evac.evacuation_type == EvacuationType.PARTIAL
    assert evac.affected_zones == ["Sector A", "Sector B"]
    assert evac.status == "active"
    assert evac.reason == "Fire in sector A"
    assert evac.evacuated_count == 0


def test_incident_log_creation():
    """Test IncidentLog creation"""
    timestamp = datetime.now()
    log = IncidentLog(
        id=1,
        incident_id="inc-001",
        event_type="created",
        description="Incident created",
        actor="system",
        incident_metadata={},
        timestamp=timestamp
    )
    
    assert log.id == 1
    assert log.incident_id == "inc-001"
    assert log.event_type == "created"
    assert log.description == "Incident created"
    assert log.actor == "system"
    assert log.timestamp == timestamp


def test_incident_enum_values():
    """Test enum values are correct"""
    assert IncidentType.FIRE.value == "fire"
    assert IncidentType.SMOKE.value == "smoke"
    assert IncidentType.GAS_LEAK.value == "gas_leak"
    
    assert IncidentStatus.ACTIVE.value == "active"
    assert IncidentStatus.RESOLVED.value == "resolved"
    
    assert IncidentSeverity.LOW.value == "low"
    assert IncidentSeverity.CRITICAL.value == "critical"
    
    assert SensorType.SMOKE.value == "smoke"
    assert SensorType.FIRE.value == "fire"
    
    assert EvacuationType.PARTIAL.value == "partial"
    assert EvacuationType.FULL.value == "full"