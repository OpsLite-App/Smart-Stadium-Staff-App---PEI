"""
ROUTING SERVICE - Main Application
Only responsible for calculating routes, no emergency management

With Redis Caching:
- GET /api/route (cached 60s - routes don't change often)
- GET /api/route/pgrouting (cached 60s)
- GET /api/route/evacuation (cached 300s - evacuation routes rarely change)
"""

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from typing import Any, Callable, Dict, List, Optional
import httpx
import asyncio
import os
import sys
import logging
import time

# Add parent directory to path to import cache_config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from cache_config import RedisCache
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    print("[WARNING] Redis cache unavailable; continuing without caching")

try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
    METRICS_AVAILABLE = True
except ImportError:
    METRICS_AVAILABLE = False

from astar import Graph, HazardMap, hazard_aware_astar, find_nearest_node, multi_destination_route
from api_handlers import RouteAPIHandler, HazardAPIHandler
from gis import CameraStatusUpdate, GisLayerService
from pgrouting import (
    PgRoutingService,
    EdgeOverrideCreate,
    NodeClosureCreate,
    OperationalEventCreate,
)
from runtime_checks import RuntimeReadinessError
from tracing_config import configure_tracing

# ========== CACHE INITIALIZATION ==========

redis_cache = RedisCache() if CACHE_AVAILABLE else None
logger = logging.getLogger(__name__)


def get_cached_route(cache_key: str) -> Optional[Dict[str, Any]]:
    if not redis_cache:
        return None
    cached = redis_cache.get(cache_key)
    if cached is not None:
        logger.info("Cache hit: %s", cache_key)
    return cached


def set_cached_route(cache_key: str, value: Any, ttl: int) -> None:
    if redis_cache:
        redis_cache.set(cache_key, value, ttl=ttl)


def invalidate_route_cache() -> None:
    if redis_cache:
        redis_cache.clear_pattern("route:*")

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
configure_tracing(app)

