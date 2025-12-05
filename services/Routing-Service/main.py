"""
STADIUM ROUTING SERVICE 
Modular architecture with hazard-aware A* pathfinding
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import httpx
import asyncio

from astar import Graph, HazardMap
from nearest_responder import StaffTracker, create_mock_staff_tracker
from api_handlers import (
    RouteAPIHandler, EmergencyAPIHandler, HazardAPIHandler,
    RouteRequest, MultiDestinationRequest, NearestRequest,
    EmergencyRequest, HazardUpdate
)


# ========== FASTAPI APP ==========

app = FastAPI(
    title="Stadium Routing Service v2.0",
    description="Hazard-aware A* pathfinding with emergency response",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== GLOBAL STATE ==========

MAP_SERVICE_URL = "http://localhost:8000"

GRAPH: Optional[Graph] = None
HAZARD_MAP: Optional[HazardMap] = None
STAFF_TRACKER: Optional[StaffTracker] = None

# API Handlers
route_handler: Optional[RouteAPIHandler] = None
emergency_handler: Optional[EmergencyAPIHandler] = None
hazard_handler: Optional[HazardAPIHandler] = None


# ========== STARTUP ==========

@app.on_event("startup")
async def startup():
    """Initialize routing service"""
    global GRAPH, HAZARD_MAP, STAFF_TRACKER
    global route_handler, emergency_handler, hazard_handler
    
    print("\n" + "="*60)
    print("🚀 STADIUM ROUTING SERVICE v2.0 - STARTING")
    print("="*60)
    
    # Initialize hazard map
    HAZARD_MAP = HazardMap()
    print("✅ Hazard map initialized")
    
    # Load graph from Map Service
    success = await load_graph_from_map_service()
    
    if success and GRAPH:
        # Initialize staff tracker
        STAFF_TRACKER = create_mock_staff_tracker(GRAPH, num_per_role=3)
        print(f"✅ Staff tracker initialized with {len(STAFF_TRACKER.staff)} staff members")
        
        # Initialize API handlers
        route_handler = RouteAPIHandler(GRAPH, HAZARD_MAP)
        emergency_handler = EmergencyAPIHandler(GRAPH, HAZARD_MAP, STAFF_TRACKER)
        hazard_handler = HazardAPIHandler(HAZARD_MAP)
        print("✅ API handlers initialized")
        
        print("\n" + "="*60)
        print("✅ ROUTING SERVICE READY")
        print(f"   - Nodes: {len(GRAPH.nodes)}")
        print(f"   - Edges: {len(GRAPH.adjacency)}")
        print(f"   - Staff: {len(STAFF_TRACKER.staff)}")
        print(f"   - Map Service: {MAP_SERVICE_URL}")
        print("="*60 + "\n")
    else:
        print("\n⚠️  WARNING: Could not load graph from Map Service")
        print(f"   Make sure Map Service is running at {MAP_SERVICE_URL}")
        print("   Service will retry on first request\n")


async def load_graph_from_map_service():
    """Fetch graph data from Map Service"""
    global GRAPH, HAZARD_MAP
    
    try:
        print(f"📥 Fetching graph from {MAP_SERVICE_URL}/api/map ...")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{MAP_SERVICE_URL}/api/map")
            data = response.json()
            
            nodes = data.get('nodes', [])
            edges = data.get('edges', [])
            closures = data.get('closures', [])
            
            # Build graph
            GRAPH = Graph(nodes, edges)
            print(f"✅ Graph loaded: {len(nodes)} nodes, {len(edges)} edges")
            
            # Load closures
            if closures:
                for closure in closures:
                    if closure.get('edge_id'):
                        # Find edge by ID
                        edge = next((e for e in edges if e['id'] == closure['edge_id']), None)
                        if edge:
                            HAZARD_MAP.add_closure(edge['from'], edge['to'])
                print(f"✅ Loaded {len(closures)} closures")
            
            return True
            
    except Exception as e:
        print(f"❌ Error loading graph: {e}")
        return False


# ========== HEALTH & STATUS ==========

@app.get("/")
async def root():
    """Health check"""
    return {
        "service": "Stadium Routing Service",
        "version": "2.0.0",
        "status": "running" if GRAPH else "no_graph_loaded",
        "nodes": len(GRAPH.nodes) if GRAPH else 0,
        "staff": len(STAFF_TRACKER.staff) if STAFF_TRACKER else 0,
        "closures": len(HAZARD_MAP.closures) // 2 if HAZARD_MAP else 0,
        "map_service": MAP_SERVICE_URL
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    if not GRAPH:
        return {
            "status": "degraded",
            "message": "Graph not loaded",
            "suggestion": "Call POST /api/reload to load graph"
        }
    
    return {
        "status": "healthy",
        "graph": {
            "nodes": len(GRAPH.nodes),
            "adjacency_entries": len(GRAPH.adjacency)
        },
        "hazards": {
            "closures": len(HAZARD_MAP.closures) // 2,
            "node_hazards": len(HAZARD_MAP.node_hazards),
            "edge_hazards": len(HAZARD_MAP.edge_hazards) // 2
        },
        "staff": {
            "total": len(STAFF_TRACKER.staff),
            "available": sum(1 for s in STAFF_TRACKER.staff.values() if s.is_available())
        }
    }


@app.post("/api/reload")
async def reload_graph():
    """Reload graph from Map Service"""
    success = await load_graph_from_map_service()
    
    if not success:
        raise HTTPException(status_code=503, detail="Failed to reload graph from Map Service")
    
    # Reinitialize handlers
    global route_handler, emergency_handler, hazard_handler, STAFF_TRACKER
    
    if GRAPH and HAZARD_MAP:
        STAFF_TRACKER = create_mock_staff_tracker(GRAPH, num_per_role=3)
        route_handler = RouteAPIHandler(GRAPH, HAZARD_MAP)
        emergency_handler = EmergencyAPIHandler(GRAPH, HAZARD_MAP, STAFF_TRACKER)
        hazard_handler = HazardAPIHandler(HAZARD_MAP)
    
    return {
        "status": "success",
        "nodes": len(GRAPH.nodes),
        "edges": len(GRAPH.adjacency),
        "staff": len(STAFF_TRACKER.staff)
    }


# ========== ROUTING ENDPOINTS ==========

@app.get("/api/route")
async def get_route(
    from_node: str = Query(..., description="Start node ID"),
    to_node: str = Query(..., description="End node ID"),
    avoid_crowds: bool = Query(False, description="Avoid crowded areas")
):
    """
    Calculate shortest path between two nodes
    
    Example: /api/route?from_node=N1&to_node=N10&avoid_crowds=true
    """
    if not GRAPH:
        await load_graph_from_map_service()
        if not GRAPH:
            raise HTTPException(status_code=503, detail="Graph not loaded")
    
    request = RouteRequest(
        from_node=from_node,
        to_node=to_node,
        avoid_crowds=avoid_crowds
    )
    
    return route_handler.get_route(request)


@app.post("/api/route/multi")
async def multi_destination_route(request: MultiDestinationRequest):
    """
    Calculate route visiting multiple destinations
    
    Use case: Cleaning staff visiting multiple full bins
    
    Body: {
        "start": "N1",
        "destinations": ["N5", "N10", "N15"]
    }
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    return route_handler.get_multi_destination_route(request)


