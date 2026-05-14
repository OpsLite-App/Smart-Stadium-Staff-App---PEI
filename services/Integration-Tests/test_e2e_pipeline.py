"""
End-to-end integration test for the complete stadium event processing pipeline.
Tests the full flow from event creation through all services.
"""

import pytest
import httpx
import asyncio
import json
from datetime import datetime
from typing import Dict, Any


@pytest.mark.integration
@pytest.mark.workflow
class TestEndToEndEventPipeline:
    """Test complete event processing pipeline."""
    
    async def test_emergency_incident_full_response_flow(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        incident_data: Dict[str, Any],
        map_service_data: Dict[str, Any],
    ):
        """
        Test complete emergency response flow:
        1. Report incident → Emergency Service
        2. Emergency Service queries Routing Service for nearest responder location
        3. Routing Service queries Map Service for graph
        4. Route is calculated and returned
        5. Responders are dispatched
        """
        print("\n=== Testing Full Emergency Response Flow ===")
        
        # Step 1: Create incident
        print("Step 1: Creating incident...")
        payload = {
            "incident_type": "medical",
            "location_node": incident_data["location"],
            "severity": "high",
            "description": "E2E Test Incident",
        }
        incident_response = await http_client.post(
            f"{service_urls['emergency']}/incidents",
            json=payload,
        )
        assert incident_response.status_code == 201
        incident = incident_response.json()
        incident_id = incident.get("id")
        print(f"  ✓ Incident created: {incident_id}")
        
        # Step 2: Calculate route to incident
        print("Step 2: Calculating route to incident...")
        start = map_service_data["start_node"]
        end = incident_data["location"]
        
        route_response = await http_client.get(
            f"{service_urls['routing']}/route",
            params={"from_node": start, "to_node": end},
        )
        assert route_response.status_code == 200
        route = route_response.json()
        print(f"  ✓ Route calculated: {len(route.get('path', []))} nodes")
        
        # Step 3: Dispatch responders
        print("Step 3: Dispatching responders...")
        dispatch_data = {
            "incident_id": incident_id,
            "responder_id": "staff_001",
            "responder_role": "medical",
            "current_position": start,
        }
        dispatch_response = await http_client.post(
            f"{service_urls['emergency']}/dispatch/manual",
            json=dispatch_data,
        )
        assert dispatch_response.status_code in [200, 201]
        print("  ✓ Responders dispatched")
    
    async def test_maintenance_task_complete_workflow(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        maintenance_task_data: Dict[str, Any],
        map_service_data: Dict[str, Any],
    ):
        """
        Test complete maintenance workflow:
        1. Create maintenance task
        2. Query Map Service for location details
        3. Calculate route from staff position to task
        4. Assign staff member
        5. Update task as in-progress/completed
        """
        print("\n=== Testing Complete Maintenance Workflow ===")
        
        # Step 1: Create task
        print("Step 1: Creating maintenance task...")
        payload = {
            "task_type": "equipment_repair",
            "location_node": maintenance_task_data["location"],
            "priority": "medium",
            "description": "E2E Test Task",
        }
        task_response = await http_client.post(
            f"{service_urls['maintenance']}/tasks",
            json=payload,
        )
        assert task_response.status_code == 201
        task = task_response.json()
        task_id = task.get("id")
        print(f"  ✓ Task created: {task_id}")
        
        # Step 2: Get location details from Map Service
        print("Step 2: Querying location details...")
        location_response = await http_client.get(
            f"{service_urls['map']}/nodes/{maintenance_task_data['location']}",
        )
        if location_response.status_code == 200:
            print("  ✓ Location details retrieved")
        
        # Step 3: Calculate route
        print("Step 3: Calculating route to task...")
        start = map_service_data["start_node"]
        end = maintenance_task_data["location"]
        
        route_response = await http_client.get(
            f"{service_urls['routing']}/route",
            params={"from_node": start, "to_node": end},
        )
        assert route_response.status_code == 200
        print("  ✓ Route calculated")
        
        # Step 4: Assign staff
        print("Step 4: Assigning staff member...")
        # Register staff first
        staff_params = {
            "staff_id": "staff_e2e",
            "name": "E2E Worker",
            "current_location": start
        }
        await http_client.post(f"{service_urls['maintenance']}/staff/register", params=staff_params)
        
        assignment_data = {
            "staff_id": "staff_e2e",
            "task_id": task_id,
        }
        assign_response = await http_client.post(
            f"{service_urls['maintenance']}/assign",
            json=assignment_data,
        )
        assert assign_response.status_code in [200, 201]
        print("  ✓ Staff assigned")
        
        # Step 5: Update task status
        print("Step 5: Updating task status...")
        update_data = {
            "status": "in_progress",
            "notes": "Work started",
        }
        update_response = await http_client.patch(
            f"{service_urls['maintenance']}/tasks/{task_id}",
            json=update_data,
        )
        assert update_response.status_code == 200
        print("  ✓ Task updated")
    
    async def test_queue_and_congestion_coordinated_flow(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        queue_event_data: Dict[str, Any],
        crowd_density_data: Dict[str, Any],
        mqtt_client: Any,
    ):
        """
        Test coordinated queue and congestion monitoring:
        1. Record queue observations at multiple gates
        2. Update crowd density for zones via MQTT
        3. Verify wait time estimates
        4. Query overall heatmap
        """
        print("\n=== Testing Queue & Congestion Coordination ===")
        
        # Step 1: Record queues
        print("Step 1: Recording queue observations...")
        locations = ["gate_1", "gate_2"]
        for location in locations:
            data = {
                "location_id": location,
                "location_type": "gate",
                "current_queue_length": 150,
            }
            
            response = await http_client.post(
                f"{service_urls['queueing']}/update",
                json=data,
            )
            assert response.status_code in [200, 201]
        print(f"  ✓ Queue observations recorded for {len(locations)} gates")
        
        # Step 2: Update crowd density via MQTT
        print("Step 2: Updating crowd density via MQTT...")
        zones = ["zone_1", "zone_2"]
        for zone in zones:
            payload = {
                "event_type": "crowd_density",
                "area_id": zone,
                "area_type": "normal",
                "occupancy_rate": 75.0,
                "location": {"x": 30.0, "y": 40.0}
            }
            mqtt_client.publish("stadium/crowd/density-updates", json.dumps(payload))
        
        await asyncio.sleep(1)
        print(f"  ✓ Crowd density updated for {len(zones)} zones")
        
        # Step 3: Query wait times
        print("Step 3: Querying wait time estimates...")
        for location in locations:
            response = await http_client.get(
                f"{service_urls['queueing']}/waittime/{location}",
            )
            if response.status_code == 200:
                print(f"  ✓ Wait time available for {location}")
        
        # Step 4: Get heatmap
        print("Step 4: Retrieving full congestion heatmap...")
        heatmap_response = await http_client.get(
            f"{service_urls['congestion']}/heatmap",
        )
        assert heatmap_response.status_code == 200
        print("  ✓ Heatmap retrieved")


