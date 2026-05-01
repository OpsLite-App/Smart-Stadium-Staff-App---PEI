import pytest
from models import Fingerprint

## --- Unit Tests for Positioning Logic ---

def test_rssi_distance_calculation():
    from positioning import _rssi_distance
    
    rssi_a = {"ap_1": -50, "ap_2": -60}
    rssi_b = {"ap_1": -55, "ap_2": -65}
    
    # Distance = sqrt((-50 - -55)^2 + (-60 - -65)^2) = sqrt(25 + 25) = ~7.07
    distance = _rssi_distance(rssi_a, rssi_b)
    assert round(distance, 2) == 7.07

def test_rssi_distance_missing_ap():
    from positioning import _rssi_distance
    
    rssi_a = {"ap_1": -50}
    rssi_b = {"ap_2": -50} # ap_1 is missing here, defaults to -100
    
    # Distance = sqrt((-50 - -100)^2 + (-100 - -50)^2) = sqrt(2500 + 2500)
    distance = _rssi_distance(rssi_a, rssi_b)
    assert distance > 70

## --- API Integration Tests ---

def test_create_fingerprint(client):
    payload = {
        "location_id": "office_1",
        "zone": "lobby",
        "x": 10.5,
        "y": 20.0,
        "rssi_map": {"ap_north": -45, "ap_south": -70}
    }
    response = client.post("/fingerprints", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["location_id"] == "office_1"
    assert "id" in data

def test_locate_staff_member(client):
    # 1. Add a reference fingerprint
    client.post("/fingerprints", json={
        "location_id": "office_1", "zone": "lobby", "x": 0, "y": 0,
        "rssi_map": {"ap_1": -50}
    })
    
    # 2. Try to locate based on similar RSSI
    locate_payload = {
        "staff_id": "user_01",
        "rssi_map": {"ap_1": -52},
        "k": 1
    }
    response = client.post("/locate", json=locate_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["staff_id"] == "user_01"
    assert data["confidence"] > 0.9  # Should be high since -52 is close to -50

def test_get_position_404(client):
    response = client.get("/position/non_existent_user")
    assert response.status_code == 404
    assert response.json()["detail"] == "Position not found"

def test_simulate_position(client):
    payload = {
        "staff_id": "nurse_joy",
        "x": 50.0,
        "y": 50.0,
        "zone": "emergency_room",
        "location_id": "hospital_a"
    }
    response = client.put("/position/simulate", json=payload)
    assert response.status_code == 200
    assert response.json()["confidence"] == 1.0
    
    # Verify we can fetch it now
    get_resp = client.get("/position/nurse_joy")
    assert get_resp.status_code == 200
    assert get_resp.json()["zone"] == "emergency_room"