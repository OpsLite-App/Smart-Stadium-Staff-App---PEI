"""
Tests for A* pathfinding algorithms
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from astar import Graph, HazardMap, HazardType, hazard_aware_astar, calculate_eta

def test_hazard_map_penalties():
    """Test hazard penalty calculations"""
    hm = HazardMap()
    
    # Test smoke penalty
    hm.set_node_hazard("N1", HazardType.SMOKE, 1.0)
    penalty = hm.get_node_penalty("N1")
    print(f"✅ Smoke penalty: {penalty} (expected: 5.0)")
    assert penalty == 5.0
    
    # Test crowd penalty scaling
    hm.set_crowd_penalty("N2", 85.0)
    penalty = hm.get_node_penalty("N2")
    print(f"✅ Crowd penalty at 85%: {penalty} (should be > 0)")
    assert penalty > 0
    
    # Test closure
    hm.add_closure("N1", "N2")
    assert hm.is_closed("N1", "N2")
    print("✅ Closure added and detected")
    
    hm.remove_closure("N1", "N2")
    assert not hm.is_closed("N1", "N2")
    print("✅ Closure removed")
    
    print("✅ HazardMap tests passed")

def test_eta_calculation():
    """Test ETA calculations"""
    # Test default speed
    eta = calculate_eta(100.0)
    print(f"✅ ETA for 100m at 1.5m/s: {eta}s")
    assert eta == 66  # 100 / 1.5 ≈ 66.67 -> int(66.67) = 66
    
    # Test role-based ETA
    from astar import calculate_eta_with_role
    security_eta = calculate_eta_with_role(100.0, "security")
    cleaning_eta = calculate_eta_with_role(100.0, "cleaning")
    
    print(f"✅ Security ETA: {security_eta}s (faster)")
    print(f"✅ Cleaning ETA: {cleaning_eta}s (slower)")
    assert security_eta < cleaning_eta
    
    print("✅ ETA tests passed")

def test_basic_graph_creation():
    """Test creating a simple graph"""
    nodes = [
        {"id": "N1", "x": 0, "y": 0},
        {"id": "N2", "x": 10, "y": 0},
        {"id": "N3", "x": 20, "y": 0}
    ]
    
    edges = [
        {"from": "N1", "to": "N2", "w": 10.0},
        {"from": "N2", "to": "N3", "w": 10.0}
    ]
    
    graph = Graph(nodes, edges)
    
    assert len(graph.nodes) == 3
    assert len(graph.adjacency) == 2  # N3 has no outgoing edges
    
    neighbors = graph.get_neighbors("N1")
    assert len(neighbors) == 1
    assert neighbors[0][0] == "N2"
    
    print(f"✅ Graph created with {len(graph.nodes)} nodes")
    print("✅ Basic graph tests passed")

if __name__ == "__main__":
    print("Running A* algorithm tests...")
    print("-" * 40)
    
    test_hazard_map_penalties()
    print("-" * 40)
    
    test_eta_calculation()
    print("-" * 40)
    
    test_basic_graph_creation()
    print("-" * 40)
    
    print("✅ All A* tests completed successfully!")