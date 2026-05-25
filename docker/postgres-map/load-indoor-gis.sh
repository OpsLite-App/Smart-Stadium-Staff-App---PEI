#!/bin/bash
set -e

echo "Loading indoor GIS backup into ${POSTGRES_DB}..."

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -f /docker-entrypoint-initdb.d-data/indoor_gis_backup.sql

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -c "CREATE EXTENSION IF NOT EXISTS pgrouting;"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -c "
DO \$\$
BEGIN
  IF to_regnamespace('indoor') IS NULL THEN
    RAISE EXCEPTION 'Schema indoor was not created by indoor_gis_backup.sql';
  END IF;

  IF to_regclass('indoor.floors') IS NULL
     OR to_regclass('indoor.nodes') IS NULL
     OR to_regclass('indoor.edges') IS NULL
     OR to_regclass('indoor.pois') IS NULL
     OR to_regclass('indoor.camera_infrastructure') IS NULL
     OR to_regclass('indoor.camera_coverage') IS NULL THEN
    RAISE EXCEPTION 'Indoor GIS import is incomplete; required indoor tables are missing';
  END IF;
END
\$\$;
"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -c "
SELECT
  'Indoor GIS ready' AS status,
  (SELECT COUNT(*) FROM indoor.floors) AS floors,
  (SELECT COUNT(*) FROM indoor.nodes) AS nodes,
  (SELECT COUNT(*) FROM indoor.edges) AS edges,
  (SELECT COUNT(*) FROM indoor.pois) AS pois;
"

echo "Indoor GIS backup loaded."
