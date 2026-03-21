"""
STM32 Bridge — reads people count from STM32 via serial and publishes to MQTT.
STM32 sends: {"people": 3}
"""

import serial, json, time, uuid
import paho.mqtt.client as mqtt
from datetime import datetime
import os

SERIAL_PORT = os.getenv("SERIAL_PORT", "/dev/ttyACM0")
BAUD_RATE   = int(os.getenv("BAUD_RATE", 115200))
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT   = int(os.getenv("MQTT_PORT", 1883))
GATE_ID     = os.getenv("GATE_ID", "Gate-1")
TOPIC       = "stadium/crowd/gate-updates"

client = mqtt.Client()
client.connect(MQTT_BROKER, MQTT_PORT)
client.loop_start()

print(f"Bridge started: {SERIAL_PORT} → MQTT {MQTT_BROKER} (gate: {GATE_ID})")

while True:
    try:
        with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2) as ser:
            print(f"✅ Connected to {SERIAL_PORT}")
            while True:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    event = {
                        "event_id":      str(uuid.uuid4()),
                        "event_type":    "gate_passage",
                        "timestamp":     datetime.now().isoformat() + "Z",
                        "gate_id":       GATE_ID,
                        "direction":     "entry",
                        "current_count": data["people"],
                    }
                    client.publish(TOPIC, json.dumps(event))
                    print(f"→ {GATE_ID}: {data['people']} pessoas")
                except (json.JSONDecodeError, KeyError):
                    pass  # ignora linhas de debug do STM32
    except serial.SerialException as e:
        print(f"Serial error: {e}, a tentar novamente em 3s...")
        time.sleep(3)