@app.post("/api/route/nearest")
async def find_nearest(request: NearestRequest):
    """
    Find nearest node from a list of candidates
    
    Body: {
        "target": "N42",
        "candidates": ["N10", "N15", "N20"]
    }
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    return route_handler.find_nearest_node_handler(request)


@app.get("/api/route/evacuation")
async def evacuation_route(
    from_node: str = Query(..., description="Current position")
):
    """
    Find safest evacuation route to nearest exit
    
    Example: /api/route/evacuation?from_node=N42
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    # Get gates as exit nodes
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{MAP_SERVICE_URL}/api/gates", timeout=5)
            gates = response.json()
            
            # Find nodes near gates (within 20m)
            exit_nodes = []
            for gate in gates:
                min_dist = float('inf')
                closest = None
                for node_id, node in GRAPH.nodes.items():
                    dist = ((node.x - gate['x'])**2 + (node.y - gate['y'])**2)**0.5
                    if dist < min_dist and dist < 20.0:  # Within 20m of gate
                        min_dist = dist
                        closest = node_id
                if closest and closest not in exit_nodes:
                    exit_nodes.append(closest)
            
            # If no gates found, use edge nodes (N1, N21)
            if not exit_nodes:
                exit_nodes = ['N1', 'N21']
            
        except:
            # Fallback: use entrance/exit nodes
            exit_nodes = ['N1', 'N21', 'N20']
    
    return route_handler.get_evacuation_route(from_node, exit_nodes)


