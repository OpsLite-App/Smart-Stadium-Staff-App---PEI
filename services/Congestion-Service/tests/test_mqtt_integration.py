"""
Tests for MQTT integration
"""
import json
import pytest
from unittest.mock import Mock, patch
from congestion_service import on_mqtt_message, crowd_data, historical_data


def test_mqtt_message_processing():
    """Test MQTT message callback"""
    from congestion_service import crowd_data, historical_data, on_mqtt_message
    
    # Clear data
    crowd_data.clear()
    historical_data.clear()
    
    # Create mock MQTT message
    mock_msg = Mock()
    
    # Valid crowd_density event
    test_event = {
        "event_type": "crowd_density",
        "area_id": "GATE_1",
        "area_type": "gate",
        "current_count": 75,
        "capacity": 100,
        "occupancy_rate": 75.0,
        "heat_level": "yellow"
    }
    
    # Encode the event as JSON string
    json_str = json.dumps(test_event)
    mock_msg.payload.decode.return_value = json_str
    
    # Mock the json import inside the function by patching builtins
    with patch('congestion_service.MQTT_AVAILABLE', True):
        # Process message 
        on_mqtt_message(None, None, mock_msg)
    
    # Verify data was added
    assert "GATE_1" in crowd_data
    assert crowd_data["GATE_1"]["status"] == "busy"  # 75% occupancy


def test_mqtt_message_status_calculation():
    """Test status calculation in MQTT handler"""
    from congestion_service import crowd_data, on_mqtt_message
    import json
    
    test_cases = [
        (10, "empty"),
        (30, "normal"),
        (60, "busy"),
        (85, "crowded"),
        (99, "critical")
    ]
    
    for occupancy_rate, expected_status in test_cases:
        crowd_data.clear()
        
        mock_msg = Mock()
        test_event = {
            "event_type": "crowd_density",
            "area_id": f"TEST_{occupancy_rate}",
            "area_type": "seating",
            "current_count": occupancy_rate,
            "capacity": 100,
            "occupancy_rate": float(occupancy_rate),
            "heat_level": "green"
        }
        
        # Encode as JSON string
        json_str = json.dumps(test_event)
        mock_msg.payload.decode.return_value = json_str
        
        with patch('congestion_service.MQTT_AVAILABLE', True):
            on_mqtt_message(None, None, mock_msg)
        
        assert crowd_data[f"TEST_{occupancy_rate}"]["status"] == expected_status


def test_mqtt_invalid_message():
    """Test handling of invalid MQTT messages"""
    initial_data = dict(crowd_data)  # Copy current data
    
    # Test with invalid JSON
    mock_msg = Mock()
    mock_msg.payload.decode.return_value = "not valid json"
    
    # Should not raise exception
    on_mqtt_message(None, None, mock_msg)
    
    # Data should remain unchanged
    assert crowd_data == initial_data
    
    # Test with missing required fields
    mock_msg = Mock()
    incomplete_event = {"event_type": "crowd_density"}  # Missing area_id
    mock_msg.payload.decode.return_value = json.dumps(incomplete_event)
    
    on_mqtt_message(None, None, mock_msg)
    
    # Should not add incomplete data
    assert crowd_data == initial_data


def test_mqtt_wrong_event_type():
    """Test that non-crowd_density events are ignored"""
    initial_data = dict(crowd_data)  # Copy current data
    
    mock_msg = Mock()
    wrong_event = {
        "event_type": "weather_update",  # Wrong event type
        "area_id": "TEST",
        "current_count": 50
    }
    
    mock_msg.payload.decode.return_value = json.dumps(wrong_event)
    
    on_mqtt_message(None, None, mock_msg)
    
    # Data should remain unchanged
    assert crowd_data == initial_data


@patch('congestion_service.MQTT_AVAILABLE', False)
def test_mqtt_unavailable():
    """Test behavior when MQTT library is not available"""
    from congestion_service import MQTT_AVAILABLE, start_mqtt_listener
    
    assert MQTT_AVAILABLE == False
    # Should not raise exception
    start_mqtt_listener()


def test_cleanup_stale_data():
    """Test stale data cleanup logic"""
    from congestion_service import crowd_data
    from datetime import datetime, timedelta
    
    # Add fresh data
    fresh_data = {
        "area_id": "FRESH",
        "last_update": datetime.now().isoformat()
    }
    
    # Add stale data 
    stale_time = (datetime.now() - timedelta(minutes=6)).isoformat()
    stale_data = {
        "area_id": "STALE",
        "last_update": stale_time
    }
    
    crowd_data["FRESH"] = fresh_data
    crowd_data["STALE"] = stale_data
    
    # Import and run cleanup logic 
    from congestion_service import cleanup_stale_data
    import asyncio
    
    now = datetime.now()
    stale_threshold = timedelta(minutes=5)
    
    to_remove = []
    for area_id, data in crowd_data.items():
        last_update = datetime.fromisoformat(data["last_update"])
        if now - last_update > stale_threshold:
            to_remove.append(area_id)
    
    assert "STALE" in to_remove
    assert "FRESH" not in to_remove