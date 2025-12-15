#!/bin/sh
# wait-for-map-service.sh

set -eu

# Use environment variable if set, otherwise use arguments
host="${MAP_SERVICE_HOST:-$1}"
port="${MAP_SERVICE_PORT:-$2}"
# shift may fail if not enough args; ignore in that case
shift 2 2>/dev/null || true

url="${MAP_SERVICE_URL:-http://$host:$port}"

printf 'Waiting for Map Service at %s to be ready...\n' "$url"

# Wait until the service responds
while ! curl -fsS "$url/health" >/dev/null 2>&1; do
  printf 'Map Service %s not ready yet. Sleeping...\n' "$url"
  sleep 2
done

printf 'Map Service is up - sending initialization requests...\n'
# Best-effort initialization (don't fail startup if init endpoints fail)
curl -fsS -X POST "$url/api/reset" || true
curl -fsS "$url/api/map" || true

printf 'Initialization done - starting Routing Service...\n'
exec "$@"