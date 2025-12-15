"""
EVENT PROCESSOR - Integration Layer
Connects Simulator → Services (Routing, Queueing, Map)

Listens to MQTT events and updates services accordingly
"""

import requests
import time
import json
import signal
from typing import Dict

from http.server import BaseHTTPRequestHandler, HTTPServer
import threading


try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("⚠️  paho-mqtt not installed. Install: pip install paho-mqtt")

# ========== CONFIGURATION ==========

import os
MQTT_BROKER = os.getenv("MQTT_HOST", os.getenv("MQTT_BROKER", "localhost"))
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = "stadium/#"

MAP_SERVICE_URL = os.getenv("MAP_SERVICE_URL", "http://map-service:8000")
ROUTING_SERVICE_URL = os.getenv("ROUTING_SERVICE_URL", "http://routing-service:8002")
QUEUEING_SERVICE_URL = os.getenv("QUEUEING_SERVICE_URL", "http://queueing-service:8003")
WAIT_TIMES_SERVICE_URL = os.getenv("WAIT_TIMES_SERVICE_URL", "http://event-processor:8004")
CONGESTION_SERVICE_URL = os.getenv("CONGESTION_SERVICE_URL", "http://congestion-service:8005")
EMERGENCY_SERVICE_URL = os.getenv("EMERGENCY_SERVICE_URL", "http://emergency-service:8006")
MAINTENANCE_SERVICE_URL = os.getenv("MAINTENANCE_SERVICE_URL", "http://maintenance-service:8007")



# ========== EVENT PROCESSOR ==========

