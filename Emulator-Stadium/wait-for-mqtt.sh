#!/bin/sh
set -eu
host="${MQTT_HOST:-mosquitto}"
port="${MQTT_PORT:-1883}"
start=$(date +%s)
timeout=${MQTT_WAIT_TIMEOUT:-30}

printf 'Waiting for MQTT broker %s:%s...\n' "$host" "$port"

while ! python - <<PY
import os,socket,sys
h=os.environ.get('MQTT_HOST','mosquitto')
p=int(os.environ.get('MQTT_PORT','1883'))
try:
 s=socket.socket()
 s.settimeout(1)
 s.connect((h,p))
 s.close()
 sys.exit(0)
except:
 sys.exit(1)
PY
do
  if [ $(( $(date +%s) - start )) -ge "$timeout" ]; then
    echo "Timeout waiting for MQTT $host:$port"
    exit 1
  fi
  sleep 1
done

echo "MQTT ready"
exec "$@"
