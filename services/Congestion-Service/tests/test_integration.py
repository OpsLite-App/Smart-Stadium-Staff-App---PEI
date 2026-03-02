import pytest
from fastapi.testclient import TestClient
from congestion_service import app, crowd_data

# Test client
client = TestClient(app)

@pytest.fixture(autouse=True)
def clear_state():
    """Clears data between tests to ensure isolation"""
    crowd_data.clear()
    yield

### --- BASIC ENDPOINT TESTS --- ###

def test_read_health():
    """Checks that the root/health responds correctly"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "Congestion Service" 

### --- API DATA FLOW TESTS --- ###

def test_get_heatmap_empty():
    """Checks the heatmap when there is no data"""
    response = client.get("/api/heatmap")
    assert response.status_code == 200
    assert response.json()["total_areas"] == 0 

def test_get_heatmap_with_data():
    """Checks if the API exposes data inserted into the state"""
    # Manually injecting a data point into the service "state"
    crowd_data["GATE_01"] = {
        "area_id": "GATE_01",
        "area_type": "gate",
        "current_count": 50,
        "capacity": 100,
        "occupancy_rate": 50.0,
        "heat_level": "yellow",
        "status": "busy",
        "last_update": "2024-01-01T12:00:00",
        "location": {"x": 10.0, "y": 20.0}
    } 
    
    response = client.get("/api/heatmap/points")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["points"][0]["area_id"] == "GATE_01" 

def test_get_area_not_found():
    """Checks for a 404 error for non-existent areas"""
    response = client.get("/api/heatmap/NON_EXISTENT")
    assert response.status_code == 404
    assert "detail" in response.json() 

def test_get_by_type_filter():
    """Checks that the area type filter works in the API"""
    crowd_data["A"] = {"area_id": "A", "area_type": "seating", "current_count": 10, "capacity": 100, 
                       "occupancy_rate": 10, "heat_level": "green", "status": "normal", 
                       "last_update": "2024-01-01T12:00:00", "location": {"x": 1, "y": 1}}
    
    # Request a type that exists
    response = client.get("/api/heatmap/by-type/seating")
    assert response.status_code == 200
    assert len(response.json()["areas"]) == 1 
    
    # Request a type that does not exist
    response = client.get("/api/heatmap/by-type/corridor")
    assert response.status_code == 404 