if METRICS_AVAILABLE:
    REQUEST_COUNT = Counter(
        "http_requests_total",
        "Total HTTP requests",
        ["service", "method", "path", "status"],
    )
    REQUEST_LATENCY = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency in seconds",
        ["service", "method", "path"],
    )

    @app.middleware("http")
    async def prometheus_metrics_middleware(request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        path = getattr(request.scope.get("route"), "path", request.url.path)
        elapsed = time.perf_counter() - start

        REQUEST_COUNT.labels(
            service="routing-service",
            method=request.method,
            path=path,
            status=str(response.status_code),
        ).inc()
        REQUEST_LATENCY.labels(
            service="routing-service",
            method=request.method,
            path=path,
        ).observe(elapsed)

        return response

    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# ========== CONFIGURATION ==========

MAP_SERVICE_URL = os.getenv("MAP_SERVICE_URL")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8081")
EVACUATION_EXIT_NODE = int(os.getenv("EVACUATION_EXIT_NODE", "65"))


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
        service = PgRoutingService()
        try:
            service.initialize_runtime_tables()
        except Exception as exc:
            raise _wrap_runtime_exception("pgRouting runtime", exc) from exc
        pgrouting_service = service
    return pgrouting_service


def get_gis_layer_service() -> GisLayerService:
    """Lazily initialize GeoJSON access for indoor GIS layers."""
    global gis_layer_service
    if gis_layer_service is None:
        get_pgrouting_service()
        service = GisLayerService()
        try:
            service.initialize_camera_status_table()
        except Exception as exc:
            raise _wrap_runtime_exception("GIS layer runtime", exc) from exc
        gis_layer_service = service
    return gis_layer_service


def _wrap_runtime_exception(component: str, exc: Exception) -> RuntimeReadinessError:
    if isinstance(exc, RuntimeReadinessError):
        return exc

    return RuntimeReadinessError(
        f"{component} is unavailable.",
        suggestion="Check routing-service logs and postgres_map configuration.",
        details={"cause": str(exc)},
    )


def _probe_runtime_component(component: str, loader: Callable[[], object]) -> Dict[str, Any]:
    try:
        loader()
        return {"ready": True}
    except Exception as exc:
        readiness_error = _wrap_runtime_exception(component, exc)
        payload = readiness_error.to_payload()
        payload["ready"] = False
        return payload


def require_pgrouting_service() -> PgRoutingService:
    try:
        return get_pgrouting_service()
    except Exception as exc:
        readiness_error = _wrap_runtime_exception("pgRouting runtime", exc)
        raise HTTPException(status_code=503, detail=readiness_error.to_payload()) from exc


def require_gis_layer_service() -> GisLayerService:
    try:
        return get_gis_layer_service()
    except Exception as exc:
        readiness_error = _wrap_runtime_exception("GIS layer runtime", exc)
        raise HTTPException(status_code=503, detail=readiness_error.to_payload()) from exc


def _parse_node_id(node_id: str) -> int:
    """Accept numeric pgRouting IDs and tolerate old prefixed labels."""
    value = str(node_id).strip()
    if value.upper().startswith("N"):
        value = value[1:]
    if not value.isdigit():
        raise HTTPException(status_code=400, detail=f"Invalid node id: {node_id}")
    return int(value)


def _pgrouting_response_to_legacy_route(route) -> dict:
    """Keep old /api/route consumers working without the legacy Map Service."""
    path = [str(node) for node in route.path]
    return {
        "path": path,
        "distance": route.distance,
        "eta_seconds": route.eta_seconds,
        "instructions": route.instructions,
        "waypoints": [
            {"node_id": node_id, "x": 0, "y": 0}
            for node_id in path
        ],
        "source": "pgrouting",
    }


async def require_supervisor_role(
    authorization: Optional[str] = Header(None),
    cookie: Optional[str] = Header(None),
) -> dict:
    """Validate the current session and allow only supervisor/admin users.

    The web frontend uses an HttpOnly AUTH_TOKEN cookie, while API tools may use
    a Bearer token. Supporting both keeps browser and CLI flows aligned.
    """
    headers = {}
    endpoint = f"{AUTH_SERVICE_URL}/auth/me"
    method = "GET"

    if authorization and authorization.startswith("Bearer "):
        headers["Authorization"] = authorization
        endpoint = f"{AUTH_SERVICE_URL}/auth/validate"
        method = "POST"
    elif cookie and "AUTH_TOKEN=" in cookie:
        headers["Cookie"] = cookie
    else:
        raise HTTPException(status_code=401, detail="Missing authentication")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            if method == "POST":
                response = await client.post(endpoint, headers=headers)
            else:
                response = await client.get(endpoint, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

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
    print("[INFO] Routing Service v2.0 starting")
    print("="*60)
    
    # Initialize hazard map
    HAZARD_MAP = HazardMap()
    print("[INFO] Hazard map initialized")
    
    try:
        get_pgrouting_service()
        print("[INFO] pgRouting runtime tables ready")
    except RuntimeReadinessError as exc:
        print(f"[WARNING] pgRouting runtime tables unavailable: {exc.message}")

    try:
        get_gis_layer_service()
        print("[INFO] Indoor GIS layers ready")
    except RuntimeReadinessError as exc:
        print(f"[WARNING] Indoor GIS layers unavailable: {exc.message}")
    
    if GRAPH:
        # Initialize API handlers (ONLY route and hazard)
        route_handler = RouteAPIHandler(GRAPH, HAZARD_MAP)
        hazard_handler = HazardAPIHandler(HAZARD_MAP)
        print("[INFO] API handlers initialized")
        
        print("\n" + "="*60)
        print("[INFO] Routing Service ready")
        print(f"   - Nodes: {len(GRAPH.nodes)}")
        print(f"   - Edges: {sum(len(v) for v in GRAPH.adjacency.values())}")
        print(f"   - Legacy Map Service: {MAP_SERVICE_URL or 'disabled'}")
        print("="*60 + "\n")
    else:
        print("\n[INFO] Routing Service ready")
        print("   - Active mode: PostGIS/pgRouting + GIS layers")
        print("   - Legacy Map Service graph disabled")
        print("="*60 + "\n")


async def load_graph_from_map_service():
    """Fetch graph data from Map Service"""
    global GRAPH

    if not MAP_SERVICE_URL:
        print("[INFO] Legacy Map Service disabled; skipping graph load")
        return False
    
    try:
        print(f"[INFO] Fetching graph from {MAP_SERVICE_URL}/api/map")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{MAP_SERVICE_URL}/api/map")
            data = response.json()
            
            nodes = data.get('nodes', [])
            edges = data.get('edges', [])
            closures = data.get('closures', [])
            
            # Build graph
            GRAPH = Graph(nodes, edges)
            print(f"[INFO] Graph loaded: nodes={len(nodes)} edges={len(edges)}")
            
            # Load closures
            if closures:
                for closure in closures:
                    if closure.get('edge_id'):
                        edge = next((e for e in edges if e['id'] == closure['edge_id']), None)
                        if edge:
                            HAZARD_MAP.add_closure(edge['from'], edge['to'])
                print(f"[INFO] Loaded closures: count={len(closures)}")
            
            return True
            
    except Exception as e:
        print(f"[ERROR] Failed to load graph: {e}")
        return False


# ========== HEALTH & STATUS ==========

@app.get("/")
async def root():
    """Health check"""
    runtime = {
        "pgrouting": _probe_runtime_component("pgRouting runtime", get_pgrouting_service),
        "gis": _probe_runtime_component("GIS layer runtime", get_gis_layer_service),
    }
    runtime_ready = runtime["pgrouting"]["ready"] and runtime["gis"]["ready"]
    status = "running" if GRAPH and runtime_ready else "degraded" if GRAPH or not runtime_ready else "ready"
    mode = "legacy_graph_and_pgrouting" if GRAPH and runtime_ready else "legacy_graph" if GRAPH else "pgrouting_gis"

    return {
        "service": "Routing Service",
        "version": "2.0.0",
        "status": status,
        "mode": mode,
        "nodes": len(GRAPH.nodes) if GRAPH else 0,
        "closures": len(HAZARD_MAP.closures) // 2 if HAZARD_MAP else 0,
        "legacy_map_service": MAP_SERVICE_URL or "disabled",
        "pgrouting_ready": runtime["pgrouting"]["ready"],
        "gis_ready": runtime["gis"]["ready"],
        "runtime": runtime,
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    runtime = {
        "pgrouting": _probe_runtime_component("pgRouting runtime", get_pgrouting_service),
        "gis": _probe_runtime_component("GIS layer runtime", get_gis_layer_service),
    }
    runtime_ready = runtime["pgrouting"]["ready"] and runtime["gis"]["ready"]

    if not GRAPH:
        if runtime_ready:
            return {
                "status": "healthy",
                "mode": "pgrouting_gis",
                "message": "Legacy Map Service graph not loaded, but PostGIS/pgRouting endpoints are ready",
                "graph": {
                    "legacy_loaded": False,
                    "nodes": 0,
                    "adjacency_entries": 0,
                },
                "pgrouting_ready": True,
                "gis_ready": True,
                "runtime": runtime,
                "legacy_map_service": MAP_SERVICE_URL or "disabled",
            }

        return {
            "status": "degraded",
            "mode": "pgrouting_gis",
            "message": "Active PostGIS/pgRouting runtime is unavailable",
            "runtime": runtime,
            "pgrouting_ready": runtime["pgrouting"]["ready"],
            "gis_ready": runtime["gis"]["ready"],
            "legacy_map_service": MAP_SERVICE_URL or "disabled",
        }
    
    return {
        "status": "healthy" if runtime_ready else "degraded",
        "mode": "legacy_graph_and_pgrouting" if runtime_ready else "legacy_graph",
        "graph": {
            "nodes": len(GRAPH.nodes),
            "adjacency_entries": len(GRAPH.adjacency)
        },
        "hazards": {
            "closures": len(HAZARD_MAP.closures) // 2,
            "node_hazards": len(HAZARD_MAP.node_hazards),
            "edge_hazards": len(HAZARD_MAP.edge_hazards) // 2
        },
        "pgrouting_ready": runtime["pgrouting"]["ready"],
        "gis_ready": runtime["gis"]["ready"],
        "runtime": runtime,
    }


@app.post("/api/reload")
async def reload_graph():
    """Reload graph from Map Service"""
    if not MAP_SERVICE_URL:
        raise HTTPException(status_code=410, detail="Legacy Map Service graph is disabled")

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
    
    Example: /api/route?from_node=62&to_node=70&avoid_crowds=true
    """
    if not GRAPH:
        start_node = _parse_node_id(from_node)
        end_node = _parse_node_id(to_node)
        cache_key = f"route:legacy:{start_node}:{end_node}:{avoid_crowds}"
        cached = get_cached_route(cache_key)
        if cached is not None:
            return cached

        service = require_pgrouting_service()
        route = service.get_route(start_node, end_node)
        response = _pgrouting_response_to_legacy_route(route)
        set_cached_route(cache_key, response, ttl=60)
        return response
    
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
    to_node: int = Query(..., description="End node ID from PostGIS/pgRouting graph"),
    allow_blocked: bool = Query(False, description="Whether to allow traversing blocked/disabled edges")
):
    """
    Calculate an indoor route directly with pgRouting.

    Example: /api/route/pgrouting?from_node=63&to_node=71&allow_blocked=true
    """
    cache_key = f"route:pgrouting:{from_node}:{to_node}:{allow_blocked}"
    cached = get_cached_route(cache_key)
    if cached is not None:
        return cached

    service = require_pgrouting_service()
    result = service.get_route(from_node, to_node, allow_blocked=allow_blocked)
    set_cached_route(cache_key, result, ttl=60)
    return result


@app.get("/api/route/pgrouting/geojson")
async def get_pgrouting_route_geojson(
    from_node: int = Query(..., description="Start node ID from PostGIS/pgRouting graph"),
    to_node: int = Query(..., description="End node ID from PostGIS/pgRouting graph"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
    allow_blocked: bool = Query(False, description="Whether to allow traversing blocked/disabled edges")
):
    """
    Calculate an indoor route between two pgRouting nodes and return route edges as GeoJSON.
    Results are cached for 60 seconds (routes don't change often in the same session).
    """
    # Build cache key - routes are symmetric, so we cache both directions
    cache_key = f"route:pgrouting:geojson:{min(from_node, to_node)}:{max(from_node, to_node)}:{srid}:{allow_blocked}"
    
    cached = get_cached_route(cache_key)
    if cached is not None:
        return cached
    
    service = require_pgrouting_service()
    result = service.get_route_geojson(from_node, to_node, output_srid=srid, allow_blocked=allow_blocked)
    
    set_cached_route(cache_key, result, ttl=60)
    
    return result


@app.get("/api/route/pgrouting/combined")
async def get_combined_pgrouting_route(
    from_node: int = Query(..., description="Start node ID from the combined outdoor-indoor graph"),
    to_node: int = Query(..., description="End node ID from the combined outdoor-indoor graph")
):
    """
    Calculate a route across the combined outdoor and indoor graph.

    Example: /api/route/pgrouting/combined?from_node=1003&to_node=71
    """
    service = require_pgrouting_service()
    return service.get_combined_route(from_node, to_node)


@app.get("/api/pois")
async def get_pois():
    """Return indoor POIs from the real PostGIS database."""
    service = require_pgrouting_service()
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
    service = require_pgrouting_service()
    return service.get_route_by_poi(from_poi_id, to_poi_id)


@app.get("/api/route/pgrouting/by-poi/geojson")
async def get_pgrouting_route_by_poi_geojson(
    from_poi_id: int = Query(..., description="Start POI ID"),
    to_poi_id: int = Query(..., description="End POI ID"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Calculate an indoor route between two POIs and return route edges as GeoJSON."""
    service = require_pgrouting_service()
    return service.get_route_geojson_by_poi(from_poi_id, to_poi_id, output_srid=srid)


@app.get("/api/graph/status")
async def get_graph_status():
    """Return a minimal graph status payload for frontend use."""
    service = require_pgrouting_service()
    return service.get_graph_status()


@app.get("/api/graph/edge-overrides")
async def list_edge_overrides():
    """List live edge overrides used by routing."""
    service = require_pgrouting_service()
    return service.list_edge_overrides()


@app.post("/api/graph/edge-overrides")
async def create_edge_override(payload: EdgeOverrideCreate):
    """Create a live edge override for blocked paths or congestion."""
    service = require_pgrouting_service()
    result = service.create_edge_override(payload)
    invalidate_route_cache()
    return result


@app.post("/api/graph/node-closures")
async def create_node_closure(payload: NodeClosureCreate):
    """Create live edge overrides for every corridor connected to a node."""
    service = require_pgrouting_service()
    result = service.create_node_closure(payload)
    invalidate_route_cache()
    return result


@app.post("/api/graph/edge-overrides/deactivate-by-source")
async def deactivate_edge_overrides_by_source(source: str = Query(...)):
    """Deactivate live edge overrides created by a specific subsystem/source."""
    service = require_pgrouting_service()
    result = service.deactivate_edge_overrides_by_source(source)
    invalidate_route_cache()
    return result


@app.get("/api/graph/events")
async def list_operational_events():
    """List active and historical operational events."""
    service = require_pgrouting_service()
    return service.list_operational_events()


@app.post("/api/graph/events")
async def create_operational_event(payload: OperationalEventCreate):
    """Create a minimal operational monitoring event."""
    service = require_pgrouting_service()
    result = service.create_operational_event(payload)
    invalidate_route_cache()
    return result


@app.post("/api/graph/events/deactivate-by-source")
async def deactivate_operational_events_by_source(source: str = Query(...)):
    """Deactivate active operational events created by a specific source."""
    service = require_pgrouting_service()
    result = service.deactivate_operational_events_by_source(source)
    invalidate_route_cache()
    return result


# ========== GIS LAYER ENDPOINTS ==========

@app.get("/api/gis/rooms")
async def get_gis_rooms(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return room polygons as GeoJSON."""
    service = require_gis_layer_service()
    return service.get_feature_collection("rooms", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/corridors")
async def get_gis_corridors(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return corridor polygons as GeoJSON."""
    service = require_gis_layer_service()
    return service.get_feature_collection("corridors", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/nodes")
async def get_gis_nodes(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return routing graph nodes as GeoJSON points."""
    service = require_gis_layer_service()
    return service.get_feature_collection("nodes", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/pois")
async def get_gis_pois(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return POIs as GeoJSON points."""
    service = require_gis_layer_service()
    return service.get_feature_collection("pois", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/cameras")
async def get_gis_cameras(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return camera point infrastructure as GeoJSON."""
    service = require_gis_layer_service()
    return service.get_feature_collection("cameras", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/camera-coverage")
async def get_gis_camera_coverage(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return camera coverage polygons as GeoJSON."""
    service = require_gis_layer_service()
    return service.get_feature_collection("camera_coverage", floor_id=floor_id, output_srid=srid)


@app.get("/api/gis/camera-status")
async def get_gis_camera_status(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
):
    """Return live camera monitoring state keyed by real camera IDs."""
    service = require_gis_layer_service()
    return service.get_camera_status(floor_id=floor_id)


@app.get("/api/gis/impacted-edges")
async def get_gis_impacted_edges(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return active graph edge overrides as GeoJSON."""
    service = require_gis_layer_service()
    return service.get_impacted_edges(floor_id=floor_id, output_srid=srid)


@app.put("/api/gis/camera-status/{camera_id}")
async def update_gis_camera_status(
    camera_id: int,
    payload: CameraStatusUpdate,
    _: dict = Depends(require_supervisor_role),
):
    """Update persisted monitoring state for one camera."""
    service = require_gis_layer_service()
    try:
        result = service.update_camera_status(camera_id, payload)
        invalidate_route_cache()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/gis/vertical-transitions")
async def get_gis_vertical_transitions(
    floor_id: Optional[int] = Query(None, description="Optional floor filter"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
):
    """Return stairs/lifts/floor transitions as GeoJSON."""
    service = require_gis_layer_service()
    return service.get_feature_collection("vertical_transitions", floor_id=floor_id, output_srid=srid)


@app.post("/api/route/multi")
async def multi_destination_route(from_node: str = Query(...), to_nodes: List[str] = Query(...)):
    """
    Calculate route visiting multiple destinations
    
    Example: POST /api/route/multi?from_node=62&to_nodes=65&to_nodes=70
    """
    if not GRAPH:
        raise HTTPException(status_code=410, detail="Legacy multi-destination routing is disabled; use pgRouting endpoints")
    
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
        raise HTTPException(status_code=410, detail="Legacy coordinate lookup is disabled; use GIS/pgRouting endpoints")

    best_node = min(
        GRAPH.nodes.items(),
        key=lambda item: (item[1].x - x) ** 2 + (item[1].y - y) ** 2
    )
    return {"node_id": best_node[0], "x": best_node[1].x, "y": best_node[1].y}


@app.post("/api/route/nearest")
async def find_nearest(target: str = Query(...), candidates: List[str] = Query(...)):
    """
    Find nearest node from a list of candidates
    
    Example: POST /api/route/nearest?target=62&candidates=65&candidates=70
    """
    if not GRAPH:
        raise HTTPException(status_code=410, detail="Legacy nearest-node routing is disabled; use pgRouting endpoints")
    
    from api_handlers import NearestRequest
    
    request = NearestRequest(
        target=target,
        candidates=candidates
    )
    
    return route_handler.find_nearest_node_handler(request)


@app.get("/api/route/evacuation")
async def evacuation_route(from_node: str = Query(..., description="Current position")):
    """
    Find safest evacuation route to the fixed IT entrance/exit.
    
    Example: /api/route/evacuation?from_node=62
    """
    if not GRAPH:
        start_node = _parse_node_id(from_node)
        cache_key = f"route:evacuation:{start_node}:{EVACUATION_EXIT_NODE}"
        cached = get_cached_route(cache_key)
        if cached is not None:
            return cached

        service = require_pgrouting_service()
        route = service.get_route(start_node, EVACUATION_EXIT_NODE)
        response = _pgrouting_response_to_legacy_route(route)
        response["exit_node"] = str(EVACUATION_EXIT_NODE)
        response["route_type"] = "evacuation"
        set_cached_route(cache_key, response, ttl=300)
        return response

    exit_nodes = [str(EVACUATION_EXIT_NODE)]
    
    return route_handler.get_evacuation_route(from_node, exit_nodes)


@app.get("/api/route/evacuation/geojson")
async def evacuation_route_geojson(
    from_node: int = Query(..., description="Current pgRouting node"),
    srid: int = Query(4326, description="Output SRID for GeoJSON coordinates"),
    allow_blocked: bool = Query(True, description="Whether to route through blocked edges with high cost as a last resort"),
):
    """
    Return evacuation route geometry to the fixed IT entrance node.
    Results are cached for 300 seconds (evacuation routes are static).
    """
    # Build cache key
    cache_key = f"route:evacuation:geojson:{from_node}:{srid}:{allow_blocked}"
    
    cached = get_cached_route(cache_key)
    if cached is not None:
        return cached
    
    service = require_pgrouting_service()
    result = service.get_route_geojson(from_node, EVACUATION_EXIT_NODE, output_srid=srid, allow_blocked=allow_blocked)
    result.summary["exit_node"] = EVACUATION_EXIT_NODE
    result.summary["route_type"] = "evacuation"
    
    set_cached_route(cache_key, result, ttl=300)
    
    return result


# ========== HAZARD MANAGEMENT ==========

@app.post("/api/hazards/closure")
async def add_closure(from_node: str = Query(...), to_node: str = Query(...)):
    """
    Add corridor closure (e.g., during evacuation)
    
    Example: POST /api/hazards/closure?from_node=63&to_node=70
    """
    if not hazard_handler:
        return {
            "status": "ignored",
            "mode": "pgrouting_gis",
            "message": "Legacy in-memory hazard graph is disabled; use /api/graph/edge-overrides for pgRouting impacts",
            "from_node": from_node,
            "to_node": to_node,
        }
    return hazard_handler.add_closure(from_node, to_node)


@app.delete("/api/hazards/closure")
async def remove_closure(from_node: str = Query(...), to_node: str = Query(...)):
    """Remove corridor closure"""
    if not hazard_handler:
        return {
            "status": "ignored",
            "mode": "pgrouting_gis",
            "from_node": from_node,
            "to_node": to_node,
        }
    return hazard_handler.remove_closure(from_node, to_node)


@app.post("/api/hazards/update")
async def update_hazard(node_id: str = Query(...), hazard_type: str = Query(...), severity: float = Query(1.0)):
    """
    Update hazard penalty for a node
    
    Example: POST /api/hazards/update?node_id=62&hazard_type=smoke&severity=0.8
    
    Hazard types: smoke, crowd, fire, spill, structural
    """
    from api_handlers import HazardUpdate

    if not hazard_handler:
        return {
            "status": "ignored",
            "mode": "pgrouting_gis",
            "message": "Legacy in-memory hazard graph is disabled; use operational events or edge overrides",
            "node_id": node_id,
            "hazard_type": hazard_type,
            "severity": severity,
        }
    
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
    
    Example: POST /api/hazards/crowd?node_id=62&occupancy_rate=85
    """
    if not hazard_handler:
        return {
            "status": "ignored",
            "mode": "pgrouting_gis",
            "node_id": node_id,
            "occupancy_rate": occupancy_rate,
        }
    return hazard_handler.update_crowd_penalty(node_id, occupancy_rate)


@app.delete("/api/hazards/clear")
async def clear_hazards(node_id: str = Query(...)):
    """Clear all hazards from a node"""
    if not hazard_handler:
        return {
            "status": "ignored",
            "mode": "pgrouting_gis",
            "node_id": node_id,
        }
    return hazard_handler.clear_hazards(node_id)


@app.get("/api/hazards/status")
async def hazard_status():
    """Get summary of current hazards"""
    if not hazard_handler:
        return {
            "mode": "pgrouting_gis",
            "closures": 0,
            "node_hazards": 0,
            "edge_hazards": 0,
            "message": "Legacy in-memory hazard graph is disabled",
        }
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
