"""
MQTT LISTENER for Emergency Service
Listens to sensor alerts (fire, smoke, gas) and creates incidents
"""

import json
from typing import Optional

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("⚠️  paho-mqtt not installed")

import os
MQTT_BROKER = os.getenv("MQTT_HOST", os.getenv("MQTT_BROKER", "localhost"))
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
# Subscribe to emergency-specific topics
MQTT_TOPICS = [
    "stadium/emergency/sos-events",
    "stadium/emergency/staff-assignments"
]


def on_connect(client, userdata, flags, rc, properties=None):
    """Connected to broker"""
    if rc == 0:
        print(f"✅ Connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        for topic in MQTT_TOPICS:
            client.subscribe(topic)
            print(f"✅ Subscribed to: {topic}")
    else:
        print(f"❌ Connection failed (code: {rc})")


def on_message(client, userdata, msg):
    """Process incoming messages"""
    try:
        payload = msg.payload.decode('utf-8')
        event = json.loads(payload)
        
        incident_manager = userdata.get('incident_manager')
        evacuation_coordinator = userdata.get('evacuation_coordinator')
        
        if not incident_manager:
            return
        
        from database import SessionLocal
        db = SessionLocal()
        
        try:
            process_event(event, incident_manager, evacuation_coordinator, db)
        finally:
            db.close()
    
    except Exception as e:
        print(f"❌ MQTT error: {e}")


def process_event(event: dict, incident_manager, evacuation_coordinator, db):
    """Process emergency events"""
    event_type = event.get('event_type')
    
    if event_type in ['fire_detected', 'smoke_detected', 'gas_detected']:
        handle_sensor_alert(event, incident_manager, db)
    
    elif event_type == 'sensor_alert':
        handle_generic_sensor(event, incident_manager, db)
    
    elif event_type == 'manual_alarm':
        handle_manual_alarm(event, incident_manager, db)


def handle_sensor_alert(event: dict, incident_manager, db):
    """Handle fire/smoke/gas sensor"""
    from schemas import SensorAlertCreate
    
    sensor_id = event.get('sensor_id')
    location_node = event.get('location_node', event.get('node_id'))
    reading = event.get('reading', event.get('value', 0))
    threshold = event.get('threshold', 100)
    
    # Map event type to sensor type
    event_type = event.get('event_type')
    sensor_type_map = {
        'fire_detected': 'fire',
        'smoke_detected': 'smoke',
        'gas_detected': 'gas'
    }
    sensor_type = sensor_type_map.get(event_type, 'smoke')
    
    # Determine severity
    if reading >= threshold * 2:
        severity = "critical"
    elif reading >= threshold * 1.5:
        severity = "high"
    else:
        severity = "medium"
    
    alert = SensorAlertCreate(
        sensor_id=sensor_id,
        sensor_type=sensor_type,
        location_node=location_node,
        reading_value=float(reading),
        threshold=float(threshold),
        severity=severity,
        unit=event.get('unit', 'ppm')
    )
    
    incident = incident_manager.create_incident_from_sensor(db, alert)
    print(f"🚨 Created incident from sensor {sensor_id}: {incident.id}")


def handle_generic_sensor(event: dict, incident_manager, db):
    """Handle generic sensor alert format"""
    from schemas import SensorAlertCreate
    
    alert = SensorAlertCreate(
        sensor_id=event.get('sensor_id'),
        sensor_type=event.get('sensor_type', 'smoke'),
        location_node=event.get('location_node'),
        reading_value=float(event.get('reading', 0)),
        threshold=float(event.get('threshold', 100)),
        severity=event.get('severity', 'medium'),
        unit=event.get('unit', 'ppm')
    )
    
    incident_manager.create_incident_from_sensor(db, alert)


def handle_manual_alarm(event: dict, incident_manager, db):
    """Handle manual alarm activation"""
    from schemas import IncidentCreate
    
    incident_data = IncidentCreate(
        incident_type="fire",
        location_node=event.get('location_node'),
        severity="high",
        description="Manual fire alarm activated",
        detected_by="manual_alarm",
        reported_by=event.get('activated_by')
    )
    
    incident_manager.create_incident(db, incident_data)
    print(f"🚨 Manual alarm activated at {event.get('location_node')}")


def start_mqtt_listener(incident_manager, evacuation_coordinator):
    """Start MQTT listener thread"""
    if not MQTT_AVAILABLE:
        print("⚠️  MQTT not available")
        return
    
    def mqtt_thread():
        client = mqtt.Client(
            client_id="emergency-service",
            protocol=mqtt.MQTTv5,
            userdata={
                'incident_manager': incident_manager,
                'evacuation_coordinator': evacuation_coordinator
            }
        )
        
        client.on_connect = on_connect
        client.on_message = on_message


        def on_disconnect(client, userdata, rc):
                print(f"⚠️  MQTT listener disconnected (rc={rc})")
        
        client.on_disconnect = on_disconnect            

        try:            
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            client.loop_forever()
        except Exception as e:
            print(f"❌ MQTT error: {e}")
    
    import threading
    thread = threading.Thread(target=mqtt_thread, daemon=True)
    thread.start()
    print("✅ MQTT listener thread started")