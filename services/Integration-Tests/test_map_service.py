"""
Integration tests for Map Service.
Tests stadium graph data management, node/edge operations, and data integrity.
"""

import pytest
import httpx
import uuid
from typing import Dict, Any


def get_unique_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


@pytest.mark.integration
@pytest.mark.workflow
class TestMapServiceWorkflow:
    """Test map service workflows."""
    
    async def test_node_and_edge_management(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Create nodes and edges to build stadium graph
        """
        node1_id = get_unique_id("gate")
        node2_id = get_unique_id("gate")
        
        # Create nodes
        node1 = {
            "id": node1_id,
            "x": 40.7128,
            "y": -74.0060,
            "level": 0,
            "type": "gate",
        }
        
        node_response = await http_client.post(
            f"{service_urls['map']}/nodes",
            json=node1,
        )
        assert node_response.status_code in [200, 201], f"Failed to create node: {node_response.text}"
        
        # Create second node
        node2 = {
            "id": node2_id,
            "x": 40.7138,
            "y": -74.0070,
            "level": 0,
            "type": "gate",
        }
        
        await http_client.post(
            f"{service_urls['map']}/nodes",
            json=node2,
        )
        
        # Create edge between nodes
        edge_data = {
            "id": f"{node1_id}-{node2_id}",
            "from_id": node1_id,
            "to_id": node2_id,
            "weight": 150.0,
        }
        
        edge_response = await http_client.post(
            f"{service_urls['map']}/edges",
            json=edge_data,
        )
        assert edge_response.status_code in [200, 201], f"Failed to create edge: {edge_response.text}"
    
    async def test_poi_management(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Manage points of interest (medical, food, restrooms, etc.)
        """
        poi_id = get_unique_id("med")
        poi_data = {
            "id": poi_id,
            "name": "Medical Center",
            "category": "medical",
            "x": 40.7125,
            "y": -74.0065,
            "level": 0,
        }
        
        response = await http_client.post(
            f"{service_urls['map']}/pois",
            json=poi_data,
        )
        assert response.status_code in [200, 201], f"Failed to create POI: {response.text}"
        
        # Retrieve POI
        get_response = await http_client.get(
            f"{service_urls['map']}/pois/{poi_id}",
        )
        assert get_response.status_code == 200
        poi = get_response.json()
        assert poi.get("category") == "medical"
    
    async def test_seat_management(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Manage seat information
        """
        seat_id = get_unique_id("seat")
        seat_data = {
            "id": seat_id,
            "block": "A",
            "row": 5,
            "number": 12,
            "x": 10.0,
            "y": 20.0,
            "level": 0,
        }
        
        response = await http_client.post(
            f"{service_urls['map']}/seats",
            json=seat_data,
        )
        assert response.status_code in [200, 201], f"Failed to create seat: {response.text}"
    
    async def test_gate_information(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Query and manage gate information
        """
        gate_id = get_unique_id("gate")
        gate_data = {
            "id": gate_id,
            "gate_number": "1",
            "x": 40.7128,
            "y": -74.0060,
            "level": 0,
        }
        
        response = await http_client.post(
            f"{service_urls['map']}/gates",
            json=gate_data,
        )
        assert response.status_code in [200, 201], f"Failed to create gate: {response.text}"
    
    async def test_path_closures(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Mark nodes as closed
        """
        node_id = get_unique_id("node")
        # Create node first
        await http_client.post(f"{service_urls['map']}/nodes", json={
            "id": node_id, "x": 10, "y": 20, "level": 0
        })
        
        closure_id = get_unique_id("closure")
        closure_data = {
            "id": closure_id,
            "node_id": node_id,
            "reason": "maintenance",
        }
        
        response = await http_client.post(
            f"{service_urls['map']}/closures",
            json=closure_data,
        )
        assert response.status_code in [200, 201], f"Failed to create closure: {response.text}"


@pytest.mark.integration
@pytest.mark.service_call
class TestMapServiceIntegrity:
    """Test Map Service data integrity."""
    
    async def test_graph_consistency(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Graph remains consistent after operations
        """
        # Query nodes
        response = await http_client.get(
            f"{service_urls['map']}/nodes",
        )
        assert response.status_code == 200
        nodes_before = response.json()
        count_before = len(nodes_before)
        
        # Add a new node
        new_node_id = get_unique_id("integrity")
        new_node = {
            "id": new_node_id,
            "x": 40.7115,
            "y": -74.0075,
            "level": 0,
            "type": "normal",
        }
        
        await http_client.post(
            f"{service_urls['map']}/nodes",
            json=new_node,
        )
        
        # Query node count after
        response = await http_client.get(
            f"{service_urls['map']}/nodes",
        )
        assert response.status_code == 200
        nodes_after = response.json()
        assert len(nodes_after) > count_before
    
    async def test_edge_validity(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Edges reference valid nodes
        """
        node1_id = get_unique_id("valid")
        node2_id = get_unique_id("valid")
        
        # Create valid nodes first
        node1 = {"id": node1_id, "x": 10.0, "y": 20.0, "level": 0}
        node2 = {"id": node2_id, "x": 30.0, "y": 40.0, "level": 0}
        
        await http_client.post(f"{service_urls['map']}/nodes", json=node1)
        await http_client.post(f"{service_urls['map']}/nodes", json=node2)
        
        # Create valid edge
        edge_id = get_unique_id("edge")
        edge = {
            "id": edge_id,
            "from_id": node1_id,
            "to_id": node2_id,
            "weight": 100.0,
        }
        
        response = await http_client.post(
            f"{service_urls['map']}/edges",
            json=edge,
        )
        assert response.status_code in [200, 201]
