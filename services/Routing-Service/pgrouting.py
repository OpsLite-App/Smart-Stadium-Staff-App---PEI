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


class PgRoutingRouteGeoJsonResponse(BaseModel):
    route: Dict
    summary: Dict


class PoiResponse(BaseModel):
    id: int
    name: str
    node_id: int
    floor_id: int
    category: str
    room_code: Optional[str] = None
    room_name: Optional[str] = None
    room_type: Optional[str] = None


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

    CREATE_PGROUTING_EXTENSION_SQL = """
        CREATE EXTENSION IF NOT EXISTS pgrouting
    """

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

    ROUTE_GEOJSON_SQL = """
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
        ),
        active_overrides AS (
            SELECT DISTINCT ON (edge_id)
                edge_id,
                is_blocked,
                cost_multiplier,
                reason,
                source,
                severity
            FROM graph_edge_overrides
            WHERE is_active = TRUE
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
            ORDER BY edge_id, severity DESC, cost_multiplier DESC, updated_at DESC
        )
        SELECT
            ordered_route.seq,
            ordered_route.node AS current_node,
            ordered_route.next_node,
            e.edge_id,
            e.from_node,
            e.to_node,
            e.length,
            e.type,
            e.floor_id,
            current_nodes.floor_id AS current_floor_id,
            next_nodes.floor_id AS next_floor_id,
            COALESCE(ao.cost_multiplier, 1.0) AS cost_multiplier,
            ao.reason AS override_reason,
            ao.source AS override_source,
            ao.severity AS override_severity,
            ST_AsGeoJSON(ST_Transform(e.geom, %s)) AS geometry
        FROM ordered_route
        JOIN edges e ON ordered_route.edge = e.edge_id
        LEFT JOIN nodes current_nodes ON ordered_route.node = current_nodes.node_id
        LEFT JOIN nodes next_nodes ON ordered_route.next_node = next_nodes.node_id
        LEFT JOIN active_overrides ao ON ao.edge_id = e.edge_id
        WHERE ordered_route.edge <> -1
          AND e.geom IS NOT NULL
        ORDER BY ordered_route.seq
    """

    COMBINED_ROUTE_SQL = """
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
                FROM routing_edges_combined e
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
            e.graph_source,
            current_nodes.floor_id AS current_floor_id,
            next_nodes.floor_id AS next_floor_id,
            current_nodes.node_source AS current_node_source,
            next_nodes.node_source AS next_node_source
        FROM ordered_route
        LEFT JOIN routing_edges_combined e ON ordered_route.edge = e.edge_id
        LEFT JOIN routing_nodes_combined current_nodes ON ordered_route.node = current_nodes.node_id
        LEFT JOIN routing_nodes_combined next_nodes ON ordered_route.next_node = next_nodes.node_id
        WHERE ordered_route.edge <> -1
        ORDER BY ordered_route.seq
    """

    NODE_SQL = """
        SELECT node_id, floor_id, type
        FROM nodes
        WHERE node_id = ANY(%s)
    """

    COMBINED_NODE_SQL = """
        SELECT node_id, floor_id, node_type, node_source
        FROM routing_nodes_combined
        WHERE node_id = ANY(%s)
    """

    POIS_SQL = """
        SELECT
            p.id,
            p.name,
            p.node_id,
            p.floor_id,
            p.category,
            room.room_code,
            room.room_name,
            room.room_type
        FROM pois p
        LEFT JOIN nodes n ON n.node_id = p.node_id
        LEFT JOIN LATERAL (
            SELECT
                r.room_code,
                r.room_name,
                r.room_type
            FROM rooms_polygons r
            WHERE r.floor_id = p.floor_id
            ORDER BY
                CASE WHEN n.geom IS NOT NULL AND ST_Contains(r.geom, n.geom) THEN 0 ELSE 1 END,
                CASE WHEN n.geom IS NOT NULL THEN ST_Distance(n.geom, r.geom) ELSE 999999 END
            LIMIT 1
        ) room ON TRUE
        ORDER BY p.floor_id, p.id
    """

    POI_BY_IDS_SQL = """
        SELECT id, name, node_id, floor_id, category
        FROM pois
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
            (SELECT COUNT(*) FROM pois) AS pois,
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

    CREATE_OUTDOOR_NODES_SQL = """
        CREATE TABLE IF NOT EXISTS outdoor_nodes (
            id BIGSERIAL PRIMARY KEY,
            node_id INTEGER NOT NULL UNIQUE,
            label TEXT,
            type VARCHAR(50) NOT NULL DEFAULT 'outdoor',
            geom geometry(Point),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    CREATE_OUTDOOR_EDGES_SQL = """
        CREATE TABLE IF NOT EXISTS outdoor_edges (
            id BIGSERIAL PRIMARY KEY,
            edge_id INTEGER NOT NULL UNIQUE,
            from_node INTEGER NOT NULL,
            to_node INTEGER NOT NULL,
            length DOUBLE PRECISION NOT NULL,
            cost DOUBLE PRECISION NOT NULL,
            type VARCHAR(50) NOT NULL DEFAULT 'outdoor_path',
            accessible VARCHAR(20) NOT NULL DEFAULT 'yes',
            geom geometry(LineString),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    CREATE_CONNECTION_EDGES_SQL = """
        CREATE TABLE IF NOT EXISTS graph_connection_edges (
            id BIGSERIAL PRIMARY KEY,
            edge_id INTEGER NOT NULL UNIQUE,
            from_node INTEGER NOT NULL,
            to_node INTEGER NOT NULL,
            length DOUBLE PRECISION NOT NULL,
            cost DOUBLE PRECISION NOT NULL,
            type VARCHAR(50) NOT NULL DEFAULT 'entrance_connection',
            accessible VARCHAR(20) NOT NULL DEFAULT 'yes',
            geom geometry(LineString),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    CREATE_OUTDOOR_NODE_INDEX_SQL = """
        CREATE INDEX IF NOT EXISTS idx_outdoor_nodes_node_id
        ON outdoor_nodes (node_id)
    """

    CREATE_OUTDOOR_EDGE_INDEX_SQL = """
        CREATE INDEX IF NOT EXISTS idx_outdoor_edges_nodes
        ON outdoor_edges (from_node, to_node)
    """

    CREATE_CONNECTION_EDGE_INDEX_SQL = """
        CREATE INDEX IF NOT EXISTS idx_connection_edges_nodes
        ON graph_connection_edges (from_node, to_node)
    """

    CREATE_ROUTING_NODES_VIEW_SQL = """
        CREATE OR REPLACE VIEW routing_nodes_combined AS
        SELECT
            n.node_id,
            n.floor_id,
            n.type AS node_type,
            'indoor'::text AS node_source
        FROM nodes n
        UNION ALL
        SELECT
            o.node_id,
            NULL::integer AS floor_id,
            o.type AS node_type,
            'outdoor'::text AS node_source
        FROM outdoor_nodes o
    """

    CREATE_ROUTING_EDGES_VIEW_SQL = """
        CREATE OR REPLACE VIEW routing_edges_combined AS
        SELECT
            e.edge_id,
            e.from_node,
            e.to_node,
            e.length,
            e.cost,
            e.type,
            e.accessible,
            e.floor_id,
            'indoor'::text AS graph_source
        FROM edges e
        UNION ALL
        SELECT
            oe.edge_id,
            oe.from_node,
            oe.to_node,
            oe.length,
            oe.cost,
            oe.type,
            oe.accessible,
            NULL::integer AS floor_id,
            'outdoor'::text AS graph_source
        FROM outdoor_edges oe
        UNION ALL
        SELECT
            ce.edge_id,
            ce.from_node,
            ce.to_node,
            ce.length,
            ce.cost,
            ce.type,
            ce.accessible,
            NULL::integer AS floor_id,
            'connection'::text AS graph_source
        FROM graph_connection_edges ce
    """

    SEED_OUTDOOR_NODES_SQL = """
        INSERT INTO outdoor_nodes (node_id, label, type)
        VALUES
            (1001, 'Campus Entrance Gate', 'outdoor_entrance'),
            (1002, 'Campus Walkway East', 'outdoor_path'),
            (1003, 'Campus Plaza', 'outdoor_path')
        ON CONFLICT (node_id) DO NOTHING
    """

    SEED_OUTDOOR_EDGES_SQL = """
        INSERT INTO outdoor_edges (edge_id, from_node, to_node, length, cost, type, accessible)
        VALUES
            (10001, 1003, 1002, 18.0, 18.0, 'outdoor_path', 'yes'),
            (10002, 1002, 1001, 12.0, 12.0, 'outdoor_path', 'yes')
        ON CONFLICT (edge_id) DO NOTHING
    """

    SEED_CONNECTION_EDGE_SQL = """
        INSERT INTO graph_connection_edges (edge_id, from_node, to_node, length, cost, type, accessible)
        VALUES
            (20001, 1001, 65, 3.0, 3.0, 'entrance_connection', 'yes')
        ON CONFLICT (edge_id) DO NOTHING
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
        """Create runtime, outdoor, and combined routing objects if they do not exist yet."""
        with get_connection() as conn:
            conn.execute(self.CREATE_PGROUTING_EXTENSION_SQL)
            conn.execute(self.CREATE_EDGE_OVERRIDES_SQL)
            conn.execute(self.CREATE_OPERATIONAL_EVENTS_SQL)
            conn.execute(self.CREATE_OUTDOOR_NODES_SQL)
            conn.execute(self.CREATE_OUTDOOR_EDGES_SQL)
            conn.execute(self.CREATE_CONNECTION_EDGES_SQL)
            conn.execute(self.CREATE_EDGE_OVERRIDE_INDEX_SQL)
            conn.execute(self.CREATE_OPERATIONAL_EVENTS_INDEX_SQL)
            conn.execute(self.CREATE_OUTDOOR_NODE_INDEX_SQL)
            conn.execute(self.CREATE_OUTDOOR_EDGE_INDEX_SQL)
            conn.execute(self.CREATE_CONNECTION_EDGE_INDEX_SQL)
            conn.execute(self.SEED_OUTDOOR_NODES_SQL)
            conn.execute(self.SEED_OUTDOOR_EDGES_SQL)
            conn.execute(self.SEED_CONNECTION_EDGE_SQL)
            conn.execute(self.CREATE_ROUTING_NODES_VIEW_SQL)
            conn.execute(self.CREATE_ROUTING_EDGES_VIEW_SQL)
            conn.commit()

    def get_route(self, from_node: int, to_node: int) -> PgRoutingRouteResponse:
        """Calculate a route and generate simple human-readable instructions."""
        with get_connection() as conn:
            return self._build_route_response(conn, from_node, to_node)

    def get_combined_route(self, from_node: int, to_node: int) -> PgRoutingRouteResponse:
        """Calculate a route across the combined outdoor-indoor graph."""
        with get_connection() as conn:
            return self._build_route_response(
                conn,
                from_node,
                to_node,
                route_sql=self.COMBINED_ROUTE_SQL,
                node_sql=self.COMBINED_NODE_SQL,
                instruction_mode="combined",
            )

    def get_route_geojson(
        self,
        from_node: int,
        to_node: int,
        output_srid: int = 4326,
    ) -> PgRoutingRouteGeoJsonResponse:
        """Return route edges as GeoJSON for two real pgRouting node IDs."""
        with get_connection() as conn:
            node_metadata = self._fetch_node_metadata(conn, [from_node, to_node], self.NODE_SQL)
            self._validate_nodes(from_node, to_node, node_metadata)
            rows = conn.execute(self.ROUTE_GEOJSON_SQL, (from_node, to_node, output_srid)).fetchall()

        if not rows:
            raise HTTPException(status_code=404, detail="No path found between the selected nodes")

        return self._build_geojson_response(from_node, to_node, rows)

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

    def get_route_geojson_by_poi(
        self,
        from_poi_id: int,
        to_poi_id: int,
        output_srid: int = 4326,
    ) -> PgRoutingRouteGeoJsonResponse:
        """Resolve POIs to graph nodes and return the route edges as GeoJSON."""
        with get_connection() as conn:
            poi_rows = conn.execute(self.POI_BY_IDS_SQL, ([from_poi_id, to_poi_id],)).fetchall()
            poi_lookup = {int(row["id"]): row for row in poi_rows}

            if from_poi_id not in poi_lookup:
                raise HTTPException(status_code=404, detail=f"Start POI {from_poi_id} not found")
            if to_poi_id not in poi_lookup:
                raise HTTPException(status_code=404, detail=f"End POI {to_poi_id} not found")

            from_node = int(poi_lookup[from_poi_id]["node_id"])
            to_node = int(poi_lookup[to_poi_id]["node_id"])
            node_metadata = self._fetch_node_metadata(conn, [from_node, to_node], self.NODE_SQL)
            self._validate_nodes(from_node, to_node, node_metadata)

            rows = conn.execute(self.ROUTE_GEOJSON_SQL, (from_node, to_node, output_srid)).fetchall()

        if not rows:
            raise HTTPException(status_code=404, detail="No path found between the selected POIs")

        return self._build_geojson_response(from_node, to_node, rows)

    def _build_geojson_response(
        self,
        from_node: int,
        to_node: int,
        rows: List[Dict],
    ) -> PgRoutingRouteGeoJsonResponse:
        features = [self._route_row_to_feature(row) for row in rows]
        floors = sorted({int(row["floor_id"]) for row in rows if row.get("floor_id") is not None})
        distance = round(sum(float(row["length"] or 0.0) for row in rows), 2)
        impacted_edges = [
            int(row["edge_id"])
            for row in rows
            if float(row.get("cost_multiplier") or 1.0) > 1.0
        ]

        return PgRoutingRouteGeoJsonResponse(
            route={
                "type": "FeatureCollection",
                "features": features,
            },
            summary={
                "start_node": from_node,
                "end_node": to_node,
                "distance": distance,
                "eta_seconds": calculate_eta(distance),
                "floors": floors,
                "uses_vertical_transition": len(floors) > 1,
                "impacted_edge_count": len(impacted_edges),
                "impacted_edges": impacted_edges,
            },
        )

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
                room_code=row.get("room_code"),
                room_name=row.get("room_name"),
                room_type=row.get("room_type"),
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

    def _build_route_response(
        self,
        conn,
        from_node: int,
        to_node: int,
        route_sql: str | None = None,
        node_sql: str | None = None,
        instruction_mode: str = "indoor",
    ) -> PgRoutingRouteResponse:
        node_metadata = self._fetch_node_metadata(conn, [from_node, to_node], node_sql or self.NODE_SQL)
        self._validate_nodes(from_node, to_node, node_metadata)

        route_rows = conn.execute(route_sql or self.ROUTE_SQL, (from_node, to_node)).fetchall()

        if not route_rows:
            raise HTTPException(status_code=404, detail="No path found between the selected nodes")

        path = self._build_path(from_node, route_rows)
        distance = round(sum(float(row["length"] or 0.0) for row in route_rows), 2)
        if instruction_mode == "combined":
            instructions = self._build_combined_instructions(
                start_source=node_metadata[from_node].get("node_source"),
                start_floor=node_metadata[from_node].get("floor_id"),
                route_rows=route_rows,
            )
        else:
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

    def _fetch_node_metadata(self, conn, node_ids: List[int], sql: str) -> Dict[int, Dict]:
        rows = conn.execute(sql, (node_ids,)).fetchall()
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

    def _route_row_to_feature(self, row: Dict) -> Dict:
        geometry = row["geometry"]
        if isinstance(geometry, str):
            import json
            geometry = json.loads(geometry)

        return {
            "type": "Feature",
            "id": int(row["edge_id"]),
            "geometry": geometry,
            "properties": {
                "edge_id": int(row["edge_id"]),
                "seq": int(row["seq"]),
                "from_node": int(row["from_node"]),
                "to_node": int(row["to_node"]),
                "floor_id": row["floor_id"],
                "current_floor_id": row["current_floor_id"],
                "next_floor_id": row["next_floor_id"],
                "length": float(row["length"] or 0.0),
                "type": row["type"],
                "cost_multiplier": float(row["cost_multiplier"] or 1.0),
                "override_reason": row["override_reason"],
                "override_source": row["override_source"],
                "override_severity": row["override_severity"],
            },
        }

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
                    stair_instruction = f"Use the stairs to go to floor {int(next_floor)}"
                else:
                    stair_instruction = "Use the stairs"

                if instructions and instructions[-1].startswith("Use the stairs"):
                    if "to go to floor" in stair_instruction:
                        instructions[-1] = stair_instruction
                else:
                    instructions.append(stair_instruction)
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

    def _build_combined_instructions(
        self,
        start_source: str | None,
        start_floor: int | None,
        route_rows: List[Dict],
    ) -> List[str]:
        instructions: List[str] = []

        if start_source == "outdoor":
            instructions.append("Start outside the building")
        else:
            instructions.append(
                f"Start on floor {start_floor}" if start_floor is not None else "Start at the selected origin"
            )

        outdoor_distance = 0.0
        indoor_rows: List[Dict] = []
        current_segment = "outdoor" if start_source == "outdoor" else "indoor"

        def flush_outdoor_segment():
            nonlocal outdoor_distance
            if outdoor_distance <= 0:
                return
            instructions.append(
                f"Continue on the outdoor path for approximately {self._format_meters(max(1, round(outdoor_distance)))}"
            )
            outdoor_distance = 0.0

        def flush_indoor_segment():
            nonlocal indoor_rows
            if not indoor_rows:
                return
            indoor_start_floor = indoor_rows[0].get("current_floor_id")
            indoor_instructions = self._build_instructions(indoor_start_floor, indoor_rows)
            indoor_instructions = [
                instruction
                for instruction in indoor_instructions
                if not instruction.startswith("Start") and instruction != "You have arrived at your destination"
            ]
            instructions.extend(indoor_instructions)
            indoor_rows = []

        for row in route_rows:
            graph_source = (row.get("graph_source") or "").strip().lower()
            edge_type = (row.get("type") or "").strip().lower()
            segment_length = float(row.get("length") or 0.0)

            if graph_source == "outdoor":
                if current_segment == "indoor":
                    flush_indoor_segment()
                    current_segment = "outdoor"
                outdoor_distance += segment_length
                continue

            if graph_source == "connection" or "entrance" in edge_type:
                if current_segment == "outdoor":
                    flush_outdoor_segment()
                else:
                    flush_indoor_segment()

                current_node_source = (row.get("current_node_source") or "").strip().lower()
                next_node_source = (row.get("next_node_source") or "").strip().lower()

                if current_node_source == "outdoor" and next_node_source == "indoor":
                    instructions.append("Enter the building")
                    current_segment = "indoor"
                elif current_node_source == "indoor" and next_node_source == "outdoor":
                    instructions.append("Exit the building")
                    current_segment = "outdoor"
                continue

            if current_segment == "outdoor":
                flush_outdoor_segment()
                current_segment = "indoor"
            indoor_rows.append(row)

        if current_segment == "outdoor":
            flush_outdoor_segment()
        else:
            flush_indoor_segment()

        if not instructions or instructions[-1] != "You have arrived at your destination":
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
