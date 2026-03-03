import pytest
from waittimes import get_alerts, wait_times_cache, get_fastest_location
from service import queue_state, remove_queue # Name corrected
from models import mm1_queue, QueueStatus

# Auxiliar para criar dados que o Pydantic (WaitTimeInfo) aceite
def create_mock_location(loc_id, loc_type, wait_time):
    return {
        "location_id": loc_id,
        "location_name": f"Name of {loc_id}", # Required
        "location_type": loc_type,
        "wait_time_minutes": wait_time,
        "status": "normal",                   # Required
        "queue_length": 10,                   # Required
        "confidence": "high",                 # Required
        "last_update": "2023-10-10 12:00:00"  # Required
    }

# ALERT LOGIC TESTS

def test_alert_severity_thresholds():
    """Validates that alerts are correctly classified by wait time"""
    wait_times_cache.clear()
    
    # Use the helper to avoid ValidationErrors
    wait_times_cache["GATE_01"] = create_mock_location("GATE_01", "gate", 15.0)
    wait_times_cache["BAR_01"] = create_mock_location("BAR_01", "bar", 7.0)
    wait_times_cache["WC_01"] = create_mock_location("WC_01", "toilet", 2.0)

    results = get_alerts(threshold_minutes=5.0)
    alerts_dict = {a["location_id"]: a["severity"] for a in results["alerts"]}
    
    assert "GATE_01" in alerts_dict
    assert alerts_dict["GATE_01"] == "critical" # > 10
    assert alerts_dict["BAR_01"] == "high"     # > 5
    assert "WC_01" not in alerts_dict

# FILTERING TESTS (Best Choices)

def test_get_fastest_location_logic():
    """Ensures the system recommends the emptiest location of the same type"""
    wait_times_cache.clear()
    
    wait_times_cache["B1"] = create_mock_location("B1", "bar", 10.0)
    wait_times_cache["B2"] = create_mock_location("B2", "bar", 2.0)
    wait_times_cache["G1"] = create_mock_location("G1", "gate", 1.0)

    # Should return B2 (fastest bar) and not G1 (a gate)
    fastest_bar = get_fastest_location("bar")
    assert fastest_bar.location_id == "B2"
    assert fastest_bar.wait_time_minutes == 2.0

# STATE ROBUSTNESS TESTS

def test_queue_state_cleanup():
    """Checks if removal of locations works via service.py function"""
    loc_id = "TEMP_GATE"
    queue_state[loc_id] = {"any": "data"}
    
    assert loc_id in queue_state
    remove_queue(loc_id) # Name corrected to match service.py
    assert loc_id not in queue_state

# MATHEMATICAL CONSISTENCY TESTS (Models)

@pytest.mark.parametrize("rho, expected_status", [
    (0.1, QueueStatus.EMPTY),
    (0.5, QueueStatus.NORMAL),
    (0.8, QueueStatus.BUSY),
    (0.95, QueueStatus.CROWDED),
    (1.1, QueueStatus.UNSTABLE),
])
def test_queue_status_mapping(rho, expected_status):
    """Ensures occupancy categories match the utilization (ρ)"""
    mu = 10.0
    lambd = rho * mu
    metrics = mm1_queue(lambd, mu)
    assert metrics.status == expected_status