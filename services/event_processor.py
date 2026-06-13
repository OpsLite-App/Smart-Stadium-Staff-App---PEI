"""
EVENT PROCESSOR - Integration Layer
Connects Simulator → Services (Routing, Queueing, Congestion, Maintenance)

Listens to MQTT events and updates services accordingly
"""

import requests
import time
import json
import signal
from datetime import datetime, timedelta, timezone
from typing import Dict

from http.server import BaseHTTPRequestHandler, HTTPServer
import threading


try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("[WARNING] paho-mqtt is not installed. Install it with: pip install paho-mqtt")

# ========== CONFIGURATION ==========

import os
MQTT_BROKER = os.getenv("MQTT_HOST", os.getenv("MQTT_BROKER", "localhost"))
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = "stadium/#"

ROUTING_SERVICE_URL = os.getenv("ROUTING_SERVICE_URL", "http://routing-service:8002")
QUEUEING_SERVICE_URL = os.getenv("QUEUEING_SERVICE_URL", "http://queueing-service:8003")
WAIT_TIMES_SERVICE_URL = os.getenv("WAIT_TIMES_SERVICE_URL", "http://event-processor:8004")
CONGESTION_SERVICE_URL = os.getenv("CONGESTION_SERVICE_URL", "http://congestion-service:8005")
EMERGENCY_SERVICE_URL = os.getenv("EMERGENCY_SERVICE_URL", "http://emergency-service:8006")
MAINTENANCE_SERVICE_URL = os.getenv("MAINTENANCE_SERVICE_URL", "http://maintenance-service:8007")
EMULATOR_CLOSURE_TTL_SECONDS = int(os.getenv("EVENT_PROCESSOR_CLOSURE_TTL_SECONDS", "180"))
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "opslite-internal-dev-token")



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
        self.clear_previous_emulator_closures()

    def clear_previous_emulator_closures(self):
        """Clear stale blocking closures from previous emulator runs."""
        try:
            response = requests.post(
                f"{ROUTING_SERVICE_URL}/api/graph/edge-overrides/deactivate-by-source",
                params={"source": "emulator-stadium"},
                timeout=3,
            )
            if response.status_code == 200:
                print(f"[INFO] Cleared previous emulator closures: {response.json().get('deactivated', 0)}", flush=True)
            elif response.status_code >= 400:
                print(f"[WARNING] Could not clear previous emulator closures: {response.status_code}", flush=True)
        except Exception as exc:
            print(f"[WARNING] Could not clear previous emulator closures: {exc}", flush=True)
    
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
                print(f"[INFO] Events processed: count={self.event_count}")
        
        except Exception as e:
            print(f"[ERROR] Event processing failed: type={event_type} error={e}", flush=True)
    
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
                print(f"[WARNING] Queueing update failed: gate_id={gate_id} error={e}", flush=True)
    
    def handle_bin_alert(self, event: Dict):
        """
        Bin alert → Create a maintenance task for bin-full event and auto-assign
        Event example:
        {
            "event_type": "bin_alert",
            "bin_id": "B123",
            "poi_node": "65",
            "fill_percentage": 90,
            "priority": "high"
        }
        """
        fill_percentage = int(round(event.get("fill_percentage", 0)))
        if fill_percentage < 100:
            return  # Only process 100% full bins

        bin_id = event.get("bin_id")
        location_node = str(event.get("poi_node", "65"))
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
                print(f"[INFO] Bin alert created: bin_id={bin_id} task_id={task_info['id']} assigned_to={assigned_to}", flush=True)
            else:
                print(f"[WARNING] Bin alert creation failed: bin_id={bin_id} response={response.text}", flush=True)

        except Exception as e:
            print(f"[WARNING] Bin alert creation failed: bin_id={bin_id} error={e}", flush=True)
    
    def handle_sos_event(self, event: Dict):
        sos_id = event.get("sos_id")
        location_node = event.get("location_node", "66")
        priority = event.get("priority", "high")
        details = event.get("details", "").lower()
        assigned_role = str(event.get("assigned_role") or "").strip().lower()

        if assigned_role in {"security", "medic", "cleaning"}:
            role = assigned_role
        elif any(x in details for x in ["medical", "medic", "faint", "injury"]):
            role = "medic"
        else:
            role = "security"

        severity = priority if priority in {"low", "medium", "high", "critical"} else "high"

        incident_payload = {
            "incident_type": role,
            "location_node": str(location_node),
            "severity": severity,
            "description": details,
            "detected_by": "emulator",
            "reported_by": sos_id,
            "incident_metadata": {
                "source": "emulator-stadium",
                "sos_id": sos_id,
            },
        }

        try:
            r = requests.post(
                f"{EMERGENCY_SERVICE_URL}/api/emergency/internal/incidents",
                params={"auto_dispatch": True},
                json=incident_payload,
                headers={"X-Internal-Service-Token": INTERNAL_SERVICE_TOKEN},
                timeout=3,
            )
            if r.status_code not in [200, 201]:
                print(f"[WARNING] Incident creation failed: sos_id={sos_id} response={r.text}", flush=True)
                return
            incident_data = r.json()
            incident_id = incident_data.get("id") or incident_data.get("incident_id")
            if not incident_id:
                print(f"[WARNING] Incident ID unavailable after creation: sos_id={sos_id}", flush=True)
                return

            self.processed["sos_event"] += 1
            print(f"[INFO] SOS incident created: sos_id={sos_id} incident_id={incident_id} role={role} severity={severity}", flush=True)
        except Exception as e:
            print(f"[WARNING] Incident creation failed: sos_id={sos_id} error={e}", flush=True)
        
    def handle_crowd_density(self, event: Dict):
        """
        Crowd density → Increase pgRouting costs around busy nodes
        
        Event: {
            "event_type": "crowd_density",
            "area_id": "62",
            "current_count": 150,
            "capacity": 200,
            "occupancy_rate": 75.0,
            "heat_level": "yellow"
        }
        """
        area_id = event.get("area_id")
        try:
            occupancy_rate = min(float(event.get("occupancy_rate", 0)), 100.0)
        except (TypeError, ValueError):
            occupancy_rate = 0.0

        if not area_id:
            return

        source = f"emulator-stadium:crowd:{area_id}"

        if occupancy_rate <= 50:
            try:
                requests.post(
                    f"{ROUTING_SERVICE_URL}/api/graph/edge-overrides/deactivate-by-source",
                    params={"source": source},
                    timeout=2,
                )
            except Exception as e:
                print(f"[WARNING] Crowd impact clear failed: area_id={area_id} error={e}", flush=True)
            return

        if occupancy_rate >= 90:
            cost_multiplier = 7.5
            severity = 0.9
        elif occupancy_rate >= 80:
            cost_multiplier = 4.0
            severity = 0.75
        else:
            cost_multiplier = 2.0
            severity = 0.55

        try:
            ends_at = (datetime.now(timezone.utc) + timedelta(seconds=EMULATOR_CLOSURE_TTL_SECONDS)).isoformat()
            response = requests.post(
                f"{ROUTING_SERVICE_URL}/api/graph/node-impacts",
                json={
                    "node_id": int(area_id),
                    "cost_multiplier": cost_multiplier,
                    "reason": f"crowd_density_{occupancy_rate:.0f}pct",
                    "source": source,
                    "severity": severity,
                    "ends_at": ends_at,
                    "is_active": True,
                },
                timeout=3,
            )
            print("Crowd", flush=True)

            if response.status_code in [200, 201]:
                impacted_edges = len(response.json() or [])
                self.processed["crowd_density"] += 1

                if occupancy_rate > 80:
                    print(
                        f"[WARNING] Crowd routing impact applied: area_id={area_id} "
                        f"occupancy_rate={occupancy_rate:.0f} impacted_edges={impacted_edges}",
                        flush=True,
                    )
            else:
                print(
                    f"[WARNING] Crowd routing impact rejected: area_id={area_id} "
                    f"status={response.status_code} response={response.text}",
                    flush=True,
                )

        except Exception as e:
            print(f"[WARNING] Crowd penalty update failed: area_id={area_id} error={e}", flush=True)
    
    def handle_evacuation(self, event: Dict):
        """
        Evacuation → Close graph edges connected to the affected pgRouting node.

        The Routing Service now uses PostGIS/pgRouting as the source of truth.
        Legacy /api/hazards/* endpoints are ignored in this mode, so emulator
        closures must be written as graph_edge_overrides through node-closures.
        
        Event example:
        {
            "event_type": "evac_update",
            "closure": {
                "node_id": "63",
                "edge": "63-70",
                "from_node": "63",
                "to_node": "70",
                "reason": "smoke",
                "closed": true
            }
        }
        """
        closure = event.get("closure", {})
        node_id = closure.get("node_id") or closure.get("from_node") or closure.get("to_node")
        reason = closure.get("reason", "emergency")
        metadata = event.get("metadata", {})
        severity = metadata.get("severity", closure.get("severity", 1.0))

        if not node_id:
            print(f"[WARNING] Evacuation closure ignored: missing node_id event_id={event.get('event_id')}", flush=True)
            return

        try:
            ends_at = (datetime.now(timezone.utc) + timedelta(seconds=EMULATOR_CLOSURE_TTL_SECONDS)).isoformat()
            routing_resp = requests.post(
                f"{ROUTING_SERVICE_URL}/api/graph/node-closures",
                json={
                    "node_id": int(node_id),
                    "reason": reason,
                    "source": "emulator-stadium",
                    "severity": float(severity),
                    "ends_at": ends_at,
                    "is_active": True,
                },
                timeout=3
            )

            if routing_resp.status_code in [200, 201]:
                blocked_edges = len(routing_resp.json() or [])
                self.processed["evac_update"] += 1
                print(
                    f"[WARNING] Emulator node closure applied: node_id={node_id} "
                    f"blocked_edges={blocked_edges} reason={reason}",
                    flush=True,
                )
            else:
                print(
                    f"[WARNING] Emulator node closure rejected: node_id={node_id} "
                    f"status={routing_resp.status_code} response={routing_resp.text}",
                    flush=True,
                )

        except Exception as e:
            print(f"[WARNING] Emulator node closure failed: node_id={node_id} error={e}", flush=True)
    
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
            print(f"[WARNING] Queue update failed: location_id={location_id} error={e}", flush=True)
    
    def print_stats(self):
        """Print processing statistics"""
        print("\n" + "="*60)
        print("EVENT PROCESSOR STATISTICS")
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
        print("EVENT PROCESSOR - Starting")
        print("="*60)
        print(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
        print(f"MQTT Topic: {MQTT_TOPIC}")
        print(f"Routing Service: {ROUTING_SERVICE_URL}")
        print(f"Queueing Service: {QUEUEING_SERVICE_URL}")
        print(f"Wait Times Service: {WAIT_TIMES_SERVICE_URL}")
        print(f"Congestion Service: {CONGESTION_SERVICE_URL}")
        print("="*60 + "\n")
        
        # Check services are running
        print("[INFO] Checking service availability")
        services_ok = True
        
        try:
            r = requests.get(f"{ROUTING_SERVICE_URL}/health", timeout=2)
            if r.status_code == 200:
                print("[INFO] Routing Service available")
            else:
                print("[WARNING] Routing Service not responding")
                services_ok = False
        except:
            print("[ERROR] Routing Service unavailable")
            services_ok = False
        
        try:
            r = requests.get(f"{QUEUEING_SERVICE_URL}/", timeout=2)
            if r.status_code == 200:
                print("[INFO] Queueing Service available")
            else:
                print("[WARNING] Queueing Service not responding")
                services_ok = False
        except:
            print("[ERROR] Queueing Service unavailable")
            services_ok = False
        
        try:
            r = requests.get(f"{WAIT_TIMES_SERVICE_URL}/", timeout=2)
            if r.status_code == 200:
                print("[INFO] Wait Times Service available")
            else:
                print("[WARNING] Wait Times Service not responding")
        except:
            print("[WARNING] Wait Times Service unavailable (optional)")
        
        try:
            r = requests.get(f"{CONGESTION_SERVICE_URL}/", timeout=2)
            if r.status_code == 200:
                print("[INFO] Congestion Service available")
            else:
                print("[WARNING] Congestion Service not responding")
        except:
            print("[WARNING] Congestion Service unavailable (optional)")
        
        if not services_ok:
            print("\n[WARNING] Some services are unavailable; continuing startup")
        
        print("\n[INFO] Starting event processing\n")

        def __init__(self, processor: EventProcessor):
            self.processor = processor
            self.client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION1,
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
                print(f"[INFO] Connected to MQTT broker: host={MQTT_BROKER} port={MQTT_PORT}" , flush=True)
                client.subscribe(MQTT_TOPIC, qos=1)
                client.publish(
                    "stadium/system/event_processor/status",
                    payload="online",
                    qos=1,
                    retain=True
                )
                print(f"[INFO] Subscribed to MQTT topic: {MQTT_TOPIC}" , flush=True)
            else:
                print(f"[ERROR] MQTT connection failed: return_code={rc}" , flush=True)

        def on_disconnect(self, client, userdata, rc):
            if rc != 0:
                print("[WARNING] Unexpected MQTT disconnection; retrying", flush=True)
            else:
                print("[INFO] MQTT disconnected cleanly", flush=True)

        def on_message(self, client, userdata, msg):
            try:
                payload = msg.payload.decode("utf-8")
                event = json.loads(payload)

                if isinstance(event, Dict):
                    self.processor.process_event(event)
                else:
                    print(f"[WARNING] Invalid event format: topic={msg.topic}", flush=True)

            except json.JSONDecodeError:
                print(f"[WARNING] Invalid JSON payload: topic={msg.topic}" , flush=True)
            except Exception as e:
                print(f"[ERROR] MQTT message handling failed: {e}", flush=True)

        # ---------- CONTROL ----------

        def start(self):
            print("[INFO] Starting MQTT event listener", flush=True)
            self.client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            self.client.loop_start()

        def stop(self):
            print("[INFO] Stopping MQTT client", flush=True)
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
    print("[INFO] Health endpoint listening: port=8004", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    if not MQTT_AVAILABLE:
        raise RuntimeError("MQTT support not available")

    processor = EventProcessor()
    mqtt_client = MQTTEventClient(processor)

    # Start health server in background
    threading.Thread(target=start_health_server, daemon=True).start()

    def shutdown(signum, frame):
        print("\n[INFO] Shutting down event processor", flush=True)
        mqtt_client.stop()
        processor.print_stats()
        exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    mqtt_client.start()

    # Keep process alive
    while True:
        time.sleep(5)