class EventProcessor:
    def __init__(self):
        self.event_count = 0
        self.processed = {
            "gate_passage": 0,
            "bin_alert": 0,
            "sos_event": 0,
            "crowd_density": 0,
            "evac_update": 0,
            "queue_update": 0,
            "responder_assign": 0
        }
        
        # Track queue state per location
        self.queue_observations = {}
    
    def process_event(self, event: Dict):
        """Process incoming event and call appropriate service"""
        event_type = event.get("event_type")
        
        if not event_type:
            return
        
        self.event_count += 1
        
        try:
            if event_type == "gate_passage":
                self.handle_gate_passage(event)
            
            elif event_type == "bin_alert":
                self.handle_bin_alert(event)
            
            elif event_type == "sos_event":
                self.handle_sos_event(event)
            
            elif event_type == "crowd_density":
                self.handle_crowd_density(event)
            
            elif event_type == "evac_update":
                self.handle_evacuation(event)
            
            elif event_type == "queue_update":
                self.handle_queue_update(event)
            
            # Log every 10 events
            if self.event_count % 10 == 0:
                print(f"📊 Processed {self.event_count} events")
        
        except Exception as e:
            print(f"❌ Error processing {event_type}: {e}", flush=True)
    
    def handle_gate_passage(self, event: Dict):
        """
        Gate passage → Update Queueing Service
        
        Event: {
            "event_type": "gate_passage",
            "gate_id": "Gate-1",
            "person_id": "P_001234",
            "direction": "entry",
            "current_count": 42,
            "throughput_per_min": 18.5
        }
        """
        gate_id = event.get("gate_id")
        direction = event.get("direction", "entry")
        throughput = event.get("throughput_per_min", 15.0)
        
        # Initialize queue tracking if needed
        if gate_id not in self.queue_observations:
            self.queue_observations[gate_id] = {
                "arrivals": 0,
                "departures": 0,
                "last_update": time.time()
            }
        
        obs = self.queue_observations[gate_id]
        
        # Count arrivals/departures
        if direction == "entry":
            obs["arrivals"] += 1
        else:
            obs["departures"] += 1
        
        # Update Queueing Service every minute
        current_time = time.time()
        if current_time - obs["last_update"] >= 60:
            try:
                response = requests.post(
                    f"{QUEUEING_SERVICE_URL}/api/queue/update",
                    json={
                        "location_id": gate_id,
                        "location_type": "gate",
                        "current_queue_length": max(0, obs["arrivals"] - obs["departures"]),
                        "arrivals_last_minute": obs["arrivals"],
                        "departures_last_minute": obs["departures"],
                        "num_servers": 2  # Assume 2 security lanes per gate
                    },
                    timeout=2
                )
                print("Gate", flush=True)
                
                if response.status_code == 200:
                    self.processed["gate_passage"] += 1
                    # Reset counters
                    obs["arrivals"] = 0
                    obs["departures"] = 0
                    obs["last_update"] = current_time
            
            except Exception as e:
                print(f"⚠️  Failed to update queueing for {gate_id}: {e}", flush=True)
    
    def handle_bin_alert(self, event: Dict):
        """
        Bin alert → Create a maintenance task for bin-full event and auto-assign
        Event example:
        {
            "event_type": "bin_alert",
            "bin_id": "B123",
            "poi_node": "N5",
            "fill_percentage": 90,
            "priority": "high"
        }
        """
        fill_percentage = event.get("fill_percentage", 0)
        if fill_percentage < 85:
            return  # Only process high fill levels

        bin_id = event.get("bin_id")
        location_node = event.get("poi_node", "N5")
        priority = event.get("priority", "medium")

        payload = {
            "bin_id": bin_id,
            "location_node": location_node,
            "fill_percentage": fill_percentage,
            "priority": priority
        }

        try:
            # Create bin alert in maintenance service and auto-assign
            response = requests.post(
                f"{MAINTENANCE_SERVICE_URL}/api/maintenance/bins/alert",
                params={"auto_assign": True},
                json=payload,
                timeout=3
            )
            print("Bin", flush=True)

            if response.status_code in [200, 201]:
                task_info = response.json()
                self.processed["bin_alert"] += 1
                assigned_to = task_info.get("assigned_to", "unassigned")
                print(f"🗑️  BIN ALERT: {bin_id} → Task {task_info['id']} assigned to {assigned_to}", flush=True)
            else:
                print(f"⚠️ Failed to create bin alert for {bin_id}: {response.text}", flush=True)

        except Exception as e:
            print(f"⚠️  Error creating bin alert for {bin_id}: {e}", flush=True)
    
    def handle_sos_event(self, event: Dict):
        sos_id = event.get("sos_id")
        location_node = event.get("location_node", "N10")
        priority = event.get("priority", "high")
        details = event.get("details", "").lower()

        # Determine role
        role = "medical" if any(x in details for x in ["medical", "faint", "injury"]) else "security"

        incident_payload = {
            "incident_type": role,
            "location_node": location_node,
            "priority": priority,
            "description": details
        }

        # 1️⃣ Create incident
        try:
            r = requests.post(f"{EMERGENCY_SERVICE_URL}/api/emergency/incidents",
                            json=incident_payload, timeout=3)
            if r.status_code not in [200, 201]:
                print(f"⚠️ Failed to create incident {sos_id}: {r.text}", flush=True)
                return
            incident_data = r.json()
            incident_id = incident_data.get("id") or incident_data.get("incident_id")
            if not incident_id:
                print(f"⚠️ Could not retrieve incident ID for {sos_id}", flush=True)
                return
        except Exception as e:
            print(f"⚠️ Error creating incident {sos_id}: {e}", flush=True)
            return

        # 2️⃣ Dispatch responders
        try:
            response = requests.post(
                f"{EMERGENCY_SERVICE_URL}/api/emergency/dispatch",
                json={
                    "incident_id": incident_id,
                    "responder_role": role,
                    "num_responders": 1
                },
                timeout=3
            )
            print("Emergency", flush=True)

            if response.status_code in [200, 201]:
                dispatch_list = response.json()
                if dispatch_list:
                    assigned = dispatch_list[0]

                    # Robust key access with fallbacks
                    staff_id = assigned.get("staff_id") or assigned.get("id") or assigned.get("staffId") or "UNKNOWN"
                    eta = assigned.get("eta_seconds") or assigned.get("etaSeconds") or 0

                    self.processed["sos_event"] += 1
                    print(f"🚨 SOS: {sos_id} → {staff_id} ({role}) ETA: {eta}s", flush=True)
                else:
                    print(f"⚠️ No {role} staff assigned for {sos_id}", flush=True)
            else:
                print(f"⚠️ No {role} staff available for {sos_id} (status {response.status_code})", flush=True)

        except Exception as e:
            print(f"⚠️ Failed to respond to {sos_id}: {e}", flush=True)
        
    def handle_crowd_density(self, event: Dict):
        """
        Crowd density → Update hazard map in Routing Service
        
        Event: {
            "event_type": "crowd_density",
            "area_id": "N42",
            "current_count": 150,
            "capacity": 200,
            "occupancy_rate": 75.0,
            "heat_level": "yellow"
        }
        """
        area_id = event.get("area_id")
        occupancy_rate = min(event.get("occupancy_rate", 0), 100)

        
        # Only update if occupancy > 50%
        if occupancy_rate > 50:
            try:
                response = requests.post(
                    f"{ROUTING_SERVICE_URL}/api/hazards/crowd",
                    params={
                        "node_id": area_id,
                        "occupancy_rate": occupancy_rate
                    },
                    timeout=2
                )
                print("Crowd", flush=True)
                
                if response.status_code == 200:
                    self.processed["crowd_density"] += 1
                    
                    if occupancy_rate > 80:
                        print(f"👥 CROWD ALERT: {area_id} at {occupancy_rate:.0f}% capacity", flush=True)
            
            except Exception as e:
                print(f"⚠️  Failed to update crowd penalty for {area_id}: {e}", flush=True)
    
    def handle_evacuation(self, event: Dict):
        """
        Evacuation → Close corridor in Routing & Map Services
        
        Event example:
        {
            "event_type": "evac_update",
            "closure": {
                "edge": "N23-N24",
                "from_node": "N23",
                "to_node": "N24",
                "reason": "smoke",
                "closed": true
            }
        }
        """
        closure = event.get("closure", {})
        from_node = closure.get("from_node")
        to_node = closure.get("to_node")
        reason = closure.get("reason", "emergency")

        if not from_node or not to_node:
            return  # Cannot proceed without nodes

        try:
            # 1️⃣ Close in Routing Service
            routing_resp = requests.post(
                f"{ROUTING_SERVICE_URL}/api/hazards/closure",
                params={"from_node": from_node, "to_node": to_node},
                timeout=2
            )
            if routing_resp.status_code == 200:
                self.processed["evac_update"] += 1
                print(f"🚧 EVACUATION: Closed {from_node} ↔ {to_node} ({reason})", flush=True)

            # 2️⃣ Find the edge ID for Map Service
            # This assumes your edges have IDs like "N23-N24" or you can query DB/API
            edge_id = f"{from_node}-{to_node}"  # Implement a lookup in DB or routing service
            if not edge_id:
                print(f"⚠️ Could not find edge_id for {from_node}-{to_node}")
                return

            # 3️⃣ Add closure to Map Service
            map_payload = {
                "id": f"CL-{from_node}-{to_node}",
                "reason": reason,
                "edge_id": edge_id,
                "node_id": None
            }
            map_resp = requests.post(
                f"{MAP_SERVICE_URL}/api/closures",
                json=map_payload,
                timeout=2
            )
            if map_resp.status_code == 200:
                print(f"✅ Map closure added for {from_node}-{to_node}",flush=True)
            else:
                print(f"⚠️ Map closure failed: {map_resp.status_code}, {map_resp.text}",flush=True)
        except Exception as e:
            print(f"⚠️ Failed to add closure {from_node}-{to_node}: {e}", flush=True)
    
    def handle_queue_update(self, event: Dict):
        """
        Queue update → Update Queueing Service
        
        Event: {
            "event_type": "queue_update",
            "location_type": "TOILET",
            "location_id": "WC_NORTE_1",
            "queue_length": 5,
            "estimated_wait_min": 8.5
        }
        """
        location_id = event.get("location_id")
        location_type = event.get("location_type", "service").lower()
        queue_length = event.get("queue_length", 0)
        
        try:
            response = requests.post(
                f"{QUEUEING_SERVICE_URL}/api/queue/update",
                json={
                    "location_id": location_id,
                    "location_type": location_type,
                    "current_queue_length": queue_length,
                    "num_servers": 3 if location_type == "toilet" else 1
                },
                timeout=2
            )

            print("Queueu", flush=True)
            
            if response.status_code == 200:
                self.processed["queue_update"] += 1
        
        except Exception as e:
            print(f"⚠️  Failed to update queue {location_id}: {e}", flush=True)
    
    def print_stats(self):
        """Print processing statistics"""
        print("\n" + "="*60)
        print("📊 EVENT PROCESSOR STATISTICS")
        print("="*60)
        print(f"Total events: {self.event_count}")
        print("\nProcessed by type:")
        for event_type, count in self.processed.items():
            if count > 0:
                print(f"  {event_type:20s}: {count}")
        print("="*60 + "\n")


