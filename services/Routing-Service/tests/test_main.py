"""
Integration tests for the main FastAPI application
"""
import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import patch, AsyncMock, MagicMock


def test_root_endpoint(client):
    """Test the root health endpoint"""
    print("Testing root endpoint...")
    
    response = client.get("/")
    data = response.json()
    
    print(f"Root response: {data}")
    assert response.status_code == 200
    assert "service" in data
    assert "status" in data
    
    print("Root endpoint test passed")


def test_health_endpoint(client):
    """Test the health check endpoint"""
    print("\nTesting health endpoint...")
    
    response = client.get("/health")
    data = response.json()
    
    print(f"Health response: {data}")
    assert response.status_code == 200
    
    print("Health endpoint test passed")


def test_reload_endpoint(client):
    """Test the reload endpoint"""
    print("\nTesting reload endpoint...")
    
    response = client.post("/api/reload")
    data = response.json()
    
    print(f"Reload response: {data}")
    assert response.status_code == 200
    assert "status" in data
    assert data["status"] == "success"
    
    print("Reload endpoint test passed")


def test_route_endpoint(client):
    """Test the route calculation endpoint"""
    print("\nTesting route endpoint...")
    
    response = client.get("/api/route", params={
        "from_node": "N1",
        "to_node": "N10"
    })
    
    print(f"Route endpoint status: {response.status_code}")
    data = response.json()
    
    print(f"Route response: {data}")
    assert "path" in data
    assert "distance" in data
    assert "eta_seconds" in data
    assert response.status_code == 200
    
    print("Route endpoint test completed")


def test_pgrouting_route_endpoint(client):
    """Test the pgRouting-backed endpoint with a mocked service."""
    print("\nTesting pgRouting endpoint...")

    mocked_service = MagicMock()
    mocked_service.get_route.return_value = {
        "start_node": 63,
        "end_node": 71,
        "path": [63, 70, 71],
        "distance": 17.98,
        "eta_seconds": 11,
        "instructions": [
            "Start on floor 2",
            "Continue through the corridor for approximately 8 meters",
            "Use the stairs to go to floor 1",
            "You have arrived at your destination"
        ]
    }

    with patch("main.get_pgrouting_service", return_value=mocked_service):
        response = client.get("/api/route/pgrouting", params={
            "from_node": 63,
            "to_node": 71
        })

    data = response.json()
    print(f"pgRouting response: {data}")

    assert response.status_code == 200
    assert data["start_node"] == 63
    assert data["end_node"] == 71
    assert data["path"] == [63, 70, 71]
    assert "instructions" in data
    mocked_service.get_route.assert_called_once_with(63, 71)


def test_pois_endpoint(client):
    """Test the POIs endpoint with a mocked pgRouting service."""
    print("\nTesting POIs endpoint...")

    mocked_service = MagicMock()
    mocked_service.list_pois.return_value = [
        {
            "id": 33,
            "name": "Entrada",
            "node_id": 65,
            "floor_id": 2,
            "category": "entrance"
        }
    ]

    with patch("main.get_pgrouting_service", return_value=mocked_service):
        response = client.get("/api/pois")

    data = response.json()
    print(f"POIs response: {data}")

    assert response.status_code == 200
    assert len(data) == 1
    assert data[0]["id"] == 33
    assert data[0]["node_id"] == 65
    mocked_service.list_pois.assert_called_once_with()


def test_pgrouting_route_by_poi_endpoint(client):
    """Test the POI-based pgRouting endpoint with a mocked service."""
    print("\nTesting pgRouting by POI endpoint...")

    mocked_service = MagicMock()
    mocked_service.get_route_by_poi.return_value = {
        "start_node": 65,
        "end_node": 90,
        "path": [65, 70, 71, 90],
        "distance": 24.1,
        "eta_seconds": 16,
        "instructions": [
            "Start on floor 2",
            "Continue through the corridor for approximately 12 meters",
            "Use the stairs to go to floor 1",
            "You have arrived at your destination"
        ]
    }

    with patch("main.get_pgrouting_service", return_value=mocked_service):
        response = client.get("/api/route/pgrouting/by-poi", params={
            "from_poi_id": 33,
            "to_poi_id": 40
        })

    data = response.json()
    print(f"pgRouting by POI response: {data}")

    assert response.status_code == 200
    assert data["start_node"] == 65
    assert data["end_node"] == 90
    assert "instructions" in data
    mocked_service.get_route_by_poi.assert_called_once_with(33, 40)


def test_graph_status_endpoint(client):
    """Test the graph status endpoint with a mocked service."""
    print("\nTesting graph status endpoint...")

    mocked_service = MagicMock()
    mocked_service.get_graph_status.return_value = {
        "status": "healthy",
        "nodes": 142,
        "edges": 143,
        "floors": 2,
        "pois": 66,
        "blocked_edges": 0,
        "cost_overrides": 0,
        "active_alerts": 0,
        "updated_at": "2026-04-13T19:10:00+00:00"
    }

    with patch("main.get_pgrouting_service", return_value=mocked_service):
        response = client.get("/api/graph/status")

    data = response.json()
    print(f"Graph status response: {data}")

    assert response.status_code == 200
    assert data["status"] == "healthy"
    assert data["nodes"] == 142
    assert data["edges"] == 143
    mocked_service.get_graph_status.assert_called_once_with()


