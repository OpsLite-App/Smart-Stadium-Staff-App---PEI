"""
Tests for main FastAPI endpoints
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime
import json

from main import app
from schemas import IncidentResponse, DispatchResponse, EvacuationResponse


client = TestClient(app)


def test_root_endpoint():
    """Test the root health check endpoint"""
    response = client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["service"] == "Emergency Service"
    assert data["status"] == "running"
    assert "emergency_contacts" in data


def test_service_status_endpoint():
    """Test the service status endpoint"""
    # Mock the dependencies
    with patch('main.incident_manager') as mock_im, \
         patch('main.evacuation_coordinator') as mock_ec:
        
        mock_im.get_statistics.return_value = {
            "total_incidents": 5,
            "active_incidents": 2,
            "by_type": {"fire": 2, "medical": 3},
            "by_severity": {"low": 1, "medium": 3, "high": 1},
            "by_status": {"active": 2, "resolved": 3},
            "avg_response_time_min": 5.5,
            "avg_resolution_time_min": 30.0,
            "false_alarms": 0,
            "external_alerts_sent": 2
        }
        
        mock_im.get_active_incidents.return_value = []
        mock_ec.get_active_evacuations.return_value = []
        
        response = client.get("/api/emergency/status")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "operational"
    assert "timestamp" in data
    assert "statistics" in data
    assert "emergency_level" in data


def test_create_incident_endpoint():
    """Test creating an incident via API"""
    incident_data = {
        "incident_type": "fire",
        "location_node": "N42",
        "severity": "high",
        "description": "Test fire via API",
        "detected_by": "system"
    }
    
    with patch('main.incident_manager') as mock_im:
        # Create a proper IncidentResponse object
        incident_response = IncidentResponse(
            id="inc-api-001",
            incident_type="fire",
            status="active",
            severity="high",
            location_node="N42",
            location_description=None,
            affected_area=None,
            description="Test fire via API",
            notes=None,
            detected_by="system",
            sensor_id=None,
            reported_by=None,
            responders_dispatched=0,
            external_services_alerted=[],
            evacuation_triggered=False,
            incident_metadata={},
            created_at="2024-01-01T12:00:00",
            detected_at="2024-01-01T12:00:00",
            responded_at=None,
            contained_at=None,
            resolved_at=None,
            escalation_count=0,
            last_escalated_at=None
        )
        
        mock_im.create_incident.return_value = incident_response
        mock_im.auto_dispatch_responders = AsyncMock(return_value=[])
        
        response = client.post(
            "/api/emergency/incidents",
            json=incident_data,
            params={"auto_dispatch": True}
        )
    
    assert response.status_code == 201
    data = response.json()
    
    assert data["id"] == "inc-api-001"
    assert data["incident_type"] == "fire"
    assert data["severity"] == "high"


def test_get_incidents_endpoint():
    """Test getting incidents via API"""
    with patch('main.incident_manager') as mock_im:
        # Create a proper IncidentResponse object
        incident_response = IncidentResponse(
            id="inc-001",
            incident_type="fire",
            status="active",
            severity="high",
            location_node="N42",
            location_description=None,
            affected_area=None,
            description="Test incident",
            notes=None,
            detected_by="system",
            sensor_id=None,
            reported_by=None,
            responders_dispatched=0,
            external_services_alerted=[],
            evacuation_triggered=False,
            incident_metadata={},
            created_at="2024-01-01T12:00:00",
            detected_at="2024-01-01T12:00:00",
            responded_at=None,
            contained_at=None,
            resolved_at=None,
            escalation_count=0,
            last_escalated_at=None
        )
        
        mock_im.get_incidents.return_value = [incident_response]
        
        response = client.get("/api/emergency/incidents")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["total"] == 1
    assert data["active_count"] == 1
    assert len(data["incidents"]) == 1
    assert data["incidents"][0]["id"] == "inc-001"
    assert data["incidents"][0]["incident_type"] == "fire"


def test_get_single_incident_endpoint():
    """Test getting a single incident via API"""
    with patch('main.incident_manager') as mock_im:
        # Create a proper IncidentResponse object
        incident_response = IncidentResponse(
            id="inc-001",
            incident_type="medical",
            status="active",
            severity="medium",
            location_node="N42",
            location_description="Main concourse",
            affected_area="Sector A",
            description="Medical emergency",
            notes="Patient stable",
            detected_by="staff",
            sensor_id=None,
            reported_by="staff_001",
            responders_dispatched=1,
            external_services_alerted=["ambulance"],
            evacuation_triggered=False,
            incident_metadata={},
            created_at="2024-01-01T12:00:00",
            detected_at="2024-01-01T12:00:00",
            responded_at="2024-01-01T12:05:00",
            contained_at=None,
            resolved_at=None,
            escalation_count=0,
            last_escalated_at=None
        )
        
        mock_im.get_incident.return_value = incident_response
        
        response = client.get("/api/emergency/incidents/inc-001")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["id"] == "inc-001"
    assert data["incident_type"] == "medical"
    assert data["detected_by"] == "staff"


def test_get_nonexistent_incident_endpoint():
    """Test getting a non-existent incident"""
    with patch('main.incident_manager') as mock_im:
        mock_im.get_incident.return_value = None
        
        response = client.get("/api/emergency/incidents/non-existent")
    
    assert response.status_code == 404


def test_update_incident_endpoint():
    """Test updating an incident via API"""
    update_data = {
        "status": "resolved",
        "notes": "Incident resolved via API",
        "responders_dispatched": 2
    }
    
    with patch('main.incident_manager') as mock_im:
        # Create a proper updated IncidentResponse
        updated_incident = IncidentResponse(
            id="inc-001",
            incident_type="fire",
            status="resolved",
            severity="high",
            location_node="N42",
            location_description="Main hall",
            affected_area="Zone 1",
            description="Fire incident",
            notes="Incident resolved via API",
            detected_by="system",
            sensor_id=None,
            reported_by=None,
            responders_dispatched=2,
            external_services_alerted=[],
            evacuation_triggered=False,
            incident_metadata={},
            created_at="2024-01-01T12:00:00",
            detected_at="2024-01-01T12:00:00",
            responded_at="2024-01-01T12:05:00",
            contained_at="2024-01-01T12:10:00",
            resolved_at="2024-01-01T12:15:00",
            escalation_count=0,
            last_escalated_at=None
        )
        
        mock_im.update_incident.return_value = updated_incident
        
        response = client.patch(
            "/api/emergency/incidents/inc-001",
            json=update_data
        )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "resolved"
    assert data["notes"] == "Incident resolved via API"


def test_escalate_incident_endpoint():
    """Test escalating an incident via API"""
    with patch('main.incident_manager') as mock_im:
        # Create a proper escalated IncidentResponse
        escalated_incident = IncidentResponse(
            id="inc-001",
            incident_type="fire",
            status="active",
            severity="critical",
            location_node="N42",
            location_description=None,
            affected_area=None,
            description="Fire",
            notes=None,
            detected_by="system",
            sensor_id=None,
            reported_by=None,
            responders_dispatched=0,
            external_services_alerted=[],
            evacuation_triggered=False,
            incident_metadata={},
            created_at="2024-01-01T12:00:00",
            detected_at="2024-01-01T12:00:00",
            responded_at=None,
            contained_at=None,
            resolved_at=None,
            escalation_count=1,
            last_escalated_at="2024-01-01T12:05:00"
        )
        
        mock_im.escalate_incident.return_value = escalated_incident
        
        response = client.post("/api/emergency/incidents/inc-001/escalate")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "escalated"
    assert data["incident_id"] == "inc-001"
    assert data["new_severity"] == "critical"


def test_create_sensor_alert_endpoint():
    """Test creating incident from sensor alert via API"""
    alert_data = {
        "sensor_id": "sensor_api_001",
        "sensor_type": "smoke",
        "location_node": "N42",
        "reading_value": 180.0,
        "threshold": 100.0,
        "unit": "ppm",
        "severity": "high"
    }
    
    with patch('main.incident_manager') as mock_im:
        # Create a proper IncidentResponse
        incident_response = IncidentResponse(
            id="inc-sensor-001",
            incident_type="smoke",
            status="active",
            severity="high",
            location_node="N42",
            location_description=None,
            affected_area=None,
            description="SMOKE sensor alert: 180.0ppm (threshold: 100.0ppm)",
            notes=None,
            detected_by="sensor",
            sensor_id="sensor_api_001",
            reported_by=None,
            responders_dispatched=0,
            external_services_alerted=[],
            evacuation_triggered=False,
            incident_metadata={"sensor_alert_id": "alert-001", "reading": 180.0, "threshold": 100.0, "unit": "ppm"},
            created_at="2024-01-01T12:00:00",
            detected_at="2024-01-01T12:00:00",
            responded_at=None,
            contained_at=None,
            resolved_at=None,
            escalation_count=0,
            last_escalated_at=None
        )
        
        mock_im.create_incident_from_sensor.return_value = incident_response
        mock_im.auto_dispatch_responders = AsyncMock(return_value=[])
        
        response = client.post("/api/emergency/sensors/alert", json=alert_data)
    
    assert response.status_code == 201
    data = response.json()
    
    assert data["id"] == "inc-sensor-001"
    assert data["incident_type"] == "smoke"
    assert data["severity"] == "high"


def test_dispatch_responders_endpoint():
    """Test dispatching responders via API"""
    dispatch_data = {
        "incident_id": "inc-001",
        "responder_role": "security",
        "num_responders": 2
    }
    
    with patch('main.incident_manager') as mock_im:
        # Create proper DispatchResponse objects
        dispatch_response1 = DispatchResponse(
            id="dispatch-001",
            incident_id="inc-001",
            responder_id="staff_001",
            responder_role="security",
            route_nodes=["N1", "N2", "N42"],
            route_distance=150.5,
            eta_seconds=120,
            status="dispatched",
            dispatched_at="2024-01-01T12:00:00",
            en_route_at=None,
            arrived_at=None,
            completed_at=None
        )
        
        mock_im.dispatch_responders = AsyncMock(return_value=[dispatch_response1])
        
        response = client.post("/api/emergency/dispatch", json=dispatch_data)
    
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 1
    assert data[0]["id"] == "dispatch-001"
    assert data[0]["incident_id"] == "inc-001"
    assert data[0]["responder_role"] == "security"


def test_initiate_evacuation_endpoint():
    """Test initiating evacuation via API"""
    evac_data = {
        "incident_id": "inc-001",
        "affected_zones": ["Sector A", "Sector B"],
        "evacuation_type": "partial",
        "reason": "Fire in sector"
    }
    
    with patch('main.evacuation_coordinator') as mock_ec:
        # Create proper EvacuationResponse
        evacuation_response = EvacuationResponse(
            id="evac-api-001",
            incident_id="inc-001",
            evacuation_type="partial",
            affected_zones=["Sector A", "Sector B"],
            affected_nodes=[],
            exit_routes={},
            blocked_corridors=[],
            status="active",
            initiated_at="2024-01-01T12:00:00",
            completed_at=None,
            estimated_people=None,
            evacuated_count=0,
            reason="Fire in sector",
            incident_metadata={}
        )
        
        mock_ec.initiate_evacuation = AsyncMock(return_value=evacuation_response)
        
        response = client.post("/api/emergency/evacuation", json=evac_data)
    
    assert response.status_code == 201
    data = response.json()
    
    assert data["id"] == "evac-api-001"
    assert data["evacuation_type"] == "partial"
    assert data["affected_zones"] == ["Sector A", "Sector B"]
    assert data["reason"] == "Fire in sector"


def test_get_statistics_endpoint():
    """Test getting statistics via API"""
    with patch('main.incident_manager') as mock_im:
        mock_stats = {
            "total_incidents": 10,
            "active_incidents": 3,
            "by_type": {"fire": 5, "medical": 5},
            "by_severity": {"low": 2, "medium": 5, "high": 3},
            "by_status": {"active": 3, "resolved": 7},
            "avg_response_time_min": 5.5,
            "avg_resolution_time_min": 30.2,
            "false_alarms": 1,
            "external_alerts_sent": 4
        }
        
        mock_im.get_statistics.return_value = mock_stats
        
        response = client.get("/api/emergency/stats")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["total_incidents"] == 10
    assert data["active_incidents"] == 3
    assert data["by_type"]["fire"] == 5
    assert data["by_severity"]["high"] == 3
    assert data["false_alarms"] == 1
    assert data["avg_response_time_min"] == 5.5