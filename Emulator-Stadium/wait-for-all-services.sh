#!/bin/bash
# wait-for-all-services.sh

set -e

# List of services and their health check URLs
declare -A services=(
  ["mosquitto"]="tcp://mosquitto:1883"
  ["auth-service"]="http://auth-service:8081/actuator/health"
  ["map-service"]="http://map-service:8000/health"
  ["routing-service"]="http://routing-service:8002/health"
  ["queueing-service"]="http://queueing-service:8003/health"
  ["congestion-service"]="http://congestion-service:8005/health"
  ["emergency-service"]="http://emergency-service:8006/health"
  ["maintenance-service"]="http://maintenance-service:8007/health"
  ["ws-gateway"]="http://ws-gateway:8089/health"
  ["event-processor"]="http://event-processor:8004/health"
)

echo "Waiting for all services to be ready..."

for service in "${!services[@]}"; do
  url="${services[$service]}"
  echo "Waiting for $service at $url..."
  
  # TCP check for mosquitto
  if [[ $url == tcp://* ]]; then
    host_port="${url#tcp://}"
    host="${host_port%%:*}"
    port="${host_port##*:}"
    until nc -z "$host" "$port"; do
      echo "$service ($host:$port) not ready yet. Sleeping..."
      sleep 2
    done
  else
    # HTTP health check
    until curl -s "$url" >/dev/null; do
      echo "$service ($url) not ready yet. Sleeping..."
      sleep 2
    done
  fi
done

echo "All services are up!"

# Map-service initialization
echo "Initializing map-service..."
curl -X POST "http://map-service:8000/api/reset"
curl "http://map-service:8000/api/map"

echo "Initialization done - starting emulator..."
exec python simulator/dragao_simulator.py