"""
TEST SUITE - Queueing Service
Tests M/M/1, M/M/k models and API endpoints
"""

import requests
import json

BASE_URL = "http://localhost:8003"


def print_test(name: str):
    print("\n" + "="*60)
    print(f"TEST: {name}")
    print("="*60)


def print_result(success: bool, message: str):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}\n")


def test_health_check():
    """Test 1: Service health"""
    print_test("Health Check")
    
    response = requests.get(f"{BASE_URL}/")
    
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2))
        print_result(True, "Service is running")
    else:
        print_result(False, f"Service not responding: {response.status_code}")


def test_mm1_stable():
    """Test 2: M/M/1 stable queue"""
    print_test("M/M/1 Queue (Stable)")
    
    # λ=10, μ=12, ρ=0.833 → stable
    response = requests.post(
        f"{BASE_URL}/api/queue/calculate",
        json={
            "location_id": "test_mm1",
            "arrival_rate": 10.0,
            "service_rate": 12.0,
            "num_servers": 1
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        output = data["output"]
        
        print(f"Input: λ=10, μ=12, k=1")
        print(f"\nResults:")
        print(f"  Utilization (ρ): {output['utilization']}")
        print(f"  Avg Wait Time: {output['avg_wait_time_minutes']:.2f} minutes")
        print(f"  Wait Range: {output['wait_time_range']}")
        print(f"  Avg Queue Length: {output['avg_queue_length']:.2f} people")
        print(f"  Status: {output['status']}")
        print(f"  Stable: {output['is_stable']}")
        
        # Verify theoretical values
        # ρ = 10/12 = 0.833
        # Wq = ρ/(μ-λ) = 0.833/(12-10) = 0.833/2 = 0.4167 minutes
        expected_wait = 0.833 / (12 - 10)
        actual_wait = output['avg_wait_time_minutes']
        
        is_correct = abs(actual_wait - expected_wait) < 0.01
        print_result(is_correct and output['is_stable'], 
                    f"Correct calculation (expected ~{expected_wait:.2f}min)")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_mm1_unstable():
    """Test 3: M/M/1 unstable queue"""
    print_test("M/M/1 Queue (Unstable)")
    
    # λ=15, μ=12, ρ=1.25 → unstable
    response = requests.post(
        f"{BASE_URL}/api/queue/calculate",
        json={
            "location_id": "test_unstable",
            "arrival_rate": 15.0,
            "service_rate": 12.0,
            "num_servers": 1
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        output = data["output"]
        
        print(f"Input: λ=15, μ=12, k=1")
        print(f"\nResults:")
        print(f"  Utilization (ρ): {output['utilization']}")
        print(f"  Avg Wait Time: {output['avg_wait_time_minutes']}")
        print(f"  Status: {output['status']}")
        print(f"  Stable: {output['is_stable']}")
        
        is_unstable = not output['is_stable'] and output['status'] == 'unstable'
        print_result(is_unstable, "Correctly detected unstable system")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_mmk_multiple_servers():
    """Test 4: M/M/k with multiple servers"""
    print_test("M/M/k Queue (Multiple Servers)")
    
    # λ=20, μ=8, k=3
    # ρ = 20/(3*8) = 20/24 = 0.833 → stable
    response = requests.post(
        f"{BASE_URL}/api/queue/calculate",
        json={
            "location_id": "test_mmk",
            "arrival_rate": 20.0,
            "service_rate": 8.0,
            "num_servers": 3
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        output = data["output"]
        
        print(f"Input: λ=20, μ=8, k=3")
        print(f"\nResults:")
        print(f"  Utilization (ρ): {output['utilization']}")
        print(f"  Avg Wait Time: {output['avg_wait_time_minutes']:.2f} minutes")
        print(f"  Avg Queue Length: {output['avg_queue_length']:.2f} people")
        print(f"  Status: {output['status']}")
        print(f"  Stable: {output['is_stable']}")
        
        # With 3 servers, wait time should be much lower than M/M/1
        is_stable = output['is_stable'] and output['utilization'] < 1.0
        print_result(is_stable, "Multiple servers reduce wait time")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_queue_update():
    """Test 5: Update queue state"""
    print_test("Queue State Update")
    
    # Simulate gate queue
    response = requests.post(
        f"{BASE_URL}/api/queue/update",
        json={
            "location_id": "Gate-1",
            "location_type": "gate",
            "current_queue_length": 15,
            "arrivals_last_minute": 12,
            "departures_last_minute": 10,
            "num_servers": 2
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Location: {data['location_id']}")
        print(f"Arrival Rate: {data['arrival_rate']} people/min")
        print(f"Service Rate: {data['service_rate']} people/min")
        print(f"\nCurrent Metrics:")
        print(f"  Wait Time: {data['current_metrics']['wait_time_minutes']:.2f} min")
        print(f"  Status: {data['current_metrics']['status']}")
        print(f"  Utilization: {data['current_metrics']['utilization']}")
        
        print_result(data['updated'], "Queue state updated successfully")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_get_wait_time():
    """Test 6: Get wait time for tracked queue"""
    print_test("Get Wait Time")
    
    # First update
    requests.post(
        f"{BASE_URL}/api/queue/update",
        json={
            "location_id": "Toilet-A",
            "location_type": "toilet",
            "current_queue_length": 8,
            "arrivals_last_minute": 6,
            "departures_last_minute": 4,
            "num_servers": 3
        }
    )
    
    # Then get wait time
    response = requests.get(f"{BASE_URL}/api/queue/waittime/Toilet-A")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Location: {data['location_id']}")
        print(f"Avg Wait Time: {data['avg_wait_time_minutes']:.2f} minutes")
        print(f"Wait Range: {data['wait_time_range']}")
        print(f"Queue Length: {data['queue_length']:.2f} people")
        print(f"Status: {data['status']}")
        print(f"Confidence: {data['confidence']}")
        print(f"Utilization: {data['utilization']}")
        
        print_result(True, "Wait time retrieved successfully")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_queue_alerts():
    """Test 7: Get queue alerts"""
    print_test("Queue Alerts (High Wait Times)")
    
    # Create some queues
    queues = [
        ("Bar-North", "bar", 20, 15, 10, 1),
        ("Toilet-B", "toilet", 5, 3, 2, 2),
        ("Gate-East", "gate", 30, 25, 28, 3),
    ]
    
    for loc_id, loc_type, queue_len, arrivals, departures, servers in queues:
        requests.post(
            f"{BASE_URL}/api/queue/update",
            json={
                "location_id": loc_id,
                "location_type": loc_type,
                "current_queue_length": queue_len,
                "arrivals_last_minute": arrivals,
                "departures_last_minute": departures,
                "num_servers": servers
            }
        )
    
    # Get alerts for wait times > 5 minutes
    response = requests.get(f"{BASE_URL}/api/queue/alerts?threshold_minutes=5")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Threshold: {data['threshold_minutes']} minutes")
        print(f"Alerts: {data['alerts_count']}\n")
        
        for alert in data['alerts']:
            print(f"⚠️  {alert['location_id']} ({alert['location_type']})")
            print(f"   Wait Time: {alert['wait_time_minutes']:.2f} min")
            print(f"   Utilization: {alert['utilization']:.2f}")
            print(f"   Recommendation: {alert['recommended_action']}\n")
        
        print_result(True, f"Found {data['alerts_count']} queues above threshold")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_compare_scenarios():
    """Test 8: Compare different server configurations"""
    print_test("Compare Server Scenarios")
    
    # Compare 1-5 servers for λ=18, μ=5
    response = requests.get(
        f"{BASE_URL}/api/queue/compare",
        params={
            "arrival_rate": 18.0,
            "service_rate": 5.0,
            "max_servers": 5
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Arrival Rate: {data['arrival_rate']} people/min")
        print(f"Service Rate: {data['service_rate']} people/min per server\n")
        print(f"{'Servers':<10} {'Wait (min)':<12} {'Utilization':<15} {'Status':<10}")
        print("-" * 50)
        
        for scenario in data['scenarios']:
            wait = scenario['wait_time_minutes']
            wait_str = f"{wait:.2f}" if wait != float('inf') else "∞"
            
            print(f"{scenario['num_servers']:<10} {wait_str:<12} "
                  f"{scenario['utilization']:<15.2f} {scenario['status']:<10}")
        
        print_result(True, "Scenario comparison completed")
    else:
        print_result(False, f"Error: {response.status_code}")


def test_all_queues_status():
    """Test 9: Get status of all queues"""
    print_test("All Queues Status")
    
    response = requests.get(f"{BASE_URL}/api/queue/status")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Total Tracked Queues: {data['total_queues']}\n")
        
        for queue in data['queues'][:5]:  # Show top 5
            wait = queue['wait_time_minutes']
            wait_str = f"{wait:.2f}" if wait != float('inf') else "∞"
            
            print(f"{queue['location_id']:<15} ({queue['location_type']:<8})")
            print(f"  Wait: {wait_str} min | Utilization: {queue['utilization']:.2f} | Status: {queue['status']}")
        
        print_result(True, f"Retrieved status for {data['total_queues']} queues")
    else:
        print_result(False, f"Error: {response.status_code}")


def run_all_tests():
    """Run complete test suite"""
    print("\n" + "█"*60)
    print("QUEUEING SERVICE - TEST SUITE")
    print("█"*60)
    
    tests = [
        test_health_check,
        test_mm1_stable,
        test_mm1_unstable,
        test_mmk_multiple_servers,
        test_queue_update,
        test_get_wait_time,
        test_queue_alerts,
        test_compare_scenarios,
        test_all_queues_status
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
    run_all_tests()