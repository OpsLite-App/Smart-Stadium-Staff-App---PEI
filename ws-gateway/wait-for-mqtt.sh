#!/bin/sh
set -eu
host="${MQTT_HOST:-mosquitto}"
port="${MQTT_PORT:-1883}"
start=$(date +%s)
timeout=${MQTT_WAIT_TIMEOUT:-30}

printf 'Waiting for MQTT broker %s:%s...\n' "$host" "$port"

while ! nc -z "$host" "$port" 2>/dev/null; do
  if [ $(( $(date +%s) - start )) -ge "$timeout" ]; then
    echo "Timeout waiting for MQTT $host:$port"
    exit 1
  fi
  sleep 1
done

echo "MQTT ready"
exec "$@"
