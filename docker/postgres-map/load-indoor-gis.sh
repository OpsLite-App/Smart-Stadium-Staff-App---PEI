#!/bin/bash
set -e

echo "Loading indoor GIS backup into ${POSTGRES_DB}..."

psql -v ON_ERROR_STOP=0 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -f /docker-entrypoint-initdb.d-data/indoor_gis_backup.sql

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -c "CREATE EXTENSION IF NOT EXISTS pgrouting;"

echo "Indoor GIS backup loaded."
