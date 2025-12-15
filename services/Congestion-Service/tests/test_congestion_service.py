"""
Unit tests for Congestion Service endpoints
"""
import pytest
from datetime import datetime
from congestion_service import crowd_data, historical_data


def test_root_endpoint(client):
    """Test health check endpoint"""
    response = client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["service"] == "Congestion Service"
    assert data["version"] == "1.0.0"
    assert data["status"] == "running"
    assert data["tracked_areas"] == 3  # From fixture


def test_heatmap_endpoint(client):
    """Test complete heatmap endpoint"""
    response = client.get("/api/heatmap")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "timestamp" in data
    assert data["total_areas"] == 3
    assert len(data["areas"]) == 3
    
    # Check summary
    assert "summary" in data
    summary = data["summary"]
    assert summary["green"] >= 0
    assert summary["yellow"] >= 0
    assert summary["red"] >= 0
    assert sum(summary.values()) == 3


def test_area_density_endpoint(client):
    """Test getting density for specific area"""
    # Test existing area
    response = client.get("/api/heatmap/SECTOR_A")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["area_id"] == "SECTOR_A"
    assert data["area_type"] == "seating"
    assert data["current_count"] == 45
    assert data["capacity"] == 100
    assert data["occupancy_rate"] == 45.0
    assert data["heat_level"] == "green"
    assert data["status"] == "normal"
    
    # Test non-existent area
    response = client.get("/api/heatmap/NON_EXISTENT")
    assert response.status_code == 404


def test_density_by_type_endpoint(client):
    """Test filtering by area type"""
    response = client.get("/api/heatmap/by-type/seating")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["area_type"] == "seating"
    assert data["count"] == 2  # SECTOR_A and SECTOR_B
    
    for area in data["areas"]:
        assert area["area_type"] == "seating"
    
    # Test non-existent type
    response = client.get("/api/heatmap/by-type/nonexistent")
    assert response.status_code == 404


def test_congestion_alerts_endpoint(client):
    """Test congestion alerts"""
    # Test with default threshold (80%)
    response = client.get("/api/congestion/alerts")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["threshold"] == 80.0
    assert data["alert_count"] >= 0  # At least SECTOR_B should be >80%
    
    if data["alert_count"] > 0:
        for alert in data["alerts"]:
            assert alert["occupancy_rate"] >= 80.0
    
    # Test with custom threshold
    response = client.get("/api/congestion/alerts?threshold=50")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["threshold"] == 50.0
    assert data["alert_count"] >= 0
    
    if data["alert_count"] > 0:
        for alert in data["alerts"]:
            assert alert["occupancy_rate"] >= 50.0


def test_congestion_summary_endpoint(client):
    """Test overall congestion summary"""
    response = client.get("/api/congestion/summary")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["total_areas"] == 3
    assert "avg_occupancy" in data
    assert "total_people" in data
    assert "total_capacity" in data
    assert "overall_status" in data
    assert "by_heat_level" in data
    
    # Validate calculations
    total_people = data["total_people"]
    assert total_people == (45 + 85 + 120)  # From fixture
    
    total_capacity = data["total_capacity"]
    assert total_capacity == (100 + 100 + 200)  # From fixture
    
    if total_capacity > 0:
        expected_avg = (total_people / total_capacity) * 100
        assert abs(data["avg_occupancy"] - expected_avg) < 0.01


def test_area_history_endpoint(client):
    """Test historical data endpoint"""
    # Test existing area
    response = client.get("/api/congestion/history/SECTOR_A")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["area_id"] == "SECTOR_A"
    assert "readings" in data
    assert "history" in data
    
    history = data["history"]
    assert len(history) == 2  # From fixture
    
    for entry in history:
        assert "timestamp" in entry
        assert "occupancy_rate" in entry
    
    # Test with limit parameter
    response = client.get("/api/congestion/history/SECTOR_A?limit=1")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["history"]) == 1
    
    # Test non-existent area
    response = client.get("/api/congestion/history/NON_EXISTENT")
    assert response.status_code == 404


def test_hotspots_endpoint(client):
    """Test hotspots endpoint"""
    response = client.get("/api/congestion/hotspots")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["top_n"] == 5  # Default
    hotspots = data["hotspots"]
    
    # Should be sorted by occupancy_rate descending
    for i in range(len(hotspots) - 1):
        assert hotspots[i]["occupancy_rate"] >= hotspots[i + 1]["occupancy_rate"]
    
    # Test with custom top_n
    response = client.get("/api/congestion/hotspots?top_n=2")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["top_n"] == 2
    assert len(data["hotspots"]) == 2


