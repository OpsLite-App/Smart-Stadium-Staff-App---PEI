#!/bin/bash

set -e

host="${SERVICE_HOST:-${ROUTING_SERVICE_HOST:-$1}}"
port="${SERVICE_PORT:-${ROUTING_SERVICE_PORT:-$2}}"
shift 2

url="${SERVICE_URL:-${ROUTING_SERVICE_URL:-http://$host:$port}}"

echo "Waiting for $url to be ready..."

until curl -fsS "$url/health" >/dev/null; do
  echo "Service $url not ready yet. Sleeping..."
  sleep 2
done

echo "$url is up - starting emulator..."
exec "$@"
