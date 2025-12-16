"""
Test configuration and fixtures
"""
import pytest
from fastapi.testclient import TestClient
from congestion_service import app
import json


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_global_state():
    """
    Reset global state before each test
    This ensures tests don't interfere with each other
    """
    from congestion_service import crowd_data, historical_data
    crowd_data.clear()
    historical_data.clear()
    
    test_data = {
        "SECTOR_A": {
            "area_id": "SECTOR_A",
            "area_type": "seating",
            "current_count": 45,
            "capacity": 100,
            "occupancy_rate": 45.0,
            "heat_level": "green",
            "status": "normal",
            "last_update": "2024-01-15T10:30:00"
        },
        "SECTOR_B": {
            "area_id": "SECTOR_B",
            "area_type": "seating",
            "current_count": 85,
            "capacity": 100,
            "occupancy_rate": 85.0,
            "heat_level": "red",
            "status": "crowded",
            "last_update": "2024-01-15T10:30:00"
        },
        "CORRIDOR_1": {
            "area_id": "CORRIDOR_1",
            "area_type": "corridor",
            "current_count": 120,
            "capacity": 200,
            "occupancy_rate": 60.0,
            "heat_level": "yellow",
            "status": "busy",
            "last_update": "2024-01-15T10:30:00"
        }
    }
    
    for area_id, data in test_data.items():
        crowd_data[area_id] = data
        historical_data[area_id] = [
            {"timestamp": "2024-01-15T10:20:00", "occupancy_rate": data["occupancy_rate"] - 10},
            {"timestamp": "2024-01-15T10:30:00", "occupancy_rate": data["occupancy_rate"]}
        ]
    
    yield
    
    # Cleanup after test
    crowd_data.clear()
    historical_data.clear()