#!/bin/bash

set -e

declare -A required_services=(
  ["mosquitto"]="tcp://mosquitto:1883"
  ["routing-service"]="http://routing-service:8002/health"
  ["queueing-service"]="http://queueing-service:8003/health"
  ["congestion-service"]="http://congestion-service:8005/health"
  ["emergency-service"]="http://emergency-service:8006/health"
  ["maintenance-service"]="http://maintenance-service:8007/health"
)

declare -A optional_services=(
  ["event-processor"]="http://event-processor:8004/health"
  ["ws-gateway"]="http://ws-gateway:8089/health"
)

wait_for_service() {
  local service="$1"
  local url="$2"
  local required="$3"

  echo "Waiting for $service at $url..."

  if [[ $url == tcp://* ]]; then
    local host_port="${url#tcp://}"
    local host="${host_port%%:*}"
    local port="${host_port##*:}"
    until nc -z "$host" "$port"; do
      echo "$service ($host:$port) not ready yet. Sleeping..."
      sleep 2
    done
    return
  fi

  if [[ "$required" == "required" ]]; then
    until curl -fsS "$url" >/dev/null; do
      echo "$service ($url) not ready yet. Sleeping..."
      sleep 2
    done
  elif ! curl -fsS "$url" >/dev/null; then
    echo "$service is not ready; continuing because it is optional."
  fi
}

echo "Waiting for OpsLite services used by the emulator..."

for service in "${!required_services[@]}"; do
  wait_for_service "$service" "${required_services[$service]}" "required"
done

if [[ "${WAIT_FOR_OPTIONAL_SERVICES:-false}" == "true" ]]; then
  for service in "${!optional_services[@]}"; do
    wait_for_service "$service" "${optional_services[$service]}" "optional"
  done
fi

echo "Required services are up. Starting emulator..."

if [[ "$#" -gt 0 ]]; then
  exec "$@"
fi

exec python simulator/dragao_simulator.py
