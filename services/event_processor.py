"""
EVENT PROCESSOR - Integration Layer
Connects Simulator → Services (Routing, Queueing, Map)

Listens to MQTT events and updates services accordingly
"""

import json
import requests
import time
from typing import Dict, Optional

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("⚠️  paho-mqtt not installed. Install: pip install paho-mqtt")

# ========== CONFIGURATION ==========

MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "stadium/events"

MAP_SERVICE_URL = "http://localhost:8000"
ROUTING_SERVICE_URL = "http://localhost:8002"
QUEUEING_SERVICE_URL = "http://localhost:8003"
WAIT_TIMES_SERVICE_URL = "http://localhost:8004"
CONGESTION_SERVICE_URL = "http://localhost:8005"

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
            print(f"❌ Error processing {event_type}: {e}")
    
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
                
                if response.status_code == 200:
                    self.processed["gate_passage"] += 1
                    # Reset counters
                    obs["arrivals"] = 0
                    obs["departures"] = 0
                    obs["last_update"] = current_time
            
            except Exception as e:
                print(f"⚠️  Failed to update queueing for {gate_id}: {e}")
    
    def handle_bin_alert(self, event: Dict):
        """
        Bin alert → Assign nearest cleaning staff
        
        Event: {
            "event_type": "bin_alert",
            "bin_id": "BIN-A12",
            "fill_percentage": 92,
            "poi_node": "N27",
            "location": {"x": 45.0, "y": 15.0},
            "priority": "high"
        }
        """
        if event.get("fill_percentage", 0) < 85:
            return  # Only process high fill levels
        
        bin_id = event.get("bin_id")
        poi_node = event.get("poi_node", "N5")  # Fallback
        
        try:
            # Find nearest cleaning staff
            response = requests.get(
                f"{ROUTING_SERVICE_URL}/api/emergency/nearest",
                params={
                    "location": poi_node,
                    "role": "cleaning"
                },
                timeout=3
            )
            
            if response.status_code == 200:
                data = response.json()
                self.processed["bin_alert"] += 1
                
                print(f"🗑️  BIN ALERT: {bin_id} → {data['staff_id']} (ETA: {data['eta_seconds']}s)")
            else:
                print(f"⚠️  No cleaning staff available for {bin_id}")
        
        except Exception as e:
            print(f"⚠️  Failed to assign staff to {bin_id}: {e}")
    
    def handle_sos_event(self, event: Dict):
        """
        SOS emergency → Assign nearest security/medical staff
        
        Event: {
            "event_type": "sos_event",
            "sos_id": "SOS-5a12",
            "priority": "high",
            "location_node": "N42",
            "location": {"x": 40.0, "y": 20.0},
            "details": "fainting"
        }
        """
        sos_id = event.get("sos_id")
        location_node = event.get("location_node", "N10")
        priority = event.get("priority", "high")
        
        # Determine role based on details
        details = event.get("details", "").lower()
        if "medical" in details or "faint" in details or "injury" in details:
            role = "medical"
        else:
            role = "security"
        
        try:
            # Assign nearest responder
            response = requests.post(
                f"{ROUTING_SERVICE_URL}/api/emergency/assign",
                json={
                    "location": location_node,
                    "incident_type": details,
                    "priority": priority,
                    "required_role": role
                },
                timeout=3
            )
            
            if response.status_code == 200:
                data = response.json()
                self.processed["sos_event"] += 1
                
                print(f"🚨 SOS: {sos_id} → {data['staff_id']} ({role}) ETA: {data['eta_seconds']}s")
            else:
                print(f"⚠️  No {role} staff available for {sos_id}")
        
        except Exception as e:
            print(f"⚠️  Failed to respond to {sos_id}: {e}")
    
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
        occupancy_rate = event.get("occupancy_rate", 0)
        
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
                
                if response.status_code == 200:
                    self.processed["crowd_density"] += 1
                    
                    if occupancy_rate > 80:
                        print(f"👥 CROWD ALERT: {area_id} at {occupancy_rate:.0f}% capacity")
            
            except Exception as e:
                print(f"⚠️  Failed to update crowd penalty for {area_id}: {e}")
    
    def handle_evacuation(self, event: Dict):
        """
        Evacuation → Close corridor in Routing Service
        
        Event: {
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
            return
        
        try:
            # Add closure to Routing Service
            response = requests.post(
                f"{ROUTING_SERVICE_URL}/api/hazards/closure",
                params={
                    "from_node": from_node,
                    "to_node": to_node
                },
                timeout=2
            )
            
            if response.status_code == 200:
                self.processed["evac_update"] += 1
                print(f"🚧 EVACUATION: Closed {from_node} ↔ {to_node} ({reason})")
            
            # Also add to Map Service database
            try:
                requests.post(
                    f"{MAP_SERVICE_URL}/api/closures",
                    json={
                        "id": f"CL-{from_node}-{to_node}",
                        "reason": reason,
                        "edge_id": None,  # Would need to lookup edge ID
                        "node_id": None
                    },
                    timeout=2
                )
            except:
                pass  # Map Service might not support POST
        
        except Exception as e:
            print(f"⚠️  Failed to add closure {from_node}-{to_node}: {e}")
    
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
            
            if response.status_code == 200:
                self.processed["queue_update"] += 1
        
        except Exception as e:
            print(f"⚠️  Failed to update queue {location_id}: {e}")
    
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

def on_connect(client, userdata, flags, rc, properties=None):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        print("✅ Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Subscribed to: {MQTT_TOPIC}")
    else:
        print(f"❌ Connection failed with code {rc}")


def on_message(client, userdata, msg):
    """Callback when message received"""
    processor = userdata['processor']
    
    try:
        event = json.loads(msg.payload.decode())
        processor.process_event(event)
    except json.JSONDecodeError:
        print(f"⚠️  Invalid JSON: {msg.payload}")
    except Exception as e:
        print(f"❌ Error: {e}")


def run_event_processor():
    """Main event processor loop"""
    if not MQTT_AVAILABLE:
        print("❌ paho-mqtt not available. Install with: pip install paho-mqtt")
        return
    
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
    
    # Create processor
    processor = EventProcessor()
    
    # Setup MQTT client
    client = mqtt.Client(protocol=mqtt.MQTTv5, userdata={'processor': processor})
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    
    except KeyboardInterrupt:
        print("\n\n⏹️  Stopping event processor...")
        processor.print_stats()
        client.disconnect()
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        processor.print_stats()


if __name__ == "__main__":
    run_event_processor()