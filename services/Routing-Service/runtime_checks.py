"""
Runtime validation for the active indoor GIS dataset.
"""

from typing import Any, Dict, Optional

from db import get_connection


EXPECTED_SEARCH_PATH_SCHEMA = "indoor"

REQUIRED_INDOOR_TABLES = (
    "floors",
    "nodes",
    "edges",
    "corridors_polygons",
    "rooms_polygons",
    "pois",
    "camera_infrastructure",
    "camera_coverage",
    "vertical_transitions",
)

CORE_DATA_TABLES = ("floors", "nodes", "edges", "pois")
LEGACY_PUBLIC_TABLES = ("nodes", "edges", "pois", "gates", "tiles", "seats", "closures")


class RuntimeReadinessError(RuntimeError):
    """Actionable runtime error returned when the active GIS dataset is unavailable."""

    def __init__(
        self,
        message: str,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.suggestion = suggestion
        self.details = details or {}

    def to_payload(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"message": self.message}
        if self.suggestion:
            payload["suggestion"] = self.suggestion
        if self.details:
            payload["details"] = self.details
        return payload


def ensure_active_indoor_dataset() -> None:
    """Validate that the live PostGIS dataset matches the active indoor runtime."""
    with get_connection() as conn:
        indoor_schema_exists = bool(
            conn.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.schemata
                    WHERE schema_name = 'indoor'
                ) AS indoor_schema_exists
                """
            ).fetchone()["indoor_schema_exists"]
        )
        active_schemas = list(
            conn.execute("SELECT current_schemas(false) AS schemas").fetchone()["schemas"] or []
        )

        if not indoor_schema_exists:
            legacy_public_tables = sorted(
                row["table_name"]
                for row in conn.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = ANY(%s)
                    """,
                    [list(LEGACY_PUBLIC_TABLES)],
                ).fetchall()
            )
            raise RuntimeReadinessError(
                "Active indoor GIS dataset is unavailable. Schema 'indoor' does not exist in postgres_map.",
                suggestion=(
                    "Reset the postgres_map data volume and start Docker Compose again so "
                    "indoor_gis_backup.sql is reloaded into schema 'indoor'."
                ),
                details={
                    "active_schemas": active_schemas,
                    "legacy_public_tables": legacy_public_tables,
                },
            )

        if EXPECTED_SEARCH_PATH_SCHEMA not in active_schemas:
            raise RuntimeReadinessError(
                "Routing database search_path does not include the active 'indoor' GIS schema.",
                suggestion=(
                    "Set PGR_DATABASE_URI or DATABASE_URI with "
                    "options=-csearch_path%3Dindoor,public before starting routing-service."
                ),
                details={"active_schemas": active_schemas},
            )

        existing_tables = {
            row["table_name"]
            for row in conn.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'indoor'
                  AND table_name = ANY(%s)
                """,
                [list(REQUIRED_INDOOR_TABLES)],
            ).fetchall()
        }
        missing_tables = [table for table in REQUIRED_INDOOR_TABLES if table not in existing_tables]

        if missing_tables:
            raise RuntimeReadinessError(
                "Active indoor GIS dataset is unavailable. The live runtime expects tables in schema 'indoor'.",
                suggestion=(
                    "Reset the postgres_map data volume and start Docker Compose again so "
                    "indoor_gis_backup.sql is reloaded into schema 'indoor'."
                ),
                details={
                    "active_schemas": active_schemas,
                    "missing_tables": missing_tables,
                },
            )

        counts = conn.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM floors) AS floors,
                (SELECT COUNT(*) FROM nodes) AS nodes,
                (SELECT COUNT(*) FROM edges) AS edges,
                (SELECT COUNT(*) FROM pois) AS pois
            """
        ).fetchone()

        empty_tables = [table for table in CORE_DATA_TABLES if counts[table] == 0]
        if empty_tables:
            raise RuntimeReadinessError(
                "Active indoor GIS dataset loaded without the core routing records required by the live runtime.",
                suggestion=(
                    "Reload postgres_map from indoor_gis_backup.sql and confirm the indoor seed "
                    "contains floors, nodes, edges, and pois."
                ),
                details={
                    "empty_tables": empty_tables,
                    "counts": {table: int(counts[table]) for table in CORE_DATA_TABLES},
                },
            )