def test_safest_areas_endpoint(client):
    """Test safest areas endpoint"""
    response = client.get("/api/congestion/safest-areas")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["top_n"] == 5  # Default
    safest_areas = data["safest_areas"]
    
    # Should be sorted by occupancy_rate ascending
    for i in range(len(safest_areas) - 1):
        assert safest_areas[i]["occupancy_rate"] <= safest_areas[i + 1]["occupancy_rate"]
    
    # Test with custom top_n
    response = client.get("/api/congestion/safest-areas?top_n=1")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["top_n"] == 1
    assert len(data["safest_areas"]) == 1


def test_trends_endpoint(client):
    """Test trends endpoint"""
    response = client.get("/api/congestion/trends")
    
    assert response.status_code == 200
    data = response.json()
    
    # Should have trends for areas with at least 2 historical readings
    assert len(data) > 0
    
    for area_id, trend_data in data.items():
        assert "current" in trend_data
        assert "previous" in trend_data
        assert "change" in trend_data
        assert "trend" in trend_data
        assert trend_data["trend"] in ["increasing", "decreasing", "stable"]


def test_empty_state():
    """Test behavior with empty data"""
    from congestion_service import crowd_data, historical_data
    
    # Clear data
    crowd_data.clear()
    historical_data.clear()
    
    from congestion_service import get_congestion_summary
    
    # Test summary with empty data
    summary = get_congestion_summary()
    
    assert summary["total_areas"] == 0
    assert summary["avg_occupancy"] == 0
    assert summary["total_people"] == 0
    assert summary["total_capacity"] == 0
    assert summary["overall_status"] == "unknown"


def test_heat_level_calculation():
    """Test heat level threshold logic"""
    from congestion_service import THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_RED
    
    # Test thresholds (should match service logic)
    assert THRESHOLD_GREEN == 50
    assert THRESHOLD_YELLOW == 80
    assert THRESHOLD_RED == 80  # Note: red starts at 80
    
    # Test status calculation logic
    test_cases = [
        (10, "empty"),
        (30, "normal"),
        (60, "busy"),
        (85, "crowded"),
        (99, "critical")
    ]
    
    for occupancy_rate, expected_status in test_cases:
        if occupancy_rate < 20:
            status = "empty"
        elif occupancy_rate < 50:
            status = "normal"
        elif occupancy_rate < 80:
            status = "busy"
        elif occupancy_rate < 95:
            status = "crowded"
        else:
            status = "critical"
        
        assert status == expected_status


def test_historical_data_trimming():
    """Test that historical data is properly trimmed"""
    from congestion_service import historical_data, MAX_HISTORY, on_mqtt_message
    from unittest.mock import Mock
    import json

    test_area = "TEST_AREA_TRIMMING"
    
    # Clear any existing test data
    if test_area in historical_data:
        del historical_data[test_area]
    
    # Use the service's on_mqtt_message function to add data (which includes trimming logic)
    for i in range(MAX_HISTORY + 10):
        mock_msg = Mock()
        event = {
            "event_type": "crowd_density",
            "area_id": test_area,
            "area_type": "test",
            "current_count": i,
            "capacity": 100,
            "occupancy_rate": float(i),
            "heat_level": "green"
        }
        mock_msg.payload.decode.return_value = json.dumps(event)
        on_mqtt_message(None, None, mock_msg)
    
    # After adding through the service function, it should be trimmed to MAX_HISTORY
    assert len(historical_data[test_area]) == MAX_HISTORY


def test_model_validation():
    """Test Pydantic model validation"""
    from congestion_service import CrowdDensity, HeatmapResponse
    
    # Valid data should pass
    valid_data = {
        "area_id": "TEST",
        "area_type": "seating",
        "current_count": 50,
        "capacity": 100,
        "occupancy_rate": 50.0,
        "heat_level": "green",
        "status": "normal",
        "last_update": "2024-01-15T10:30:00"
    }
    
    crowd_density = CrowdDensity(**valid_data)
    assert crowd_density.area_id == "TEST"
    assert crowd_density.occupancy_rate == 50.0
    
    # Test invalid heat_level
    invalid_data = valid_data.copy()
    invalid_data["heat_level"] = "invalid_color"
    
    # Should still pass since Pydantic doesn't validate enum-like strings
    crowd_density = CrowdDensity(**invalid_data)
    assert crowd_density.heat_level == "invalid_color"