def test_list_edge_overrides_endpoint(client):
    """Test listing edge overrides with a mocked service."""
    print("\nTesting edge overrides list endpoint...")

    mocked_service = MagicMock()
    mocked_service.list_edge_overrides.return_value = [
        {
            "id": 1,
            "edge_id": 52,
            "is_blocked": True,
            "cost_multiplier": 1.0,
            "reason": "Maintenance",
            "source": "manual",
            "severity": 0.7,
            "starts_at": None,
            "ends_at": None,
            "is_active": True
        }
    ]

    with patch("main.get_pgrouting_service", return_value=mocked_service):
        response = client.get("/api/graph/edge-overrides")

    data = response.json()
    print(f"Edge overrides response: {data}")

    assert response.status_code == 200
    assert len(data) == 1
    assert data[0]["edge_id"] == 52
    mocked_service.list_edge_overrides.assert_called_once_with()


def test_create_edge_override_endpoint(client):
    """Test creating an edge override with a mocked service."""
    print("\nTesting edge override creation endpoint...")

    payload = {
        "edge_id": 52,
        "is_blocked": False,
        "cost_multiplier": 2.5,
        "reason": "Congestion",
        "source": "manual",
        "severity": 0.6,
        "starts_at": None,
        "ends_at": None,
        "is_active": True
    }

    mocked_service = MagicMock()
    mocked_service.create_edge_override.return_value = {"id": 2, **payload}

    with patch("main.get_pgrouting_service", return_value=mocked_service):
        response = client.post("/api/graph/edge-overrides", json=payload)

    data = response.json()
    print(f"Create edge override response: {data}")

    assert response.status_code == 200
    assert data["cost_multiplier"] == 2.5
    mocked_service.create_edge_override.assert_called_once()


def test_list_operational_events_endpoint(client):
    """Test listing operational events with a mocked service."""
    print("\nTesting operational events list endpoint...")

    mocked_service = MagicMock()
    mocked_service.list_operational_events.return_value = [
        {
            "id": 1,
            "event_type": "hazard",
            "title": "Smoke reported",
            "description": "Temporary alert on floor 2",
            "severity": 0.9,
            "status": "active",
            "source": "manual",
            "floor_id": 2,
            "edge_id": 52,
            "poi_id": None,
            "starts_at": None,
            "ends_at": None,
            "is_active": True
        }
    ]

    with patch("main.get_pgrouting_service", return_value=mocked_service):
        response = client.get("/api/graph/events")

    data = response.json()
    print(f"Operational events response: {data}")

    assert response.status_code == 200
    assert len(data) == 1
    assert data[0]["event_type"] == "hazard"
    mocked_service.list_operational_events.assert_called_once_with()


def test_create_operational_event_endpoint(client):
    """Test creating an operational event with a mocked service."""
    print("\nTesting operational event creation endpoint...")

    payload = {
        "event_type": "maintenance",
        "title": "Cleaning in corridor",
        "description": "Temporary slower access",
        "severity": 0.4,
        "status": "active",
        "source": "manual",
        "floor_id": 1,
        "edge_id": 43,
        "poi_id": None,
        "starts_at": None,
        "ends_at": None
    }

    mocked_service = MagicMock()
    mocked_service.create_operational_event.return_value = {**payload, "id": 2, "is_active": True}

    with patch("main.get_pgrouting_service", return_value=mocked_service):
        response = client.post("/api/graph/events", json=payload)

    data = response.json()
    print(f"Create operational event response: {data}")

    assert response.status_code == 200
    assert data["event_type"] == "maintenance"
    mocked_service.create_operational_event.assert_called_once()


def test_hazard_endpoints(client):
    """Test hazard management endpoints"""
    print("\nTesting hazard endpoints...")
    
    # Test adding closure
    response = client.post("/api/hazards/closure", params={
        "from_node": "N1",
        "to_node": "N2"
    })
    
    assert response.status_code == 200
    data = response.json()
    print(f"Add closure response: {data}")
    assert "message" in data
    assert data["message"] == "Closure added"
    
    # Test hazard update
    response = client.post("/api/hazards/update", params={
        "node_id": "N5",
        "hazard_type": "smoke",
        "severity": 0.5
    })
    
    assert response.status_code == 200
    data = response.json()
    print(f"Update hazard response: {data}")
    
    # Test hazard status
    response = client.get("/api/hazards/status")
    
    assert response.status_code == 200
    data = response.json()
    print(f"Hazard status: {data}")
    assert "closures" in data
    assert "node_hazards" in data
    assert "edge_hazards" in data
    
    print("Hazard endpoint tests completed")


def test_evacuation_endpoint(client):
    """Test evacuation route endpoint"""
    print("\nTesting evacuation endpoint...")
    
    response = client.get("/api/route/evacuation", params={
        "from_node": "N15"
    })
    
    print(f"Evacuation endpoint status: {response.status_code}")
    
    assert response.status_code == 200
    data = response.json()
    print(f"Evacuation response: {data}")
    
    print("Evacuation endpoint test completed")
