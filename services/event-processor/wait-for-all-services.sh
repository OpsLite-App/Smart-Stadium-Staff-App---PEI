#!/bin/bash
# wait-for-all-services.sh for event-processor

set -e

# First, wait for MQTT (keep original logic)
echo "Waiting for MQTT broker..."
python /wait-for-mqtt.py
echo "MQTT broker is ready!"

# List of other services and their health check URLs
declare -A services=(
  ["auth-service"]="http://auth-service:8081/actuator/health"
  ["map-service"]="http://map-service:8000/health"
  ["routing-service"]="http://routing-service:8002/health"
  ["queueing-service"]="http://queueing-service:8003/health"
  ["congestion-service"]="http://congestion-service:8005/health"
  ["emergency-service"]="http://emergency-service:8006/health"
  ["maintenance-service"]="http://maintenance-service:8007/health"
  ["ws-gateway"]="http://ws-gateway:8089/health"
)

echo "Waiting for all other services to be ready..."

for service in "${!services[@]}"; do
  url="${services[$service]}"
  echo "Waiting for $service at $url..."
  
  until curl -s "$url" >/dev/null; do
    echo "$service ($url) not ready yet. Sleeping..."
    sleep 2
  done
done

echo "All services are up! Starting event-processor..."
ls -l /app
exec python event_processor.py

