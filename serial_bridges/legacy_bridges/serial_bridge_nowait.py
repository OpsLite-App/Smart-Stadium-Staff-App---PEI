import json
import os
import time
import urllib.error
import urllib.request

import serial
import paho.mqtt.client as mqtt

# ----------------------------
# Configuration
# ----------------------------
SERIAL_PORT = os.getenv("SERIAL_PORT", "COM4")
SERIAL_BAUD = int(os.getenv("SERIAL_BAUD", "115200"))

MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "stadium/crowd/detection"

AUTH_URL = "http://localhost:8081/auth/login"
ROUTING_GIS_BASE = "http://localhost:8002/api/gis"
CAMERA_ID = 4

USERNAME = "eu@test.com"
PASSWORD = "password"


# ----------------------------
# Auth
# ----------------------------
def get_supervisor_token() -> str:
    payload = {
        "username": USERNAME,
        "password": PASSWORD,
    }

    request = urllib.request.Request(
        AUTH_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
    )
    request.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(request, timeout=10) as response:
        data = json.loads(response.read().decode("utf-8"))

    token = data.get("token")

    if not token:
        raise ValueError(f"No token found in login response: {data}")

    return token


try:
    SUPERVISOR_TOKEN = get_supervisor_token()
    print("Authenticated successfully")
except Exception as exc:
    print(f"Authentication failed: {exc}")
    raise SystemExit(1)


# ----------------------------
# GIS update
# ----------------------------
def update_camera_status(count: int) -> bool:
    url = f"{ROUTING_GIS_BASE}/camera-status/{CAMERA_ID}"

    payload = {
        "people_count": count,
        "status": "online",
    }

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="PUT",
    )

    request.add_header("Content-Type", "application/json")
    request.add_header("Authorization", f"Bearer {SUPERVISOR_TOKEN}")

    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status < 400

    except urllib.error.HTTPError as exc:
        print(f"GIS update failed: {exc.code} {exc.reason}")
    except urllib.error.URLError as exc:
        print(f"GIS update failed: {exc.reason}")

    return False


# ----------------------------
# MQTT setup
# ----------------------------
mqtt_client = mqtt.Client(protocol=mqtt.MQTTv5)
mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
mqtt_client.loop_start()

print(f"Connected to MQTT at {MQTT_BROKER}:{MQTT_PORT}")


# ----------------------------
# Serial setup
# ----------------------------
try:
    ser = serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
    print(f"Serial port {SERIAL_PORT} opened")
except Exception as exc:
    print(f"Failed to open serial port: {exc}")
    raise SystemExit(1)


# ----------------------------
# Main loop
# ----------------------------
last_count = None

while True:
    try:
        if ser.in_waiting <= 0:
            continue

        line = ser.readline().decode("utf-8", errors="ignore").strip()

        if "pp_output.nb_detect=" not in line:
            continue

        count = int(line.split("=")[1])

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