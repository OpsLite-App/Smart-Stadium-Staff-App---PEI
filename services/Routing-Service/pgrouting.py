"""
Direct pgRouting integration for indoor routes stored in PostGIS.
"""

from typing import Dict, List, Optional

from fastapi import HTTPException
from pydantic import BaseModel

from astar import calculate_eta
from db import get_connection


class PgRoutingRouteResponse(BaseModel):
    start_node: int
    end_node: int
    path: List[int]
    distance: float
    eta_seconds: int
    instructions: List[str]


class PoiResponse(BaseModel):
    id: int
    name: str
    node_id: int
    floor_id: int
    category: str


class GraphStatusResponse(BaseModel):
    status: str
    nodes: int
    edges: int
    floors: int
    pois: int
    blocked_edges: int
    cost_overrides: int
    active_alerts: int
    updated_at: Optional[str]


class EdgeOverrideBase(BaseModel):
    edge_id: int
    is_blocked: bool = False
    cost_multiplier: float = 1.0
    reason: Optional[str] = None
    source: str = "manual"
    severity: float = 0.5
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    is_active: bool = True


class EdgeOverrideCreate(EdgeOverrideBase):
    pass


class EdgeOverrideResponse(EdgeOverrideBase):
    id: int


class OperationalEventCreate(BaseModel):
    event_type: str
    title: str
    description: Optional[str] = None
    severity: float = 0.5
    status: str = "active"
    source: str = "manual"
    floor_id: Optional[int] = None
    edge_id: Optional[int] = None
    poi_id: Optional[int] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None


class OperationalEventResponse(OperationalEventCreate):
    id: int
    is_active: bool = True


