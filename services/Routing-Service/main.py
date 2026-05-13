"""
ROUTING SERVICE - Main Application
Only responsible for calculating routes, no emergency management
"""

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import httpx
import asyncio
import os

from astar import Graph, HazardMap, hazard_aware_astar, find_nearest_node, multi_destination_route
from api_handlers import RouteAPIHandler, HazardAPIHandler
from gis import CameraStatusUpdate, GisLayerService
from pgrouting import (
    PgRoutingService,
    EdgeOverrideCreate,
    OperationalEventCreate,
)

# ========== FASTAPI APP ==========

app = FastAPI(
    title="Stadium Routing Service",
    description="Hazard-aware pathfinding with A* algorithm",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== CONFIGURATION ==========

MAP_SERVICE_URL = os.getenv("MAP_SERVICE_URL", "http://localhost:8000")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8081")


# ========== GLOBAL STATE ==========

GRAPH: Optional[Graph] = None
HAZARD_MAP: Optional[HazardMap] = None

# API Handlers (only routing and hazards)
route_handler: Optional[RouteAPIHandler] = None
hazard_handler: Optional[HazardAPIHandler] = None
pgrouting_service: Optional[PgRoutingService] = None
gis_layer_service: Optional[GisLayerService] = None


def get_pgrouting_service() -> PgRoutingService:
    """Lazily initialize direct pgRouting access."""
    global pgrouting_service
    if pgrouting_service is None:
        pgrouting_service = PgRoutingService()
        pgrouting_service.initialize_runtime_tables()
    return pgrouting_service


def get_gis_layer_service() -> GisLayerService:
    """Lazily initialize GeoJSON access for indoor GIS layers."""
    global gis_layer_service
    if gis_layer_service is None:
        gis_layer_service = GisLayerService()
        gis_layer_service.initialize_camera_status_table()
    return gis_layer_service


async def require_supervisor_role(authorization: Optional[str] = Header(None)) -> dict:
    """Validate bearer token and allow only supervisor/admin users."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{AUTH_SERVICE_URL}/auth/validate",
                headers={"Authorization": authorization},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if response.status_code >= 400:
        raise HTTPException(status_code=503, detail="Auth service rejected validation")

    claims = response.json()
    role = str(claims.get("role", "")).lower()
    if role not in {"supervisor", "admin"}:
        raise HTTPException(status_code=403, detail="Supervisor role required")

    return claims


# ========== STARTUP ==========

@app.on_event("startup")
async def startup():
    """Initialize routing service"""
    global HAZARD_MAP, route_handler, hazard_handler
    
    print("\n" + "="*60)
    print("🚀 ROUTING SERVICE v2.0 - STARTING")
    print("="*60)
    
    # Initialize hazard map
    HAZARD_MAP = HazardMap()
    print("✅ Hazard map initialized")
    
    # Load graph from Map Service
    success = await load_graph_from_map_service()
    try:
        get_pgrouting_service()
        print("✅ pgRouting runtime tables ready")
    except Exception as e:
        print(f"⚠️  pgRouting runtime tables unavailable: {e}")
    
    if success and GRAPH:
        # Initialize API handlers (ONLY route and hazard)
        route_handler = RouteAPIHandler(GRAPH, HAZARD_MAP)
        hazard_handler = HazardAPIHandler(HAZARD_MAP)
        print("✅ API handlers initialized")
        
        print("\n" + "="*60)
        print("✅ ROUTING SERVICE READY")
        print(f"   - Nodes: {len(GRAPH.nodes)}")
        print(f"   - Edges: {sum(len(v) for v in GRAPH.adjacency.values())}")
        print(f"   - Map Service: {MAP_SERVICE_URL}")
        print("="*60 + "\n")
    else:
        print("\n⚠️  WARNING: Could not load graph from Map Service")
        print(f"   Make sure Map Service is running at {MAP_SERVICE_URL}")
        print("   Service will retry on first request\n")


async def load_graph_from_map_service():
    """Fetch graph data from Map Service"""
    global GRAPH
    
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
        "service": "Routing Service",
        "version": "2.0.0",
        "status": "running" if GRAPH else "no_graph_loaded",
        "nodes": len(GRAPH.nodes) if GRAPH else 0,
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
        }
    }


@app.post("/api/reload")
async def reload_graph():
    """Reload graph from Map Service"""
    success = await load_graph_from_map_service()
    
    if not success:
        raise HTTPException(status_code=503, detail="Failed to reload graph from Map Service")
    
    # Reinitialize handlers
    global route_handler, hazard_handler
    
    if GRAPH and HAZARD_MAP:
        route_handler = RouteAPIHandler(GRAPH, HAZARD_MAP)
        hazard_handler = HazardAPIHandler(HAZARD_MAP)
    
    return {
        "status": "success",
        "nodes": len(GRAPH.nodes),
        "edges": sum(len(v) for v in GRAPH.adjacency.values())
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
    
    from api_handlers import RouteRequest
    
    request = RouteRequest(
        from_node=from_node,
        to_node=to_node,
        avoid_crowds=avoid_crowds
    )
    
    return route_handler.get_route(request)


@app.get("/api/route/pgrouting")
async def get_pgrouting_route(
    from_node: int = Query(..., description="Start node ID from PostGIS/pgRouting graph"),
    to_node: int = Query(..., description="End node ID from PostGIS/pgRouting graph")
):
    """
    Calculate an indoor route directly with pgRouting.

    Example: /api/route/pgrouting?from_node=63&to_node=71
    """
    service = get_pgrouting_service()
    return service.get_route(from_node, to_node)


@app.get("/api/route/pgrouting/combined")
async def get_combined_pgrouting_route(
    from_node: int = Query(..., description="Start node ID from the combined outdoor-indoor graph"),
    to_node: int = Query(..., description="End node ID from the combined outdoor-indoor graph")
):
    """
    Calculate a route across the combined outdoor and indoor graph.

    Example: /api/route/pgrouting/combined?from_node=1003&to_node=71
    """
    service = get_pgrouting_service()
    return service.get_combined_route(from_node, to_node)


@app.get("/api/pois")
async def get_pois():
    """Return indoor POIs from the real PostGIS database."""
    service = get_pgrouting_service()
    return service.list_pois()


@app.get("/api/route/pgrouting/by-poi")
async def get_pgrouting_route_by_poi(
    from_poi_id: int = Query(..., description="Start POI ID"),
    to_poi_id: int = Query(..., description="End POI ID")
):
    """
    Calculate an indoor route between two POIs by resolving their node IDs.

    Example: /api/route/pgrouting/by-poi?from_poi_id=33&to_poi_id=40
    """
    service = get_pgrouting_service()
    return service.get_route_by_poi(from_poi_id, to_poi_id)


@app.get("/api/route/pgrouting/by-poi/geojson")
async def get_pgrouting_route_by_poi_geojson(
    from_poi_id: int = Query(..., description="Start POI ID"),
    to_poi_id: int = Query(..., description="End POI ID"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Calculate an indoor route between two POIs and return route edges as GeoJSON."""
    service = get_pgrouting_service()
    return service.get_route_geojson_by_poi(from_poi_id, to_poi_id, output_srid=srid)


@app.get("/api/graph/status")
async def get_graph_status():
    """Return a minimal graph status payload for frontend use."""
    service = get_pgrouting_service()
    return service.get_graph_status()


@app.get("/api/graph/edge-overrides")
async def list_edge_overrides():
    """List live edge overrides used by routing."""
    service = get_pgrouting_service()
    return service.list_edge_overrides()


@app.post("/api/graph/edge-overrides")
async def create_edge_override(payload: EdgeOverrideCreate):
    """Create a live edge override for blocked paths or congestion."""
    service = get_pgrouting_service()
    return service.create_edge_override(payload)


@app.get("/api/graph/events")
async def list_operational_events():
    """List active and historical operational events."""
    service = get_pgrouting_service()
    return service.list_operational_events()


@app.post("/api/graph/events")
async def create_operational_event(payload: OperationalEventCreate):
    """Create a minimal operational monitoring event."""
    service = get_pgrouting_service()
    return service.create_operational_event(payload)


# ========== GIS LAYER ENDPOINTS ==========

@app.get("/api/gis/rooms")
async def get_gis_rooms(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return room polygons as GeoJSON."""
    service = get_gis_layer_service()
    return service.get_feature_collection("rooms", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/corridors")
async def get_gis_corridors(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return corridor polygons as GeoJSON."""
    service = get_gis_layer_service()
    return service.get_feature_collection("corridors", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/cameras")
async def get_gis_cameras(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return camera point infrastructure as GeoJSON."""
    service = get_gis_layer_service()
    return service.get_feature_collection("cameras", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/camera-coverage")
async def get_gis_camera_coverage(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return camera coverage polygons as GeoJSON."""
    service = get_gis_layer_service()
    return service.get_feature_collection("camera_coverage", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/camera-status")
async def get_gis_camera_status(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
):
    """Return live camera monitoring state keyed by real camera IDs."""
    service = get_gis_layer_service()
    return service.get_camera_status(floor_id=floor_id)


@app.get("/api/gis/impacted-edges")
async def get_gis_impacted_edges(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return active graph edge overrides as GeoJSON."""
    service = get_gis_layer_service()
    return service.get_impacted_edges(floor_id=floor_id, output_srid=srid)


@app.put("/api/gis/camera-status/{camera_id}")
async def update_gis_camera_status(
    camera_id: int,
    payload: CameraStatusUpdate,
    _: dict = Depends(require_supervisor_role),
):
    """Update persisted monitoring state for one camera."""
    service = get_gis_layer_service()
    try:
        return service.update_camera_status(camera_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/gis/vertical-transitions")
async def get_gis_vertical_transitions(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return stairs/lifts/floor transitions as GeoJSON."""
    service = get_gis_layer_service()
    return service.get_feature_collection("vertical_transitions", floor_id=floor_id, output_srid=srid)


@app.post("/api/route/multi")
async def multi_destination_route(from_node: str = Query(...), to_nodes: List[str] = Query(...)):
    """
    Calculate route visiting multiple destinations
    
    Example: POST /api/route/multi?from_node=N1&to_nodes=N5&to_nodes=N10
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    from api_handlers import MultiDestinationRequest
    
    request = MultiDestinationRequest(
        start=from_node,
        destinations=to_nodes
    )
    
    return route_handler.get_multi_destination_route(request)


@app.get("/api/route/nearest-to-coords")
async def nearest_node_to_coords(x: float, y: float):
    """Find the nearest graph node to given (x, y) coordinates"""
    if not GRAPH:
        await load_graph_from_map_service()
        if not GRAPH:
            raise HTTPException(status_code=503, detail="Graph not loaded")

    best_node = min(
        GRAPH.nodes.items(),
        key=lambda item: (item[1].x - x) ** 2 + (item[1].y - y) ** 2
    )
    return {"node_id": best_node[0], "x": best_node[1].x, "y": best_node[1].y}


@app.post("/api/route/nearest")
async def find_nearest(target: str = Query(...), candidates: List[str] = Query(...)):
    """
    Find nearest node from a list of candidates
    
    Example: POST /api/route/nearest?target=N42&candidates=N10&candidates=N15
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    from api_handlers import NearestRequest
    
    request = NearestRequest(
        target=target,
        candidates=candidates
    )
    
    return route_handler.find_nearest_node_handler(request)


@app.get("/api/route/evacuation")
async def evacuation_route(from_node: str = Query(..., description="Current position")):
    """
    Find safest evacuation route to nearest exit
    
    Example: /api/route/evacuation?from_node=N42
    """
    if not GRAPH:
        await load_graph_from_map_service()
    
    # Get gates as exit nodes from Map Service
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
                    if dist < min_dist and dist < 20.0:
                        min_dist = dist
                        closest = node_id
                if closest and closest not in exit_nodes:
                    exit_nodes.append(closest)
            
            if not exit_nodes:
                exit_nodes = ['N1', 'N21']
            
        except:
            exit_nodes = ['N1', 'N21', 'N20']
    
    return route_handler.get_evacuation_route(from_node, exit_nodes)


# ========== HAZARD MANAGEMENT ==========

@app.post("/api/hazards/closure")
async def add_closure(from_node: str = Query(...), to_node: str = Query(...)):
    """
    Add corridor closure (e.g., during evacuation)
    
    Example: POST /api/hazards/closure?from_node=N2&to_node=N3
    """
    return hazard_handler.add_closure(from_node, to_node)


@app.delete("/api/hazards/closure")
async def remove_closure(from_node: str = Query(...), to_node: str = Query(...)):
    """Remove corridor closure"""
    return hazard_handler.remove_closure(from_node, to_node)


@app.post("/api/hazards/update")
async def update_hazard(node_id: str = Query(...), hazard_type: str = Query(...), severity: float = Query(1.0)):
    """
    Update hazard penalty for a node
    
    Example: POST /api/hazards/update?node_id=N42&hazard_type=smoke&severity=0.8
    
    Hazard types: smoke, crowd, fire, spill, structural
    """
    from api_handlers import HazardUpdate
    
    update = HazardUpdate(
        node_id=node_id,
        hazard_type=hazard_type,
        severity=severity
    )
    
    return hazard_handler.update_hazard(update)


@app.post("/api/hazards/crowd")
async def update_crowd(
    node_id: str = Query(...),
    occupancy_rate: float = Query(..., ge=0, le=100)
):
    """
    Update crowd penalty based on occupancy rate
    
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