# ========== MQTT CLIENT ==========

if MQTT_AVAILABLE:

    class MQTTEventClient:

        print("\n" + "="*60)
        print("🔌 EVENT PROCESSOR - Starting")
        print("="*60)
        print(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
        print(f"MQTT Topic: {MQTT_TOPIC}")
        print(f"Map Service: {MAP_SERVICE_URL}")
        print(f"Routing Service: {ROUTING_SERVICE_URL}")
        print(f"Queueing Service: {QUEUEING_SERVICE_URL}")
        print(f"Wait Times Service: {WAIT_TIMES_SERVICE_URL}")
        print(f"Congestion Service: {CONGESTION_SERVICE_URL}")
        print("="*60 + "\n")
        
        # Check services are running
        print("🏥 Checking services...")
        services_ok = True
        
        try:
            r = requests.get(f"{MAP_SERVICE_URL}/health", timeout=2)
            if r.status_code == 200:
                print("✅ Map Service")
            else:
                print("⚠️  Map Service not responding")
                services_ok = False
        except:
            print("❌ Map Service not available")
            services_ok = False
        
        try:
            r = requests.get(f"{ROUTING_SERVICE_URL}/health", timeout=2)
            if r.status_code == 200:
                print("✅ Routing Service")
            else:
                print("⚠️  Routing Service not responding")
                services_ok = False
        except:
            print("❌ Routing Service not available")
            services_ok = False
        
        try:
            r = requests.get(f"{QUEUEING_SERVICE_URL}/", timeout=2)
            if r.status_code == 200:
                print("✅ Queueing Service")
            else:
                print("⚠️  Queueing Service not responding")
                services_ok = False
        except:
            print("❌ Queueing Service not available")
            services_ok = False
        
        try:
            r = requests.get(f"{WAIT_TIMES_SERVICE_URL}/", timeout=2)
            if r.status_code == 200:
                print("✅ Wait Times Service")
            else:
                print("⚠️  Wait Times Service not responding")
        except:
            print("⚠️  Wait Times Service not available (optional)")
        
        try:
            r = requests.get(f"{CONGESTION_SERVICE_URL}/", timeout=2)
            if r.status_code == 200:
                print("✅ Congestion Service")
            else:
                print("⚠️  Congestion Service not responding")
        except:
            print("⚠️  Congestion Service not available (optional)")
        
        if not services_ok:
            print("\n⚠️  Some services not available. Starting anyway...")
        
        print("\n🚀 Starting event processing...\n")

        def __init__(self, processor: EventProcessor):
            self.processor = processor
            self.client = mqtt.Client(
                client_id=f"event-processor-{os.getpid()}",
                clean_session=True
            )

            # Optional authentication
            mqtt_user = os.getenv("MQTT_USERNAME")
            mqtt_pass = os.getenv("MQTT_PASSWORD")
            if mqtt_user and mqtt_pass:
                self.client.username_pw_set(mqtt_user, mqtt_pass)

            # Attach callbacks
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message

            # LWT (Last Will)
            self.client.will_set(
                "stadium/system/event_processor/status",
                payload="offline",
                qos=1,
                retain=True
            )

        # ---------- MQTT CALLBACKS ----------

        def on_connect(self, client, userdata, flags, rc):
            if rc == 0:
                print(f"✅ Connected to MQTT broker {MQTT_BROKER}:{MQTT_PORT}" , flush=True)
                client.subscribe(MQTT_TOPIC, qos=1)
                client.publish(
                    "stadium/system/event_processor/status",
                    payload="online",
                    qos=1,
                    retain=True
                )
                print(f"📡 Subscribed to topic: {MQTT_TOPIC}" , flush=True)
            else:
                print(f"❌ MQTT connection failed (code {rc})" , flush=True)

        def on_disconnect(self, client, userdata, rc):
            if rc != 0:
                print("⚠️  Unexpected MQTT disconnection, retrying...", flush=True)
            else:
                print("🔌 MQTT disconnected cleanly", flush=True)

        def on_message(self, client, userdata, msg):
            try:
                payload = msg.payload.decode("utf-8")
                event = json.loads(payload)

                if isinstance(event, Dict):
                    self.processor.process_event(event)
                else:
                    print(f"⚠️  Invalid event format on {msg.topic}", flush=True)

            except json.JSONDecodeError:
                print(f"⚠️  Invalid JSON on topic {msg.topic}" , flush=True)
            except Exception as e:
                print(f"❌ Error handling MQTT message: {e}", flush=True)

        # ---------- CONTROL ----------

        def start(self):
            print("🚀 Starting MQTT event listener...", flush=True)
            self.client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            self.client.loop_start()

        def stop(self):
            print("🛑 Stopping MQTT client...", flush=True)
            self.client.publish(
                "stadium/system/event_processor/status",
                payload="offline",
                qos=1,
                retain=True
            )
            time.sleep(0.5)
            self.client.loop_stop()
            self.client.disconnect()

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()

def start_health_server():
    server = HTTPServer(("0.0.0.0", 8004), HealthHandler)
    print("💓 Health endpoint listening on port 8004", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    if not MQTT_AVAILABLE:
        raise RuntimeError("MQTT support not available")

    processor = EventProcessor()
    mqtt_client = MQTTEventClient(processor)

    # Start health server in background
    threading.Thread(target=start_health_server, daemon=True).start()

    def shutdown(signum, frame):
        print("\n👋 Shutting down event processor...", flush=True)
        mqtt_client.stop()
        processor.print_stats()
        exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    mqtt_client.start()

    # Keep process alive
    while True:
        time.sleep(5)