class PgRoutingService:
    """Compute routes directly in PostgreSQL using pgRouting."""

    ROUTE_SQL = """
        WITH route AS (
            SELECT *
            FROM pgr_dijkstra(
                '
                SELECT
                    e.edge_id AS id,
                    e.from_node AS source,
                    e.to_node AS target,
                    e.cost * COALESCE(ao.cost_multiplier, 1.0) AS cost,
                    e.cost * COALESCE(ao.cost_multiplier, 1.0) AS reverse_cost
                FROM edges e
                LEFT JOIN (
                    SELECT
                        edge_id,
                        BOOL_OR(is_blocked) AS is_blocked,
                        MAX(cost_multiplier) AS cost_multiplier
                    FROM graph_edge_overrides
                    WHERE is_active = TRUE
                      AND (starts_at IS NULL OR starts_at <= NOW())
                      AND (ends_at IS NULL OR ends_at >= NOW())
                    GROUP BY edge_id
                ) ao ON ao.edge_id = e.edge_id
                WHERE COALESCE(ao.is_blocked, FALSE) = FALSE
                ',
                %s,
                %s,
                directed := false
            )
        ),
        ordered_route AS (
            SELECT
                route.*,
                LEAD(route.node) OVER (ORDER BY route.seq) AS next_node
            FROM route
        )
        SELECT
            ordered_route.seq,
            ordered_route.path_seq,
            ordered_route.node AS current_node,
            ordered_route.next_node,
            ordered_route.edge,
            ordered_route.cost,
            ordered_route.agg_cost,
            e.edge_id,
            e.from_node,
            e.to_node,
            e.length,
            e.type,
            e.floor_id,
            current_nodes.floor_id AS current_floor_id,
            next_nodes.floor_id AS next_floor_id
        FROM ordered_route
        LEFT JOIN edges e ON ordered_route.edge = e.edge_id
        LEFT JOIN nodes current_nodes ON ordered_route.node = current_nodes.node_id
        LEFT JOIN nodes next_nodes ON ordered_route.next_node = next_nodes.node_id
        WHERE ordered_route.edge <> -1
        ORDER BY ordered_route.seq
    """

    NODE_SQL = """
        SELECT node_id, floor_id, type
        FROM nodes
        WHERE node_id = ANY(%s)
    """

    POIS_SQL = """
        SELECT id, name, node_id, floor_id, category
        FROM "POIs"
        ORDER BY floor_id, id
    """

    POI_BY_IDS_SQL = """
        SELECT id, name, node_id, floor_id, category
        FROM "POIs"
        WHERE id = ANY(%s)
    """

    GRAPH_STATUS_SQL = """
        WITH active_overrides AS (
            SELECT *
            FROM graph_edge_overrides
            WHERE is_active = TRUE
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
        ),
        active_events AS (
            SELECT *
            FROM operational_events
            WHERE is_active = TRUE
              AND status = 'active'
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
        )
        SELECT
            (SELECT COUNT(*) FROM nodes) AS nodes,
            (SELECT COUNT(*) FROM edges) AS edges,
            (SELECT COUNT(*) FROM floors) AS floors,
            (SELECT COUNT(*) FROM "POIs") AS pois,
            (SELECT COUNT(DISTINCT edge_id) FROM active_overrides WHERE is_blocked = TRUE) AS blocked_edges,
            (SELECT COUNT(DISTINCT edge_id) FROM active_overrides WHERE is_blocked = FALSE AND cost_multiplier > 1.0) AS cost_overrides,
            (SELECT COUNT(*) FROM active_events) AS active_alerts,
            (SELECT COUNT(*) FROM active_events WHERE event_type = 'hazard' AND severity >= 0.8) AS severe_hazards,
            GREATEST(
                COALESCE((SELECT MAX(updated_at) FROM active_overrides), NOW()),
                COALESCE((SELECT MAX(updated_at) FROM active_events), NOW())
            ) AS updated_at
    """

    CREATE_EDGE_OVERRIDES_SQL = """
        CREATE TABLE IF NOT EXISTS graph_edge_overrides (
            id BIGSERIAL PRIMARY KEY,
            edge_id INTEGER NOT NULL,
            is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
            cost_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            reason TEXT,
            source VARCHAR(50) NOT NULL DEFAULT 'manual',
            severity DOUBLE PRECISION NOT NULL DEFAULT 0.5,
            starts_at TIMESTAMPTZ NULL,
            ends_at TIMESTAMPTZ NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    CREATE_OPERATIONAL_EVENTS_SQL = """
        CREATE TABLE IF NOT EXISTS operational_events (
            id BIGSERIAL PRIMARY KEY,
            event_type VARCHAR(50) NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            severity DOUBLE PRECISION NOT NULL DEFAULT 0.5,
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            source VARCHAR(50) NOT NULL DEFAULT 'manual',
            floor_id INTEGER NULL,
            edge_id INTEGER NULL,
            poi_id INTEGER NULL,
            starts_at TIMESTAMPTZ NULL,
            ends_at TIMESTAMPTZ NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    CREATE_EDGE_OVERRIDE_INDEX_SQL = """
        CREATE INDEX IF NOT EXISTS idx_graph_edge_overrides_active
        ON graph_edge_overrides (edge_id, is_active, starts_at, ends_at)
    """

    CREATE_OPERATIONAL_EVENTS_INDEX_SQL = """
        CREATE INDEX IF NOT EXISTS idx_operational_events_active
        ON operational_events (status, is_active, starts_at, ends_at)
    """

    INSERT_EDGE_OVERRIDE_SQL = """
        INSERT INTO graph_edge_overrides (
            edge_id, is_blocked, cost_multiplier, reason, source, severity,
            starts_at, ends_at, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, edge_id, is_blocked, cost_multiplier, reason, source,
                  severity, starts_at, ends_at, is_active
    """

    LIST_EDGE_OVERRIDES_SQL = """
        SELECT id, edge_id, is_blocked, cost_multiplier, reason, source,
               severity, starts_at, ends_at, is_active
        FROM graph_edge_overrides
        ORDER BY created_at DESC, id DESC
    """

    INSERT_OPERATIONAL_EVENT_SQL = """
        INSERT INTO operational_events (
            event_type, title, description, severity, status, source,
            floor_id, edge_id, poi_id, starts_at, ends_at, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
        RETURNING id, event_type, title, description, severity, status, source,
                  floor_id, edge_id, poi_id, starts_at, ends_at, is_active
    """

    LIST_OPERATIONAL_EVENTS_SQL = """
        SELECT id, event_type, title, description, severity, status, source,
               floor_id, edge_id, poi_id, starts_at, ends_at, is_active
        FROM operational_events
        ORDER BY created_at DESC, id DESC
    """

    def initialize_runtime_tables(self) -> None:
        """Create runtime tables used for live updates if they do not exist yet."""
        with get_connection() as conn:
            conn.execute(self.CREATE_EDGE_OVERRIDES_SQL)
            conn.execute(self.CREATE_OPERATIONAL_EVENTS_SQL)
            conn.execute(self.CREATE_EDGE_OVERRIDE_INDEX_SQL)
            conn.execute(self.CREATE_OPERATIONAL_EVENTS_INDEX_SQL)
            conn.commit()

    def get_route(self, from_node: int, to_node: int) -> PgRoutingRouteResponse:
        """Calculate a route and generate simple human-readable instructions."""
        with get_connection() as conn:
            return self._build_route_response(conn, from_node, to_node)

    def get_route_by_poi(self, from_poi_id: int, to_poi_id: int) -> PgRoutingRouteResponse:
        """Resolve POIs to graph nodes and calculate a route between them."""
        with get_connection() as conn:
            poi_rows = conn.execute(self.POI_BY_IDS_SQL, ([from_poi_id, to_poi_id],)).fetchall()

            poi_lookup = {int(row["id"]): row for row in poi_rows}
            if from_poi_id not in poi_lookup:
                raise HTTPException(status_code=404, detail=f"Start POI {from_poi_id} not found")
            if to_poi_id not in poi_lookup:
                raise HTTPException(status_code=404, detail=f"End POI {to_poi_id} not found")

            from_node = int(poi_lookup[from_poi_id]["node_id"])
            to_node = int(poi_lookup[to_poi_id]["node_id"])
            return self._build_route_response(conn, from_node, to_node)

    def list_pois(self) -> List[PoiResponse]:
        """Return indoor POIs from the real PostGIS database."""
        with get_connection() as conn:
            rows = conn.execute(self.POIS_SQL).fetchall()

        return [
            PoiResponse(
                id=int(row["id"]),
                name=row["name"],
                node_id=int(row["node_id"]),
                floor_id=int(row["floor_id"]),
                category=row["category"],
            )
            for row in rows
        ]

    def get_graph_status(self) -> GraphStatusResponse:
        """Return a minimal graph status payload for frontend use."""
        with get_connection() as conn:
            row = conn.execute(self.GRAPH_STATUS_SQL).fetchone()

        if not row:
            raise HTTPException(status_code=503, detail="Graph status unavailable")

        blocked_edges = int(row["blocked_edges"])
        cost_overrides = int(row["cost_overrides"])
        active_alerts = int(row["active_alerts"])
        severe_hazards = int(row["severe_hazards"])

        if severe_hazards > 0 or blocked_edges >= 3:
            status = "critical"
        elif blocked_edges > 0 or cost_overrides > 0 or active_alerts > 0:
            status = "degraded"
        else:
            status = "healthy"

        return GraphStatusResponse(
            status=status,
            nodes=int(row["nodes"]),
            edges=int(row["edges"]),
            floors=int(row["floors"]),
            pois=int(row["pois"]),
            blocked_edges=blocked_edges,
            cost_overrides=cost_overrides,
            active_alerts=active_alerts,
            updated_at=row["updated_at"].isoformat() if row["updated_at"] else None,
        )

    def create_edge_override(self, payload: EdgeOverrideCreate) -> EdgeOverrideResponse:
        """Create a live edge override used by routing."""
        if not payload.is_blocked and payload.cost_multiplier < 1.0:
            raise HTTPException(status_code=400, detail="cost_multiplier must be >= 1.0")

        with get_connection() as conn:
            edge_exists = conn.execute(
                "SELECT 1 FROM edges WHERE edge_id = %s",
                (payload.edge_id,),
            ).fetchone()
            if not edge_exists:
                raise HTTPException(status_code=404, detail=f"Edge {payload.edge_id} not found")

            row = conn.execute(
                self.INSERT_EDGE_OVERRIDE_SQL,
                (
                    payload.edge_id,
                    payload.is_blocked,
                    payload.cost_multiplier,
                    payload.reason,
                    payload.source,
                    payload.severity,
                    payload.starts_at,
                    payload.ends_at,
                    payload.is_active,
                ),
            ).fetchone()
            conn.commit()

        return self._to_edge_override_response(row)

    def list_edge_overrides(self) -> List[EdgeOverrideResponse]:
        """List all configured edge overrides."""
        with get_connection() as conn:
            rows = conn.execute(self.LIST_EDGE_OVERRIDES_SQL).fetchall()
        return [self._to_edge_override_response(row) for row in rows]

    def create_operational_event(self, payload: OperationalEventCreate) -> OperationalEventResponse:
        """Create a minimal operational event for monitoring."""
        with get_connection() as conn:
            row = conn.execute(
                self.INSERT_OPERATIONAL_EVENT_SQL,
                (
                    payload.event_type,
                    payload.title,
                    payload.description,
                    payload.severity,
                    payload.status,
                    payload.source,
                    payload.floor_id,
                    payload.edge_id,
                    payload.poi_id,
                    payload.starts_at,
                    payload.ends_at,
                ),
            ).fetchone()
            conn.commit()

        return self._to_operational_event_response(row)

    def list_operational_events(self) -> List[OperationalEventResponse]:
        """List operational monitoring events."""
        with get_connection() as conn:
            rows = conn.execute(self.LIST_OPERATIONAL_EVENTS_SQL).fetchall()
        return [self._to_operational_event_response(row) for row in rows]

    def _build_route_response(self, conn, from_node: int, to_node: int) -> PgRoutingRouteResponse:
        node_metadata = self._fetch_node_metadata(conn, [from_node, to_node])
        self._validate_nodes(from_node, to_node, node_metadata)

        route_rows = conn.execute(self.ROUTE_SQL, (from_node, to_node)).fetchall()

        if not route_rows:
            raise HTTPException(status_code=404, detail="No path found between the selected nodes")

        path = self._build_path(from_node, route_rows)
        distance = round(sum(float(row["length"] or 0.0) for row in route_rows), 2)
        instructions = self._build_instructions(
            start_floor=node_metadata[from_node].get("floor_id"),
            route_rows=route_rows,
        )

        return PgRoutingRouteResponse(
            start_node=from_node,
            end_node=to_node,
            path=path,
            distance=distance,
            eta_seconds=calculate_eta(distance),
            instructions=instructions,
        )

    def _fetch_node_metadata(self, conn, node_ids: List[int]) -> Dict[int, Dict]:
        rows = conn.execute(self.NODE_SQL, (node_ids,)).fetchall()
        return {int(row["node_id"]): row for row in rows}

    def _validate_nodes(self, from_node: int, to_node: int, node_metadata: Dict[int, Dict]) -> None:
        if from_node not in node_metadata:
            raise HTTPException(status_code=404, detail=f"Start node {from_node} not found")
        if to_node not in node_metadata:
            raise HTTPException(status_code=404, detail=f"End node {to_node} not found")

    def _build_path(self, from_node: int, route_rows: List[Dict]) -> List[int]:
        path = [from_node]
        for row in route_rows:
            next_node = row.get("next_node")
            if next_node is None:
                continue
            next_node = int(next_node)
            if path[-1] != next_node:
                path.append(next_node)
        return path

    def _build_instructions(self, start_floor: int | None, route_rows: List[Dict]) -> List[str]:
        instructions: List[str] = []
        instructions.append(
            f"Start on floor {start_floor}" if start_floor is not None else "Start at the selected origin"
        )

        continuous_distance = 0.0
        corridor_like = True
        current_floor = start_floor

        def flush_continuous_segment():
            nonlocal continuous_distance, corridor_like
            if continuous_distance <= 0:
                return

            meters = max(1, round(continuous_distance))
            if corridor_like:
                instructions.append(
                    f"Continue through the corridor for approximately {self._format_meters(meters)}"
                )
            else:
                instructions.append(
                    f"Continue for approximately {self._format_meters(meters)}"
                )
            continuous_distance = 0.0
            corridor_like = True

        for row in route_rows:
            edge_type = (row.get("type") or "").strip().lower()
            segment_length = float(row.get("length") or 0.0)
            next_floor = row.get("next_floor_id")

            is_stairs = (
                "escad" in edge_type
                or "stair" in edge_type
                or (
                    current_floor is not None
                    and next_floor is not None
                    and int(next_floor) != int(current_floor)
                )
            )

            if is_stairs:
                flush_continuous_segment()
                if next_floor is not None and next_floor != current_floor:
                    instructions.append(f"Use the stairs to go to floor {int(next_floor)}")
                else:
                    instructions.append("Use the stairs")
                if next_floor is not None:
                    current_floor = int(next_floor)
                continue

            continuous_distance += segment_length
            corridor_like = corridor_like and self._is_corridor_like(edge_type)
            if next_floor is not None:
                current_floor = int(next_floor)

        flush_continuous_segment()
        instructions.append("You have arrived at your destination")
        return instructions

    def _is_corridor_like(self, edge_type: str) -> bool:
        return any(token in edge_type for token in ("corredor", "corridor", "hall", "entrada", "cruz"))

    def _format_meters(self, meters: int) -> str:
        unit = "meter" if meters == 1 else "meters"
        return f"{meters} {unit}"

    def _to_edge_override_response(self, row: Dict) -> EdgeOverrideResponse:
        return EdgeOverrideResponse(
            id=int(row["id"]),
            edge_id=int(row["edge_id"]),
            is_blocked=bool(row["is_blocked"]),
            cost_multiplier=float(row["cost_multiplier"]),
            reason=row["reason"],
            source=row["source"],
            severity=float(row["severity"]),
            starts_at=row["starts_at"].isoformat() if row["starts_at"] else None,
            ends_at=row["ends_at"].isoformat() if row["ends_at"] else None,
            is_active=bool(row["is_active"]),
        )

    def _to_operational_event_response(self, row: Dict) -> OperationalEventResponse:
        return OperationalEventResponse(
            id=int(row["id"]),
            event_type=row["event_type"],
            title=row["title"],
            description=row["description"],
            severity=float(row["severity"]),
            status=row["status"],
            source=row["source"],
            floor_id=int(row["floor_id"]) if row["floor_id"] is not None else None,
            edge_id=int(row["edge_id"]) if row["edge_id"] is not None else None,
            poi_id=int(row["poi_id"]) if row["poi_id"] is not None else None,
            starts_at=row["starts_at"].isoformat() if row["starts_at"] else None,
            ends_at=row["ends_at"].isoformat() if row["ends_at"] else None,
            is_active=bool(row["is_active"]),
        )