# ========== EMERGENCY RESPONSE ==========

@app.post("/api/emergency/assign")
async def assign_responder(request: EmergencyRequest):
    """
    Find and assign nearest available responder
    
    Body: {
        "location": "N42",
        "incident_type": "medical",
        "priority": "high",
        "required_role": "security"
    }
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    return emergency_handler.assign_nearest_responder(request)


@app.get("/api/emergency/nearest")
async def find_nearest_responder_simple(
    location: str = Query(..., description="Emergency location node ID"),
    role: str = Query(..., description="Staff role: security, cleaning, medical, supervisor")
):
    """
    Find nearest available staff member (simplified endpoint)
    
    Example: /api/emergency/nearest?location=N42&role=security
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    request = EmergencyRequest(
        location=location,
        incident_type="generic",
        priority="high",
        required_role=role
    )
    
    return emergency_handler.assign_nearest_responder(request)


@app.post("/api/emergency/assign_multiple")
async def assign_multiple_responders(
    request: EmergencyRequest,
    num_responders: int = Query(3, description="Number of responders")
):
    """
    Assign multiple responders for large emergency
    
    Use case: Fire alarm requires 3+ security staff
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    return emergency_handler.assign_multiple_responders(request, num_responders)


# ========== HAZARD MANAGEMENT ==========

@app.post("/api/hazards/closure")
async def add_closure(
    from_node: str = Query(...),
    to_node: str = Query(...)
):
    """
    Add corridor closure (e.g., during evacuation)
    
    Example: POST /api/hazards/closure?from_node=N2&to_node=N3
    """
    return hazard_handler.add_closure(from_node, to_node)


@app.delete("/api/hazards/closure")
async def remove_closure(
    from_node: str = Query(...),
    to_node: str = Query(...)
):
    """
    Remove corridor closure
    """
    return hazard_handler.remove_closure(from_node, to_node)


@app.post("/api/hazards/update")
async def update_hazard(update: HazardUpdate):
    """
    Update hazard penalty for a node
    
    Body: {
        "node_id": "N42",
        "hazard_type": "smoke",  // smoke, crowd, fire, spill, structural
        "severity": 0.8  // 0.0-1.0
    }
    
    Penalties:
    - smoke: +5 per severity
    - crowd: +3 per severity
    - fire: +10 per severity
    - spill: +2 per severity
    - structural: +8 per severity
    """
    return hazard_handler.update_hazard(update)


@app.post("/api/hazards/crowd")
async def update_crowd(
    node_id: str = Query(...),
    occupancy_rate: float = Query(..., ge=0, le=100, description="Occupancy rate 0-100%")
):
    """
    Update crowd penalty based on occupancy rate
    
    Automatically calculates severity:
    - 0-50%: no penalty
    - 50-80%: partial penalty
    - 80-100%: full penalty
    
    Example: POST /api/hazards/crowd?node_id=N42&occupancy_rate=85
    """
    return hazard_handler.update_crowd_penalty(node_id, occupancy_rate)


@app.delete("/api/hazards/clear")
async def clear_hazards(node_id: str = Query(...)):
    """Clear all hazards from a node"""
    return hazard_handler.clear_hazards(node_id)


@app.get("/api/hazards/status")
async def hazard_status():
    """Get summary of current hazards"""
    return hazard_handler.get_hazard_status()


# ========== RUN SERVER ==========

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8002,
        log_level="info"
    )