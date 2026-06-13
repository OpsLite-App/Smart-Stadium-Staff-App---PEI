"""
Integration tests for Maintenance Service workflow.
Tests task management, bin alerts, and assignment logic.
"""

import pytest
import httpx
from typing import Dict, Any


@pytest.mark.integration
@pytest.mark.workflow
class TestMaintenanceTaskWorkflow:
    """Test maintenance service workflows."""
    
    async def test_task_creation_and_assignment(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        maintenance_task_data: Dict[str, Any],
    ):
        """
        Test: Create task → Maintenance Service validates → Assign to staff
        """
        # Map maintenance_task_data to TaskCreate schema
        payload = {
            "task_type": "equipment_repair",
            "location_node": maintenance_task_data["location"],
            "priority": maintenance_task_data["priority"],
            "description": maintenance_task_data["description"],
            "estimated_duration_min": maintenance_task_data["estimated_duration"],
        }
        
        # Create task
        response = await http_client.post(
            f"{service_urls['maintenance']}/tasks",
            json=payload,
        )
        assert response.status_code == 201, f"Failed to create task: {response.text}"
        task = response.json()
        task_id = task.get("id")
        assert task_id is not None, "Task ID not returned"
        
        # Register a staff member first (Uses Query parameters)
        params = {
            "staff_id": "staff_001",
            "name": "John Doe",
            "role": "maintenance",
            "current_location": "gate_1",
        }
        await http_client.post(
            f"{service_urls['maintenance']}/staff/register",
            params=params,
        )
        
        # Assign task to staff (Uses JSON body)
        assign_data = {
            "task_id": task_id,
            "staff_id": "staff_001",
            "calculate_route": True,
        }
        
        response = await http_client.post(
            f"{service_urls['maintenance']}/assign",
            json=assign_data,
        )
        assert response.status_code in [200, 201], f"Assignment failed: {response.text}"
    
    async def test_bin_alert_to_task_creation(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Bin full alert → Automatic task creation
        """
        alert_data = {
            "bin_id": "BIN-A1",
            "location_node": "gate_1",
            "fill_percentage": 95,
            "priority": "high",
        }
        
        response = await http_client.post(
            f"{service_urls['maintenance']}/bins/alert",
            json=alert_data,
        )
        assert response.status_code in [200, 201], f"Bin alert failed: {response.text}"
    
    async def test_task_update(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        maintenance_task_data: Dict[str, Any],
    ):
        """
        Test: Update task status and priority
        """
        # Create task
        payload = {
            "task_type": "general_cleaning",
            "location_node": "gate_1",
            "priority": "low",
        }
        response = await http_client.post(
            f"{service_urls['maintenance']}/tasks",
            json=payload,
        )
        assert response.status_code == 201
        task_id = response.json()["id"]
        
        # Update task
        update_data = {
            "status": "in_progress",
            "priority": "high",
            "notes": "Moving quickly",
        }
        
        response = await http_client.patch(
            f"{service_urls['maintenance']}/tasks/{task_id}",
            json=update_data,
        )
        assert response.status_code == 200
        updated_task = response.json()
        assert updated_task["status"] == "in_progress"
        assert updated_task["priority"] == "high"


@pytest.mark.integration
@pytest.mark.service_call
class TestMaintenanceServiceIntegration:
    """Test Maintenance Service integration with other services."""
    
    async def test_task_routing_integration(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Maintenance Service uses Routing Service for assignment
        """
        # Create task
        payload = {
            "task_type": "equipment_repair",
            "location_node": map_service_data["end_node"],
            "priority": "medium",
        }
        task_response = await http_client.post(
            f"{service_urls['maintenance']}/tasks",
            json=payload,
        )
        assert task_response.status_code == 201
        task_id = task_response.json()["id"]
        
        # Register staff at start node
        staff_params = {
            "staff_id": "staff_routing_test",
            "name": "Jane Doe",
            "current_location": map_service_data["start_node"],
        }
        await http_client.post(f"{service_urls['maintenance']}/staff/register", params=staff_params)
        
        # Assign (this should trigger Routing Service internally)
        assign_data = {
            "task_id": task_id,
            "staff_id": "staff_routing_test",
            "calculate_route": True,
        }
        
        response = await http_client.post(
            f"{service_urls['maintenance']}/assign",
            json=assign_data,
        )
        assert response.status_code in [200, 201]
        data = response.json()
        assert "route_nodes" in data or "path" in data
    
    async def test_multiple_task_assignment(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Multiple tasks assigned to same staff member
        """
        # Create tasks
        task_ids = []
        for i in range(2):
            payload = {
                "task_type": "general_cleaning",
                "location_node": f"gate_{i+1}",
                "priority": "low",
            }
            resp = await http_client.post(f"{service_urls['maintenance']}/tasks", json=payload)
            assert resp.status_code == 201
            task_ids.append(resp.json()["id"])
        
        # Register staff
        staff_id = "staff_multi_test"
        params = {
            "staff_id": staff_id,
            "name": "Multi Tasker",
            "current_location": "zone_1"
        }
        await http_client.post(f"{service_urls['maintenance']}/staff/register", params=params)
        
        # Assign both
        for tid in task_ids:
            await http_client.post(f"{service_urls['maintenance']}/assign", json={
                "task_id": tid, "staff_id": staff_id
            })
            
        # Verify staff has multiple tasks
        response = await http_client.get(f"{service_urls['maintenance']}/staff/{staff_id}/tasks")
        assert response.status_code == 200
        data = response.json()
        assert data["total_tasks"] >= 2
    
    async def test_routing_graph_status_query(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Routing graph is available for maintenance location workflows
        """
        response = await http_client.get(f"{service_urls['routing']}/graph/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
