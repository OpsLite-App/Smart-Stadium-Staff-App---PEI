"""
Integration tests for Routing Service workflow.
Tests pathfinding, multi-destination routing, and integration with the
PostGIS/pgRouting indoor graph.
"""

import pytest
import httpx
import asyncio
from typing import Dict, Any


@pytest.mark.integration
@pytest.mark.workflow
class TestRoutingWorkflow:
    """Test routing service workflows."""
    
    async def test_single_route_calculation(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Calculate route between two nodes using A* algorithm
        """
        start = map_service_data["start_node"]
        end = map_service_data["end_node"]
        
        response = await http_client.get(
            f"{service_urls['routing']}/route",
            params={"from_node": start, "to_node": end},
        )
        assert response.status_code == 200, f"Route calculation failed: {response.text}"
        route = response.json()
        
        # Verify route has expected fields
        assert "path" in route, "Route missing path"
        assert "distance" in route, "Route missing distance"
    
    async def test_multi_destination_routing(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Calculate optimal route visiting multiple destinations (TSP-like)
        """
        # Routing Service expects Query parameters for multi-destination
        params = [
            ("from_node", map_service_data["start_node"]),
            ("to_nodes", map_service_data["intermediate_node"]),
            ("to_nodes", map_service_data["end_node"]),
        ]
        
        response = await http_client.post(
            f"{service_urls['routing']}/route/multi",
            params=params,
        )
        assert response.status_code == 200, f"Multi-destination routing failed: {response.text}"
        route = response.json()
        assert "path" in route
    
    async def test_nearest_node_search(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Find nearest node from candidates
        """
        # Routing Service expects Query parameters for nearest
        params = [
            ("target", map_service_data["start_node"]),
            ("candidates", map_service_data["intermediate_node"]),
            ("candidates", map_service_data["end_node"]),
        ]
        
        response = await http_client.post(
            f"{service_urls['routing']}/route/nearest",
            params=params,
        )
        assert response.status_code == 200, f"Nearest node search failed: {response.text}"
        result = response.json()
        assert "path" in result
    
    async def test_hazard_aware_routing(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Route calculation avoids hazardous areas
        """
        start = map_service_data["start_node"]
        end = map_service_data["end_node"]
        
        response = await http_client.get(
            f"{service_urls['routing']}/route",
            params={"from_node": start, "to_node": end, "avoid_crowds": True},
        )
        assert response.status_code == 200, f"Hazard-aware routing failed: {response.text}"


@pytest.mark.integration
@pytest.mark.service_call
class TestRoutingServiceIntegration:
    """Test Routing Service integration with PostGIS/pgRouting."""
    
    async def test_routing_uses_map_service_graph(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Routing Service correctly uses the graph loaded from PostGIS
        """
        start = map_service_data["start_node"]
        end = map_service_data["end_node"]
        
        response = await http_client.get(
            f"{service_urls['routing']}/route",
            params={"from_node": start, "to_node": end},
        )
        assert response.status_code == 200
        route = response.json()
        
        # Verify route contains nodes
        path = route.get("path", [])
        assert len(path) > 0, "Route should have at least some nodes"
    
    async def test_concurrent_route_requests(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Handle multiple concurrent route requests
        """
        start = map_service_data["start_node"]
        end = map_service_data["end_node"]
        
        # Send multiple concurrent requests
        tasks = []
        for _ in range(5):
            tasks.append(
                http_client.get(
                    f"{service_urls['routing']}/route",
                    params={"from_node": start, "to_node": end},
                )
            )
        
        # Verify all succeed
        responses = await asyncio.gather(*tasks)
        for response in responses:
            assert response.status_code == 200
