import pytest
from datetime import datetime
from congestion_service import (
    on_mqtt_message, 
    crowd_data, 
    historical_data, 
    MAX_HISTORY
)

# Mock of an MQTT message (object that paho-mqtt would send)
class MockMsg:
    def __init__(self, topic, payload):
        self.topic = topic
        self.payload = payload.encode('utf-8')

@pytest.fixture(autouse=True)
def run_before_and_after_tests():
    """Clears global data before each test to prevent contamination"""
    crowd_data.clear()
    historical_data.clear()
    yield

### --- OCCUPANCY LOGIC TESTS (UNIT) --- ###

def test_on_mqtt_message_status_calculation():
    """Validates that the status (empty, normal, busy, etc) is calculated correctly"""
    # Scenario: Area with 96% occupancy (should be 'critical')
    payload = '{"event_type": "crowd_density", "area_id": "ZONE_01", "occupancy_rate": 96, "location": {"x": 10, "y": 20}}'
    msg = MockMsg("stadium/crowd/density-updates", payload)
    
    on_mqtt_message(None, None, msg)
    
    assert "ZONE_01" in crowd_data
    assert crowd_data["ZONE_01"]["status"] == "critical"
    assert crowd_data["ZONE_01"]["heat_level"] == "green" 

def test_on_mqtt_message_missing_location():
    """Ensures that areas without x or y coordinates are ignored"""
    payload = '{"event_type": "crowd_density", "area_id": "ZONE_ERR", "occupancy_rate": 50, "location": {"x": null}}'
    msg = MockMsg("stadium/crowd/density-updates", payload)
    
    on_mqtt_message(None, None, msg)
    
    assert "ZONE_ERR" not in crowd_data

### --- HISTORY AND TRENDS TESTS --- ###

def test_history_limit():
    """Checks that the history respects the maximum limit of 100 records"""
    area_id = "ZONE_HIST"
    # Simulate 105 insertions
    for i in range(105):
        payload = f'{{"event_type": "crowd_density", "area_id": "{area_id}", "occupancy_rate": {i}, "location": {{"x": 1, "y": 1}}}}'
        msg = MockMsg("stadium/crowd/density-updates", payload)
        on_mqtt_message(None, None, msg)
    
    assert len(historical_data[area_id]) == MAX_HISTORY
    # The first element should be the 6th insertion (index 5), since the first 5 were removed
    assert historical_data[area_id][0]["occupancy_rate"] == 5

### --- DATA STRUCTURE TESTS --- ###

def test_data_integrity():
    """Verifies that all necessary fields are stored in the dictionary"""
    payload = '{"event_type": "crowd_density", "area_id": "A1", "capacity": 500, "occupancy_rate": 10, "location": {"x": 40.1, "y": -8.2}}'
    msg = MockMsg("topic", payload)
    
    on_mqtt_message(None, None, msg)
    
    data = crowd_data["A1"]
    assert "last_update" in data
    assert data["location"]["x"] == 40.1
    assert data["area_id"] == "A1"