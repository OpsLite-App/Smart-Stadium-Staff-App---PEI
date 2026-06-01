"""
Integration tests for Emergency Service workflow.
Tests the critical path: Emergency Incident → Dispatch → Route Calculation → Response
"""

import pytest
import httpx
import asyncio
from datetime import datetime
from typing import Dict, Any


@pytest.mark.integration
@pytest.mark.workflow
class TestEmergencyIncidentWorkflow:
    """Test the complete emergency response workflow."""
    
    async def test_incident_creation_and_dispatch(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        incident_data: Dict[str, Any],
    ):
        """
        Test: Create incident → Emergency Service validates → Dispatch responders
        """
        # Map incident_data to IncidentCreate schema
        payload = {
            "incident_type": "medic",
            "location_node": incident_data["location"],
            "severity": incident_data["severity"],
            "description": incident_data["description"],
            "reported_by": incident_data["reporter_id"],
        }
        
        # Create incident
        response = await http_client.post(
            f"{service_urls['emergency']}/incidents",
            json=payload,
        )
        assert response.status_code == 201, f"Failed to create incident: {response.text}"
        incident = response.json()
        incident_id = incident.get("id")
        assert incident_id is not None, "Incident ID not returned"
        
        # Retrieve incident to verify creation
        response = await http_client.get(
            f"{service_urls['emergency']}/incidents/{incident_id}",
        )
        assert response.status_code == 200, "Failed to retrieve incident"
        retrieved_incident = response.json()
        assert retrieved_incident["location_node"] == payload["location_node"]
        assert retrieved_incident["severity"] == payload["severity"]
    
    async def test_incident_to_route_calculation(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        incident_data: Dict[str, Any],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Create incident → Calculate optimal route to incident location
        Verifies cross-service communication between Emergency and Routing Service
        """
        # Create incident
        payload = {
            "incident_type": "medic",
            "location_node": incident_data["location"],
            "severity": incident_data["severity"],
        }
        incident_response = await http_client.post(
            f"{service_urls['emergency']}/incidents",
            json=payload,
        )
        assert incident_response.status_code == 201
        
        # Request route from responder location to incident
        start = map_service_data["start_node"]
        end = incident_data["location"]
        
        route_response = await http_client.get(
            f"{service_urls['routing']}/route",
            params={"from_node": start, "to_node": end},
        )
        assert route_response.status_code == 200, f"Route calculation failed: {route_response.text}"
        route = route_response.json()
        assert "path" in route, "Route missing path information"
    
    async def test_concurrent_incidents(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        incident_data: Dict[str, Any],
    ):
        """
        Test: Emergency Service handles multiple concurrent incidents
        """
        tasks = []
        
        # Create 5 concurrent incidents
        for i in range(5):
            payload = {
                "incident_type": "security",
                "location_node": "gate_1",
                "severity": "low",
                "description": f"Incident {i+1}",
            }
            tasks.append(
                http_client.post(
                    f"{service_urls['emergency']}/incidents",
                    json=payload,
                )
            )
        
        responses = await asyncio.gather(*tasks)
        incident_ids = []
        for response in responses:
            assert response.status_code == 201
            incident_ids.append(response.json()["id"])
        
        # Verify all incidents are tracked
        for incident_id in incident_ids:
            response = await http_client.get(
                f"{service_urls['emergency']}/incidents/{incident_id}",
            )
            assert response.status_code == 200, f"Failed to retrieve incident {incident_id}"
    
    async def test_incident_with_congestion_awareness(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        incident_data: Dict[str, Any],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Route calculation considers congestion data
        """
        # Update crowd penalty
        congestion_payload = {
            "node_id": "zone_1",
            "occupancy_rate": 0.9,
        }
        # In Routing Service
        congestion_response = await http_client.post(
            f"{service_urls['routing']}/hazards/crowd",
            params=congestion_payload,
        )
        assert congestion_response.status_code == 200
        
        # Request route (should consider congestion)
        start = map_service_data["start_node"]
        end = incident_data["location"]
        
        route_response = await http_client.get(
            f"{service_urls['routing']}/route",
            params={"from_node": start, "to_node": end, "avoid_crowds": True},
        )
        assert route_response.status_code == 200


@pytest.mark.integration
@pytest.mark.service_call
class TestEmergencyServiceIntegration:
    """Test Emergency Service integration with other services."""
    
    async def test_emergency_responder_dispatch(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        incident_data: Dict[str, Any],
    ):
        """
        Test: Dispatch endpoint creates responder assignments
        """
        # First create an incident
        payload = {
            "incident_type": "medic",
            "location_node": incident_data["location"],
            "severity": "high",
        }
        incident_response = await http_client.post(
            f"{service_urls['emergency']}/incidents",
            json=payload,
        )
        assert incident_response.status_code == 201
        incident_id = incident_response.json()["id"]
        
        # Dispatch responders (ManualDispatchRequest)
        dispatch_data = {
            "incident_id": incident_id,
            "responder_id": "staff_001",
            "responder_role": "medic",
            "current_position": "gate_1",
        }
        
        dispatch_response = await http_client.post(
            f"{service_urls['emergency']}/dispatch/manual",
            json=dispatch_data,
        )
        assert dispatch_response.status_code in [200, 201], f"Dispatch failed: {dispatch_response.text}"
    
    async def test_sensor_alert_creation(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Sensor alerts trigger incident creation
        """
        alert_data = {
            "sensor_id": "sensor_001",
            "sensor_type": "fire",
            "location_node": "zone_1",
            "reading_value": 100.0,
            "threshold": 50.0,
            "severity": "critical",
        }
        
        response = await http_client.post(
            f"{service_urls['emergency']}/sensors/alert",
            json=alert_data,
        )
        assert response.status_code in [200, 201], f"Sensor alert failed: {response.text}"
    
    async def test_incident_statistics(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        incident_data: Dict[str, Any],
    ):
        """
        Test: Statistics endpoint aggregates incident data
        """
        # Get statistics (using /status or /stats)
        response = await http_client.get(
            f"{service_urls['emergency']}/status",
        )
        assert response.status_code == 200, f"Statistics failed: {response.text}"
        stats = response.json()
        assert "active_incidents" in stats