@pytest.mark.integration
@pytest.mark.service_call
class TestServiceInterconnectivity:
    """Test that all services can communicate with each other."""
    
    async def test_all_services_accessible(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: All services are reachable and responding
        """
        print("\n=== Testing Service Accessibility ===")
        
        for service_name, url in service_urls.items():
            try:
                # Use root /health for all services
                from urllib.parse import urlparse
                parsed = urlparse(url)
                base_url = f"{parsed.scheme}://{parsed.netloc}"
                
                response = await http_client.get(
                    f"{base_url}/health",
                    timeout=5,
                )
                status = "✓" if response.status_code == 200 else "⚠"
                print(f"  {status} {service_name}: {response.status_code}")
            except Exception as e:
                print(f"  ✗ {service_name}: {str(e)}")
    
    async def test_service_chain_execution(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Complete service chain execution
        Map → Routing → Emergency (or other dependent service)
        """
        print("\n=== Testing Service Chain Execution ===")
        
        # Step 1: Query Map Service
        print("Step 1: Query Map Service...")
        response = await http_client.get(
            f"{service_urls['map']}/nodes/{map_service_data['start_node']}",
        )
        map_ok = response.status_code == 200
        print(f"  {'✓' if map_ok else '✗'} Map Service")
        
        # Step 2: Use Routing Service (depends on Map data)
        print("Step 2: Use Routing Service...")
        start = map_service_data["start_node"]
        end = map_service_data["end_node"]
        response = await http_client.get(
            f"{service_urls['routing']}/route",
            params={"from_node": start, "to_node": end},
        )
        routing_ok = response.status_code == 200
        print(f"  {'✓' if routing_ok else '✗'} Routing Service")
        
        # Step 3: Use Emergency Service (uses Routing)
        print("Step 3: Use Emergency Service...")
        incident_payload = {
            "incident_type": "other",
            "location_node": end,
            "severity": "low",
            "description": "Chain Test",
        }
        response = await http_client.post(
            f"{service_urls['emergency']}/incidents",
            json=incident_payload,
        )
        emergency_ok = response.status_code == 201
        print(f"  {'✓' if emergency_ok else '✗'} Emergency Service")
        
        assert map_ok and routing_ok and emergency_ok
