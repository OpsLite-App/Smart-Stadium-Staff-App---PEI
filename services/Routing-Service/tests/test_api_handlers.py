"""
Tests for API handlers
"""
import sys
import os
from api_handlers import HazardUpdate
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from astar import Graph, HazardMap
from api_handlers import RouteAPIHandler, HazardAPIHandler, RouteRequest

def create_test_graph():
    """Create a simple test graph"""
    nodes = [
        {"id": "N1", "x": 0, "y": 0},
        {"id": "N2", "x": 10, "y": 0},
        {"id": "N3", "x": 20, "y": 0},
        {"id": "N4", "x": 30, "y": 0}
    ]
    
    edges = [
        {"from": "N1", "to": "N2", "w": 10.0},
        {"from": "N2", "to": "N3", "w": 10.0},
        {"from": "N3", "to": "N4", "w": 10.0},
        {"from": "N2", "to": "N4", "w": 25.0}  # Longer alternative route
    ]
    
    return Graph(nodes, edges)

def test_route_handler_basic():
    """Test basic route calculation"""
    print("Testing RouteAPIHandler...")
    
    graph = create_test_graph()
    hazard_map = HazardMap()
    handler = RouteAPIHandler(graph, hazard_map)
    
    # Test simple route
    request = RouteRequest(from_node="N1", to_node="N4", avoid_crowds=False)
    response = handler.get_route(request)
    
    print(f"✅ Route calculated: {response.path}")
    print(f"✅ Distance: {response.distance}m")
    print(f"✅ ETA: {response.eta_seconds}s")
    
    assert response.path == ["N1", "N2", "N3", "N4"]
    assert response.distance == 30.0  # 10 + 10 + 10
    
    print("✅ Basic route handler test passed")

def test_route_with_closure():
    """Test route calculation with closure"""
    print("\nTesting route with closure...")
    
    graph = create_test_graph()
    hazard_map = HazardMap()
    
    # Add closure between N2 and N3
    hazard_map.add_closure("N2", "N3")
    
    handler = RouteAPIHandler(graph, hazard_map)
    request = RouteRequest(from_node="N1", to_node="N4", avoid_crowds=False)
    response = handler.get_route(request)
    
    print(f"✅ Route with closure: {response.path}")
    print(f"✅ Distance with detour: {response.distance}m")
    
    # Should take longer route N1 -> N2 -> N4
    assert response.path == ["N1", "N2", "N4"]
    assert response.distance == 35.0  # 10 + 25
    
    print("✅ Route with closure test passed")

def test_hazard_handler():
    """Test hazard management"""
    print("\nTesting HazardAPIHandler...")
    
    hazard_map = HazardMap()
    handler = HazardAPIHandler(hazard_map)
    
    # Test adding hazard
    update = HazardUpdate(
        node_id="N5",
        hazard_type="smoke",
        severity=0.8
    )
    result = handler.update_hazard(update)
    
    print(f"✅ Hazard added: {result}")
    assert result["node_id"] == "N5"
    assert result["hazard_type"] == "smoke"
    assert result["severity"] == 0.8
    
    # Test crowd penalty
    result = handler.update_crowd_penalty("N6", 75.0)
    print(f"✅ Crowd penalty: {result}")
    
    # Test closure
    result = handler.add_closure("N1", "N2")
    print(f"✅ Closure added: {result}")
    assert hazard_map.is_closed("N1", "N2")
    
    # Test status
    status = handler.get_hazard_status()
    print(f"✅ Hazard status: {status}")
    
    print("✅ Hazard handler tests passed")

if __name__ == "__main__":
    print("Running API handler tests...")
    print("=" * 50)
    
    test_route_handler_basic()
    print("-" * 40)
    
    test_route_with_closure()
    print("-" * 40)
    
    test_hazard_handler()
    print("=" * 50)
    
    print("✅ All API handler tests completed successfully!")