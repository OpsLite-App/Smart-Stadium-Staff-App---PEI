# serial_to_mqtt_bridge.py
import serial
import paho.mqtt.client as mqtt
import json
import time

# Configuração
SERIAL_PORT = "COM4" 
SERIAL_BAUD = 115200
MQTT_BROKER = "localhost"  # ou IP do host com Mosquitto
MQTT_PORT = 1883

# Conectar ao broker MQTT
mqtt_client = mqtt.Client(protocol=mqtt.MQTTv5)
mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
mqtt_client.loop_start()

print(f"✅ Conectado ao MQTT em {MQTT_BROKER}:{MQTT_PORT}")

# Abrir porta serial
try:
    ser = serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
    print(f"✅ Porta serial {SERIAL_PORT} aberta")
except Exception as e:
    print(f"❌ Erro ao abrir porta: {e}")
    exit(1)

last_count = None

while True:
    try:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()

            if "pp_output.nb_detect=" not in line:
                continue

            count = int(line.split("=")[1])

            # 🔥 só envia se mudou
            if count == last_count:
                continue

            last_count = count

            payload = {
                "count": count,
                "timestamp": time.time()
            }

            mqtt_client.publish(
                "stadium/crowd/detection",
                json.dumps(payload)
            )

            print(f"📡 Publicado: {payload}")

    except Exception as e:
        print(f"❌ Erro: {e}")