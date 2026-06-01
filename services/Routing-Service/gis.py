"""
GeoJSON access for real indoor GIS layers stored in PostGIS.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from db import get_connection
from pydantic import BaseModel, Field
from runtime_checks import ensure_active_indoor_dataset


class CameraStatusUpdate(BaseModel):
    """Payload used by operators/emulators to update camera monitoring state."""

    people_count: int = Field(..., ge=0)
    density_level: Optional[str] = None
    queue_level: Optional[str] = None
    status: str = "online"


class GisLayerService:
    """Expose selected indoor GIS layers as GeoJSON FeatureCollections."""

    CAMERA_LEVELS = {"normal", "busy", "congested", "critical"}
    CAMERA_OPERATIONAL_STATUSES = {"online", "degraded", "offline"}

    LAYERS = {
        "pois": {
            "table": "pois",
            "id": "id",
            "columns": ["id", "poi_id", "name", "category", "floor_id", "node_id"],
            "floor_column": "floor_id",
        },
        "rooms": {
            "table": "rooms_polygons",
            "id": "id",
            "columns": ["id", "room_code", "room_name", "floor_id", "room_type"],
            "floor_column": "floor_id",
        },
        "corridors": {
            "table": "corridors_polygons",
            "id": "id",
            "columns": ["id", "corridor_name", "floor_id", "corridor_type", "accessible", "status"],
            "floor_column": "floor_id",
        },
        "nodes": {
            "table": "nodes",
            "id": "node_id",
            "columns": ["id", "node_id", "floor_id", "type"],
            "floor_column": "floor_id",
        },
        "cameras": {
            "table": "camera_infrastructure",
            "id": "id",
            "columns": ["id", "camera_name", "floor_id", "status"],
            "floor_column": "floor_id",
        },
        "camera_coverage": {
            "table": "camera_coverage",
            "id": "id",
            "columns": ["id", "camera_id", "floor_id", "monitored_area"],
            "floor_column": "floor_id",
        },
        "vertical_transitions": {
            "table": "vertical_transitions",
            "id": "id",
            "columns": [
                "id",
                "transition_type",
                "floor_from",
                "floor_to",
                "accessible",
                "penalty_cost",
                "transition_name",
                "status",
            ],
            "floor_column": None,
        },
    }

    def __init__(self) -> None:
        self._dataset_ready = False

    def _ensure_dataset_ready(self) -> None:
        if self._dataset_ready:
            return
        ensure_active_indoor_dataset()
        self._dataset_ready = True

    def get_feature_collection(
        self,
        layer_name: str,
        floor_id: Optional[int] = None,
        output_srid: int = 4326,
    ) -> Dict[str, Any]:
        self._ensure_dataset_ready()
        layer = self.LAYERS[layer_name]
        rows = self._fetch_layer_rows(layer, floor_id, output_srid)

        return {
            "type": "FeatureCollection",
            "features": [self._to_feature(row, layer["id"]) for row in rows],
        }

    def _fetch_layer_rows(
        self,
        layer: Dict[str, Any],
        floor_id: Optional[int],
        output_srid: int,
    ) -> List[Dict[str, Any]]:
        select_columns = ", ".join(layer["columns"])
        table = layer["table"]
        params: List[Any] = [output_srid]

        where_clause = "WHERE geom IS NOT NULL"
        floor_column = layer["floor_column"]

        if floor_id is not None:
            if table == "vertical_transitions":
                where_clause += " AND (floor_from = %s OR floor_to = %s)"
                params.extend([floor_id, floor_id])
            elif floor_column:
                where_clause += f" AND {floor_column} = %s"
                params.append(floor_id)

        sql = f"""
            SELECT
                {select_columns},
                ST_AsGeoJSON(ST_Transform(geom, %s)) AS geometry
            FROM {table}
            {where_clause}
            ORDER BY {layer["id"]}
        """

        with get_connection() as conn:
            return list(conn.execute(sql, params).fetchall())

    def _to_feature(self, row: Dict[str, Any], id_column: str) -> Dict[str, Any]:
        geometry = row["geometry"]
        if isinstance(geometry, str):
            geometry = json.loads(geometry)

        properties = {
            key: value
            for key, value in row.items()
            if key != "geometry"
        }

        return {
            "type": "Feature",
            "id": row[id_column],
            "geometry": geometry,
            "properties": properties,
        }

    def available_layers(self) -> Iterable[str]:
        return self.LAYERS.keys()

    def get_impacted_edges(
        self,
        floor_id: Optional[int] = None,
        output_srid: int = 4326,
    ) -> Dict[str, Any]:
        """Return active routing edge overrides as GeoJSON LineString features."""
        self._ensure_dataset_ready()
        params: List[Any] = [output_srid]
        where_clause = """
            WHERE e.geom IS NOT NULL
              AND geo.is_active = TRUE
              AND (geo.starts_at IS NULL OR geo.starts_at <= NOW())
              AND (geo.ends_at IS NULL OR geo.ends_at >= NOW())
        """

        if floor_id is not None:
            where_clause += " AND e.floor_id = %s"
            params.append(floor_id)

        sql = f"""
            WITH active_overrides AS (
                SELECT DISTINCT ON (edge_id)
                    id,
                    edge_id,
                    is_blocked,
                    cost_multiplier,
                    reason,
                    source,
                    severity,
                    updated_at,
                    is_active,
                    starts_at,
                    ends_at
                FROM graph_edge_overrides
                WHERE is_active = TRUE
                  AND (starts_at IS NULL OR starts_at <= NOW())
                  AND (ends_at IS NULL OR ends_at >= NOW())
                ORDER BY edge_id, severity DESC, cost_multiplier DESC, updated_at DESC
            )
            SELECT
                geo.id,
                e.edge_id,
                e.floor_id,
                e.from_node,
                e.to_node,
                e.type,
                geo.is_blocked,
                geo.cost_multiplier,
                geo.reason,
                geo.source,
                geo.severity,
                geo.updated_at,
                ST_AsGeoJSON(ST_Transform(e.geom, %s)) AS geometry
            FROM active_overrides geo
            JOIN edges e ON e.edge_id = geo.edge_id
            {where_clause}
            ORDER BY geo.severity DESC, geo.cost_multiplier DESC, e.edge_id
        """

        with get_connection() as conn:
            rows = list(conn.execute(sql, params).fetchall())

        return {
            "type": "FeatureCollection",
            "features": [self._to_feature(row, "id") for row in rows],
        }

    def initialize_camera_status_table(self) -> None:
        """Create and seed the operational camera status table if needed."""
        self._ensure_dataset_ready()
        sql = """
            CREATE TABLE IF NOT EXISTS camera_status (
                camera_id integer PRIMARY KEY REFERENCES camera_infrastructure(id) ON DELETE CASCADE,
                people_count integer NOT NULL DEFAULT 0 CHECK (people_count >= 0),
                density_level text NOT NULL DEFAULT 'normal'
                    CHECK (density_level IN ('normal', 'busy', 'congested', 'critical')),
                queue_level text NOT NULL DEFAULT 'normal'
                    CHECK (queue_level IN ('normal', 'busy', 'congested', 'critical')),
                status text NOT NULL DEFAULT 'online'
                    CHECK (status IN ('online', 'degraded', 'offline')),
                updated_at timestamp with time zone NOT NULL DEFAULT now()
            );

            INSERT INTO camera_status (camera_id, people_count, density_level, queue_level, status)
            SELECT
                ci.id,
                CASE ci.id
                    WHEN 1 THEN 18
                    WHEN 2 THEN 31
                    WHEN 3 THEN 42
                    WHEN 4 THEN 12
                    WHEN 5 THEN 24
                    WHEN 6 THEN 57
                    WHEN 7 THEN 36
                    ELSE 0
                END AS people_count,
                CASE
                    WHEN ci.id = 6 THEN 'critical'
                    WHEN ci.id = 3 THEN 'congested'
                    WHEN ci.id IN (2, 5, 7) THEN 'busy'
                    ELSE 'normal'
                END AS density_level,
                CASE
                    WHEN ci.id = 6 THEN 'critical'
                    WHEN ci.id = 3 THEN 'congested'
                    WHEN ci.id IN (2, 5, 7) THEN 'busy'
                    ELSE 'normal'
                END AS queue_level,
                'online'
            FROM camera_infrastructure ci
            ON CONFLICT (camera_id) DO NOTHING;
        """

        with get_connection() as conn:
            conn.execute(sql)
            conn.commit()

    def get_camera_status(self, floor_id: Optional[int] = None) -> Dict[str, Any]:
        """Return persisted operational status for real camera entities."""
        self.initialize_camera_status_table()

        where_clause = "WHERE ci.status = 'active'"
        params: List[Any] = []

        if floor_id is not None:
            where_clause += " AND ci.floor_id = %s"
            params.append(floor_id)

        sql = f"""
            SELECT
                ci.id AS camera_id,
                ci.camera_name,
                ci.floor_id,
                cc.id AS coverage_id,
                cc.monitored_area,
                cs.people_count,
                cs.density_level,
                cs.queue_level,
                cs.status,
                cs.updated_at
            FROM camera_infrastructure ci
            LEFT JOIN camera_coverage cc ON cc.camera_id = ci.id
            LEFT JOIN camera_status cs ON cs.camera_id = ci.id
            {where_clause}
            ORDER BY ci.floor_id, ci.id
        """

        with get_connection() as conn:
            rows = list(conn.execute(sql, params).fetchall())

        timestamp = datetime.now(timezone.utc).isoformat()
        statuses = [self._to_camera_status(row) for row in rows]

        return {
            "timestamp": timestamp,
            "statuses": statuses,
            "count": len(statuses),
        }

    def _to_camera_status(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "camera_id": int(row["camera_id"]),
            "camera_name": row["camera_name"],
            "coverage_id": row["coverage_id"],
            "floor_id": row["floor_id"],
            "monitored_area": row["monitored_area"],
            "people_count": row["people_count"] or 0,
            "density_level": row["density_level"] or "normal",
            "queue_level": row["queue_level"] or "normal",
            "status": row["status"] or "online",
            "timestamp": row["updated_at"].isoformat() if row["updated_at"] else None,
        }

    def update_camera_status(self, camera_id: int, payload: CameraStatusUpdate) -> Dict[str, Any]:
        """Upsert operational state for a camera and return the updated row."""
        self.initialize_camera_status_table()

        density_level = payload.density_level or self._density_level(payload.people_count)
        queue_level = payload.queue_level or density_level

        self._validate_camera_level(density_level, "density_level")
        self._validate_camera_level(queue_level, "queue_level")
        if payload.status not in self.CAMERA_OPERATIONAL_STATUSES:
            raise ValueError("status must be one of: online, degraded, offline")

        sql = """
            INSERT INTO camera_status (
                camera_id,
                people_count,
                density_level,
                queue_level,
                status,
                updated_at
            )
            SELECT %s, %s, %s, %s, %s, now()
            WHERE EXISTS (SELECT 1 FROM camera_infrastructure WHERE id = %s)
            ON CONFLICT (camera_id) DO UPDATE SET
                people_count = EXCLUDED.people_count,
                density_level = EXCLUDED.density_level,
                queue_level = EXCLUDED.queue_level,
                status = EXCLUDED.status,
                updated_at = now()
            RETURNING camera_id
        """

        with get_connection() as conn:
            updated = conn.execute(
                sql,
                [
                    camera_id,
                    payload.people_count,
                    density_level,
                    queue_level,
                    payload.status,
                    camera_id,
                ],
            ).fetchone()
            conn.commit()

        if not updated:
            raise ValueError(f"Camera {camera_id} not found")

        self.apply_camera_routing_impact(camera_id, density_level)

        return self.get_camera_status_for_camera(camera_id)

    def apply_camera_routing_impact(self, camera_id: int, density_level: str) -> Dict[str, Any]:
        """Translate camera congestion into live routing edge overrides."""
        source = f"camera_status:{camera_id}"
        impact = self._routing_impact_for_density(density_level)

        with get_connection() as conn:
            self._deactivate_camera_routing_impact(conn, source)

            if not impact:
                conn.commit()
                return {"camera_id": camera_id, "impacted_edges": 0, "density_level": density_level}

            camera = conn.execute(
                """
                SELECT
                    ci.camera_name,
                    cc.id AS coverage_id,
                    cc.floor_id,
                    cc.monitored_area,
                    cc.geom
                FROM camera_infrastructure ci
                JOIN camera_coverage cc ON cc.camera_id = ci.id
                WHERE ci.id = %s
                LIMIT 1
                """,
                [camera_id],
            ).fetchone()

            if not camera:
                conn.commit()
                return {"camera_id": camera_id, "impacted_edges": 0, "density_level": density_level}

            edge_rows = conn.execute(
                """
                SELECT DISTINCT e.edge_id
                FROM edges e
                JOIN camera_coverage cc ON cc.camera_id = %s
                WHERE e.geom IS NOT NULL
                  AND e.floor_id = cc.floor_id
                  AND (
                    ST_Intersects(e.geom, cc.geom)
                    OR ST_DWithin(e.geom, cc.geom, 1.5)
                  )
                ORDER BY e.edge_id
                """,
                [camera_id],
            ).fetchall()

            reason = (
                f"{density_level.title()} crowd detected by "
                f"{camera['camera_name']} ({camera['monitored_area'] or 'coverage area'})"
            )

            for edge in edge_rows:
                conn.execute(
                    """
                    INSERT INTO graph_edge_overrides (
                        edge_id,
                        is_blocked,
                        cost_multiplier,
                        reason,
                        source,
                        severity,
                        is_active
                    )
                    VALUES (%s, FALSE, %s, %s, %s, %s, TRUE)
                    """,
                    [
                        edge["edge_id"],
                        impact["cost_multiplier"],
                        reason,
                        source,
                        impact["severity"],
                    ],
                )

            conn.execute(
                """
                INSERT INTO operational_events (
                    event_type,
                    title,
                    description,
                    severity,
                    status,
                    source,
                    floor_id,
                    is_active
                )
                VALUES ('crowd', %s, %s, %s, 'active', %s, %s, TRUE)
                """,
                [
                    f"Camera crowd impact: {camera['camera_name']}",
                    f"{reason}. {len(edge_rows)} routing edge(s) affected.",
                    impact["severity"],
                    source,
                    camera["floor_id"],
                ],
            )

            conn.commit()

        return {
            "camera_id": camera_id,
            "impacted_edges": len(edge_rows),
            "density_level": density_level,
        }

    def _deactivate_camera_routing_impact(self, conn, source: str) -> None:
        conn.execute(
            """
            UPDATE graph_edge_overrides
            SET is_active = FALSE, updated_at = NOW()
            WHERE source = %s AND is_active = TRUE
            """,
            [source],
        )
        conn.execute(
            """
            UPDATE operational_events
            SET is_active = FALSE, status = 'resolved', updated_at = NOW()
            WHERE source = %s AND is_active = TRUE
            """,
            [source],
        )

    def _routing_impact_for_density(self, density_level: str) -> Optional[Dict[str, float]]:
        if density_level == "critical":
            return {"cost_multiplier": 7.5, "severity": 0.9}
        if density_level == "congested":
            return {"cost_multiplier": 2.5, "severity": 0.65}
        return None

    def get_camera_status_for_camera(self, camera_id: int) -> Dict[str, Any]:
        self._ensure_dataset_ready()
        sql = """
            SELECT
                ci.id AS camera_id,
                ci.camera_name,
                ci.floor_id,
                cc.id AS coverage_id,
                cc.monitored_area,
                cs.people_count,
                cs.density_level,
                cs.queue_level,
                cs.status,
                cs.updated_at
            FROM camera_infrastructure ci
            LEFT JOIN camera_coverage cc ON cc.camera_id = ci.id
            LEFT JOIN camera_status cs ON cs.camera_id = ci.id
            WHERE ci.id = %s
        """

        with get_connection() as conn:
            row = conn.execute(sql, [camera_id]).fetchone()

        if not row:
            raise ValueError(f"Camera {camera_id} not found")

        return self._to_camera_status(row)

    def _validate_camera_level(self, value: str, field_name: str) -> None:
        if value not in self.CAMERA_LEVELS:
            raise ValueError(f"{field_name} must be one of: normal, busy, congested, critical")

    def _density_level(self, people_count: int) -> str:
        if people_count >= 55:
            return "critical"
        if people_count >= 38:
            return "congested"
        if people_count >= 20:
            return "busy"
        return "normal"
