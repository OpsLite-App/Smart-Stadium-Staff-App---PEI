import json
import os
import time
import urllib.error
import urllib.request

import serial
import paho.mqtt.client as mqtt

# Configuration
SERIAL_PORT = os.getenv("SERIAL_PORT", "COM4")
SERIAL_BAUD = int(os.getenv("SERIAL_BAUD", "115200"))

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "stadium/crowd/detection")

ROUTING_GIS_BASE = os.getenv("ROUTING_GIS_BASE", "http://localhost:8002/api/gis")
CAMERA_ID = int(os.getenv("CAMERA_ID", "4"))
SUPERVISOR_TOKEN = os.getenv("SUPERVISOR_TOKEN", "")

MOCK_MODE = os.getenv("MOCK_MODE", "0") == "1"
MOCK_COUNTS = [
    int(value)
    for value in os.getenv("MOCK_COUNTS", "12,18,25,33,45,60,48,30").split(",")
    if value.strip().isdigit()
]
MOCK_INTERVAL_SEC = float(os.getenv("MOCK_INTERVAL_SEC", "2.0"))


def update_camera_status(count: int) -> bool:
    if not SUPERVISOR_TOKEN:
        print("Skipping GIS update: SUPERVISOR_TOKEN not set")
        return False

    url = f"{ROUTING_GIS_BASE}/camera-status/{CAMERA_ID}"
    payload = {
        "people_count": count,
        "status": "online",
    }
    data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(url, data=data, method="PUT")
    request.add_header("Content-Type", "application/json")
    request.add_header("Authorization", f"Bearer {SUPERVISOR_TOKEN}")

    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            if response.status >= 400:
                print(f"GIS update failed: {response.status}")
                return False
        return True
    except urllib.error.HTTPError as exc:
        print(f"GIS update failed: {exc.code} {exc.reason}")
    except urllib.error.URLError as exc:
        print(f"GIS update failed: {exc.reason}")

    return False


# Connect to MQTT broker
mqtt_client = mqtt.Client(protocol=mqtt.MQTTv5)
mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
mqtt_client.loop_start()

print(f"Connected to MQTT at {MQTT_BROKER}:{MQTT_PORT}")

# Open serial port (skip if mock mode is enabled)
ser = None
if not MOCK_MODE:
    try:
        ser = serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
        print(f"Serial port {SERIAL_PORT} opened")
    except Exception as exc:
        print(f"Failed to open serial port: {exc}")
        raise SystemExit(1)

last_count = None

if MOCK_MODE:
    mock_index = 0
    if not MOCK_COUNTS:
        MOCK_COUNTS = [12, 18, 25, 33, 45, 60, 48, 30]
    print("Mock mode enabled: publishing simulated counts")

while True:
    try:
        if MOCK_MODE:
            count = MOCK_COUNTS[mock_index % len(MOCK_COUNTS)]
            mock_index += 1
            time.sleep(MOCK_INTERVAL_SEC)
        else:
            if ser is None or ser.in_waiting <= 0:
                continue

            line = ser.readline().decode("utf-8", errors="ignore").strip()

            if "pp_output.nb_detect=" not in line:
                continue

            count = int(line.split("=")[1])

        # Only send if changed
        if count == last_count:
            continue

        last_count = count

        payload = {
            "count": count,
            "timestamp": time.time(),
        }

        mqtt_client.publish(MQTT_TOPIC, json.dumps(payload))
        print(f"MQTT published: {payload}")

        if update_camera_status(count):
            print(f"GIS updated: camera_id={CAMERA_ID}, people_count={count}")

    except Exception as exc:
        print(f"Runtime error: {exc}")
