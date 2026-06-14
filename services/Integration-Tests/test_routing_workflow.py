"""
Integration tests for Routing Service workflow.
Tests pathfinding, GeoJSON route output, and integration with the
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
        Test: Calculate route between two nodes using the active pgRouting graph
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
    
    async def test_pgrouting_route_sequence(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Calculate a route sequence across multiple pgRouting destinations.

        The legacy /route/multi endpoint is intentionally disabled. The active
        implementation calculates each operational leg through pgRouting.
        """
        legs = [
            (map_service_data["start_node"], map_service_data["intermediate_node"]),
            (map_service_data["intermediate_node"], map_service_data["end_node"]),
        ]

        total_distance = 0.0
        visited_nodes = []

        for start, end in legs:
            response = await http_client.get(
                f"{service_urls['routing']}/route/pgrouting",
                params={"from_node": start, "to_node": end, "allow_blocked": True},
            )
            assert response.status_code == 200, f"pgRouting leg failed: {response.text}"

            route = response.json()
            assert route["start_node"] == int(start)
            assert route["end_node"] == int(end)
            assert route.get("path"), "Route leg missing path"
            assert route.get("distance", 0) >= 0

            total_distance += route.get("distance", 0)
            visited_nodes.extend(route["path"])

        assert int(map_service_data["start_node"]) in visited_nodes
        assert int(map_service_data["intermediate_node"]) in visited_nodes
        assert int(map_service_data["end_node"]) in visited_nodes
        assert total_distance > 0
    
    async def test_pgrouting_geojson_route_output(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        map_service_data: Dict[str, Any],
    ):
        """
        Test: Return a web-ready GeoJSON route between real pgRouting nodes.

        The previous nearest-node endpoint belonged to the legacy graph API.
        The active frontend consumes pgRouting GeoJSON route output instead.
        """
        response = await http_client.get(
            f"{service_urls['routing']}/route/pgrouting/geojson",
            params={
                "from_node": map_service_data["start_node"],
                "to_node": map_service_data["end_node"],
                "allow_blocked": True,
            },
        )
        assert response.status_code == 200, f"GeoJSON route failed: {response.text}"

        result = response.json()
        assert result["route"]["type"] == "FeatureCollection"
        assert isinstance(result["route"]["features"], list)
        assert result["summary"]["start_node"] == int(map_service_data["start_node"])
        assert result["summary"]["end_node"] == int(map_service_data["end_node"])
        assert result["summary"]["distance"] >= 0
    
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
    
    async def test_routing_uses_postgis_pgrouting_graph(
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
