import os
import time
import sys
import paho.mqtt.client as mqtt

host = os.getenv("MQTT_HOST", "mosquitto")
port = int(os.getenv("MQTT_PORT", "1883"))
timeout = int(os.getenv("MQTT_WAIT_TIMEOUT", "30"))

start = time.time()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("MQTT ready")
        client.disconnect()
        sys.exit(0)
    else:
        print(f"MQTT connect failed with code {rc}")

while True:
    try:
        client = mqtt.Client(client_id="healthcheck-congestion", protocol=mqtt.MQTTv311)
        client.on_connect = on_connect
        client.connect(host, port, 5)
        client.loop_forever()
    except Exception:
        if time.time() - start > timeout:
            print(f"Timeout waiting for MQTT {host}:{port}")
            sys.exit(1)
        time.sleep(1)