#!/bin/bash
# wait-for-service.sh

set -e

# Use environment variable if set, otherwise use arguments
host="${MAP_SERVICE_HOST:-$1}"
port="${MAP_SERVICE_PORT:-$2}"
shift 2
cmd="$@"

url="${MAP_SERVICE_URL:-http://$host:$port}"

echo "Waiting for $url to be ready..."

# Wait until the service responds
until curl -s "$url/health" >/dev/null; do
  echo "Service $url not ready yet. Sleeping..."
  sleep 2
done

echo "$url is up - sending initialization requests..."
curl -X POST "$url/api/reset"
curl "$url/api/map"

echo "Initialization done - starting emulator..."
exec $cmd