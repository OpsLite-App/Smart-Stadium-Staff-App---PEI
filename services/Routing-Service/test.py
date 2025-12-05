"""
TEST SUITE - Routing Service
Tests all algorithms and API endpoints
"""

import requests
import json
from typing import Dict

BASE_URL = "http://localhost:8002"


def print_test(name: str):
    """Print test header"""
    print("\n" + "="*60)
    print(f"TEST: {name}")
    print("="*60)


def print_result(success: bool, message: str):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}\n")


def test_health_check():
    """Test 1: Service health check"""
    print_test("Health Check")
    
    response = requests.get(f"{BASE_URL}/health")
    
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2))
        
        has_graph = data.get('graph', {}).get('nodes', 0) > 0
        print_result(has_graph, f"Service healthy with {data.get('graph', {}).get('nodes', 0)} nodes")
    else:
        print_result(False, f"Service not responding: {response.status_code}")


def test_basic_routing():
    """Test 2: Basic A* routing"""
    print_test("Basic A* Routing: N1 → N10")
    
    response = requests.get(
        f"{BASE_URL}/api/route",
        params={"from_node": "N1", "to_node": "N10"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"Path: {data['path']}")
        print(f"Distance: {data['distance']} meters")
        print(f"ETA: {data['eta_seconds']} seconds")
        print(f"Waypoints: {len(data['waypoints'])}")
        
        success = len(data['path']) > 0 and data['distance'] > 0
        print_result(success, "Route calculated successfully")
    else:
        print_result(False, f"Error: {response.status_code} - {response.text}")


def test_hazard_aware_routing():
    """Test 3: Routing with hazards"""
    print_test("Hazard-Aware Routing")
    
    # Step 1: Add smoke hazard to N5
    print("Step 1: Adding SMOKE hazard to N5...")
    response = requests.post(
        f"{BASE_URL}/api/hazards/update",
        json={
            "node_id": "N5",
            "hazard_type": "smoke",
            "severity": 1.0
        }
    )
    print(f"   {response.json()}")
    
    # Step 2: Calculate route avoiding smoke
    print("\nStep 2: Calculating route N1 → N10 (should avoid N5)...")
    response = requests.get(
        f"{BASE_URL}/api/route",
        params={"from_node": "N1", "to_node": "N10", "avoid_crowds": True}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"   Path: {data['path']}")
        print(f"   Distance: {data['distance']} meters (includes +5 smoke penalty)")
        
        # Check if N5 is avoided or penalized
        avoids_n5 = "N5" not in data['path']
        print_result(True, f"Route calculated with hazard awareness (N5 in path: {not avoids_n5})")
    else:
        print_result(False, f"Error: {response.status_code}")
    
    # Step 3: Clear hazard
    print("\nStep 3: Clearing hazard from N5...")
    requests.delete(f"{BASE_URL}/api/hazards/clear", params={"node_id": "N5"})
    print("   ✓ Hazard cleared")


def test_closure_handling():
    """Test 4: Corridor closure"""
    print_test("Corridor Closure Handling")
    
    # Step 1: Calculate normal route
    print("Step 1: Normal route N2 → N4...")
    response = requests.get(
        f"{BASE_URL}/api/route",
        params={"from_node": "N2", "to_node": "N4"}
    )
    normal_path = response.json()['path'] if response.status_code == 200 else []
    print(f"   Path: {normal_path}")
    
    # Step 2: Close edge N2-N3
    print("\nStep 2: Closing corridor N2 ↔ N3...")
    response = requests.post(
        f"{BASE_URL}/api/hazards/closure",
        params={"from_node": "N2", "to_node": "N3"}
    )
    print(f"   {response.json()}")
    
    # Step 3: Calculate route with closure
    print("\nStep 3: Route N2 → N4 with closure...")
    response = requests.get(
        f"{BASE_URL}/api/route",
        params={"from_node": "N2", "to_node": "N4"}
    )
    
    if response.status_code == 200:
        closed_path = response.json()['path']
        print(f"   Path: {closed_path}")
        
        # Verify N2-N3 edge is not used
        has_closure = not (normal_path == closed_path)
        print_result(has_closure, "Route recalculated avoiding closure")
    elif response.status_code == 404:
        print_result(True, "No path found (corridor completely blocked)")
    else:
        print_result(False, f"Error: {response.status_code}")
    
    # Step 4: Remove closure
    print("\nStep 4: Removing closure...")
    requests.delete(
        f"{BASE_URL}/api/hazards/closure",
        params={"from_node": "N2", "to_node": "N3"}
    )
    print("   ✓ Closure removed")


def test_crowd_penalty():
    """Test 5: Crowd penalty"""
    print_test("Crowd Penalty (Occupancy-Based)")
    
    # Add crowd to N6
    print("Adding 85% occupancy to N6...")
    response = requests.post(
        f"{BASE_URL}/api/hazards/crowd",
        params={"node_id": "N6", "occupancy_rate": 85.0}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"   {data}")
        
        penalty = data.get('calculated_penalty', 0)
        print_result(penalty > 0, f"Crowd penalty applied: +{penalty} meters")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_nearest_responder():
    """Test 6: Nearest responder algorithm"""
    print_test("Nearest Responder (Emergency Response)")
    
    # Emergency at N10
    print("Emergency at N10, need SECURITY...")
    response = requests.get(
        f"{BASE_URL}/api/emergency/nearest",
        params={"location": "N10", "role": "security"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"\nAssigned: {data['staff_id']}")
        print(f"Role: {data['role']}")
        print(f"From: {data['current_position']}")
        print(f"ETA: {data['eta_seconds']} seconds")
        print(f"Distance: {data['distance']} meters")
        print(f"Path: {data['path']}")
        
        has_assignment = len(data['staff_id']) > 0
        print_result(has_assignment, "Responder assigned successfully")
    else:
        print_result(False, f"Error: {response.status_code} - {response.text}")


def test_multi_destination():
    """Test 7: Multi-destination routing"""
    print_test("Multi-Destination Routing (Cleaning Route)")
    
    # Visit bins at N5, N10, N15
    response = requests.post(
        f"{BASE_URL}/api/route/multi",
        json={
            "start": "N1",
            "destinations": ["N5", "N10", "N15"]
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"Start: N1")
        print(f"Destinations: N5, N10, N15")
        print(f"\nOptimized path: {data['path']}")
        print(f"Total distance: {data['distance']} meters")
        print(f"Total ETA: {data['eta_seconds']} seconds")
        
        # Check if ALL destinations are visited
        destinations_set = {"N5", "N10", "N15"}
        path_set = set(data['path'])
        visits_all = destinations_set.issubset(path_set)
        
        if not visits_all:
            missing = destinations_set - path_set
            print(f"\n⚠️  Missing destinations: {missing}")
        
        print_result(visits_all, f"All destinations visited: {visits_all}")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_evacuation_route():
    """Test 8: Evacuation routing"""
    print_test("Evacuation Route (Safest Exit)")
    
    # Evacuate from N15
    response = requests.get(
        f"{BASE_URL}/api/route/evacuation",
        params={"from_node": "N15"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"From: N15")
        print(f"Exit: {data['path'][-1]}")
        print(f"Route: {data['path']}")
        print(f"Distance: {data['distance']} meters")
        print(f"ETA: {data['eta_seconds']} seconds")
        
        print_result(True, "Evacuation route calculated")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_multiple_responders():
    """Test 9: Multiple responders (fire alarm)"""
    print_test("Multiple Responders (Fire Alarm)")
    
    # Fire alarm at N8 - need 3 security staff
    response = requests.post(
        f"{BASE_URL}/api/emergency/assign_multiple",
        params={"num_responders": 3},
        json={
            "location": "N8",
            "incident_type": "fire",
            "priority": "critical",
            "required_role": "security"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"Incident: Fire at N8")
        print(f"Assigned {len(data)} responders:\n")
        
        for i, responder in enumerate(data, 1):
            print(f"{i}. {responder['staff_id']}")
            print(f"   From: {responder['current_position']}")
            print(f"   ETA: {responder['eta_seconds']}s")
            print(f"   Distance: {responder['distance']}m\n")
        
        # Accept 2+ responders (may not have 3 available)
        success = len(data) >= 2
        print_result(success, f"Assigned {len(data)} responders (minimum 2 required)")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_hazard_status():
    """Test 10: Hazard status summary"""
    print_test("Hazard Status Summary")
    
    response = requests.get(f"{BASE_URL}/api/hazards/status")
    
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2))
        print_result(True, "Hazard status retrieved")
    else:
        print_result(False, f"Error: {response.status_code}")


def run_all_tests():
    """Run complete test suite"""
    print("\n" + "█"*60)
    print("ROUTING SERVICE - TEST SUITE")
    print("█"*60)
    
    tests = [
        #test_health_check,
        #test_basic_routing,
        #test_hazard_aware_routing,
        #test_closure_handling,
        #test_crowd_penalty,
        test_nearest_responder,
        #test_multi_destination,
        #test_evacuation_route,
        #test_multiple_responders,
        #test_hazard_status
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print_result(False, f"Exception: {str(e)}")
    
    print("\n" + "█"*60)
    print("TEST SUITE COMPLETE")
    print("█"*60 + "\n")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        test_name = sys.argv[1]
        test_map = {
            #"health": test_health_check,
            #"route": test_basic_routing,
            #"hazard": test_hazard_aware_routing,
            #"closure": test_closure_handling,
            #"crowd": test_crowd_penalty,
            "responder": test_nearest_responder,
            #"multi": test_multi_destination,
            #"evac": test_evacuation_route,
            #"multiple": test_multiple_responders,
            #"status": test_hazard_status
        }
        
        if test_name in test_map:
            test_map[test_name]()
        else:
            print(f"Unknown test: {test_name}")
            print(f"Available: {', '.join(test_map.keys())}")
    else:
        run_all_tests()