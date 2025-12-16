"""
Integration tests for the main FastAPI application
"""
import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import patch, AsyncMock


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