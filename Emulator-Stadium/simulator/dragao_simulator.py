"""
SIMULATOR INTEGRATED - Connects to Map Service & Routing Service
Generates realistic stadium events with proper node IDs from database
"""

import json
import time
import uuid
import requests
from datetime import datetime
from collections import defaultdict
import random

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("⚠️  paho-mqtt not installed. Install: pip install paho-mqtt")

# ========== CONFIGURATION ==========

MAP_SERVICE_URL = "http://localhost:8000"
ROUTING_SERVICE_URL = "http://localhost:8002"
MQTT_BROKER = "localhost"
MQTT_PORT = 1883

# Hierarchical MQTT Topics
MQTT_TOPICS = {
    "gate_updates": "stadium/crowd/gate-updates",
    "bin_alerts": "stadium/maintenance/bin-alerts",
    "sos_events": "stadium/emergency/sos-events"
}

# ========== MQTT PUBLISHER ==========

class MQTTPublisher:
    def __init__(self, broker, port):
        self.broker = broker
        self.port = port
        self.client = None
        self.connected = False
        
        if MQTT_AVAILABLE:
            self.client = mqtt.Client(protocol=mqtt.MQTTv5)
            self.client.on_connect = self._on_connect
            try:
                self.client.connect(self.broker, self.port, 60)
                self.client.loop_start()
                time.sleep(1)
            except Exception as e:
                print(f"⚠️  MQTT not available: {e}")
    
    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
            print("✅ Connected to MQTT broker")
    
    def publish_event(self, event_type, event):
        """Publish event to appropriate hierarchical topic"""
        if self.connected and self.client:
            topic = MQTT_TOPICS.get(event_type, "stadium/events")
            self.client.publish(topic, json.dumps(event))
            print(f"📡 Published to {topic}: {event.get('event_type', event_type)}")

# ========== EVENT GENERATOR ==========

class IntegratedEventGenerator:
    def __init__(self, mqtt_publisher):
        self.mqtt = mqtt_publisher
        self.events = []
        self.event_count = 0
        
        # Counters
        self.gate_counters = defaultdict(int)
        self.zone_counters = defaultdict(int)
        self.bin_fill_levels = {}
        
        # Load data from Map Service
        self.nodes = []
        self.edges = []
        self.gates = []
        self.pois = []
        self.closures = []
        
        self.load_map_data()
    
    def load_map_data(self):
        """Fetch stadium data from Map Service"""
        try:
            print(f"📥 Fetching data from {MAP_SERVICE_URL}...")
            
            # Get complete map
            response = requests.get(f"{MAP_SERVICE_URL}/api/map", timeout=5)
            map_data = response.json()
            
            self.nodes = map_data.get('nodes', [])
            self.edges = map_data.get('edges', [])
            self.closures = map_data.get('closures', [])
            
            # Get gates
            response = requests.get(f"{MAP_SERVICE_URL}/api/gates", timeout=5)
            self.gates = response.json()
            
            # Get POIs
            response = requests.get(f"{MAP_SERVICE_URL}/api/pois", timeout=5)
            self.pois = response.json()
            
            print(f"✅ Loaded: {len(self.nodes)} nodes, {len(self.edges)} edges, "
                  f"{len(self.gates)} gates, {len(self.pois)} POIs")
            
            # Initialize bin levels for POI bins
            for poi in self.pois:
                if 'bin' in poi['category'].lower() or poi['category'] == 'restroom':
                    self.bin_fill_levels[poi['id']] = random.uniform(10, 30)
            
            return True
            
        except Exception as e:
            print(f"❌ Error loading map data: {e}")
            print(f"   Make sure Map Service is running at {MAP_SERVICE_URL}")
            return False
    
    def get_random_node(self, node_type=None):
        """Get random node, optionally filtered by type"""
        if node_type:
            candidates = [n for n in self.nodes if n.get('type') == node_type]
        else:
            candidates = self.nodes
        
        return random.choice(candidates) if candidates else None
    
    def get_node_by_id(self, node_id):
        """Get node by ID"""
        return next((n for n in self.nodes if n['id'] == node_id), None)
    
    def get_route(self, from_node, to_node):
        """Get route from Routing Service"""
        try:
            response = requests.get(
                f"{ROUTING_SERVICE_URL}/api/route",
                params={"from_node": from_node, "to_node": to_node},
                timeout=5
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"⚠️  Routing service error: {e}")
            return None
    
    # ========== EVENT GENERATORS ==========
    
    def generate_gate_event(self, gate_id, person_id, direction="entry"):
        """Gate passage event"""
        gate = next((g for g in self.gates if g['id'] == gate_id), None)
        if not gate:
            return None
        
        self.gate_counters[gate_id] += 1 if direction == "entry" else -1
        
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "gate_passage",
            "timestamp": datetime.now().isoformat() + "Z",
            "gate_id": gate_id,
            "person_id": f"P_{person_id:06d}",
            "direction": direction,
            "current_count": max(0, self.gate_counters[gate_id]),
            "throughput_per_min": round(random.uniform(15, 25), 1),
            "location": {"x": gate['x'], "y": gate['y']},
            "metadata": {
                "heat_level": "red" if self.gate_counters[gate_id] > 150 
                             else "yellow" if self.gate_counters[gate_id] > 80 
                             else "green"
            }
        }
        
        self.events.append(event)
        self.mqtt.publish_event("gate_updates", event)
        self.event_count += 1
        return event
    
    def generate_bin_alert(self, bin_poi_id):
        """Bin overflow alert for cleaning staff"""
        poi = next((p for p in self.pois if p['id'] == bin_poi_id), None)
        if not poi:
            return None
        
        fill_pct = self.bin_fill_levels.get(bin_poi_id, 0)
        fill_pct = min(100, fill_pct + random.uniform(10, 20))
        self.bin_fill_levels[bin_poi_id] = fill_pct
        
        # Find nearest node to this POI
        nearest_node = min(
            self.nodes,
            key=lambda n: ((n['x'] - poi['x'])**2 + (n['y'] - poi['y'])**2)**0.5
        )
        
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "bin_alert",
            "timestamp": datetime.now().isoformat() + "Z",
            "bin_id": bin_poi_id,
            "fill_percentage": round(fill_pct, 1),
            "priority": "critical" if fill_pct > 95 else "high" if fill_pct > 85 else "medium",
            "poi_node": nearest_node['id'],
            "location": {"x": poi['x'], "y": poi['y']},
            "assigned_role": "cleaning",
            "metadata": {
                "action_required": "empty_bin",
                "needs_service": fill_pct > 85
            }
        }
        
        self.events.append(event)
        self.mqtt.publish_event("bin_alerts", event)
        self.event_count += 1
        return event
    
    def generate_sos_event(self, location_node_id):
        """Emergency SOS event"""
        node = self.get_node_by_id(location_node_id)
        if not node:
            return None
        
        sos_id = f"SOS-{uuid.uuid4().hex[:6]}"
        
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "sos_event",
            "timestamp": datetime.now().isoformat() + "Z",
            "sos_id": sos_id,
            "priority": random.choice(["high", "critical"]),
            "location_node": location_node_id,
            "location": {"x": node['x'], "y": node['y']},
            "details": random.choice(["fainting", "injury", "chest_pain"]),
            "assigned_role": "security",
            "status": "active"
        }
        
        self.events.append(event)
        self.mqtt.publish_event("sos_events", event)
        self.event_count += 1
        
        # Assign nearest responder
        self.assign_responder(sos_id, location_node_id, "security")
        
        return event
    
    def assign_responder(self, incident_id, location_node, role):
        """Assign nearest staff to incident"""
        try:
            response = requests.get(
                f"{ROUTING_SERVICE_URL}/api/emergency/nearest",
                params={"location": location_node, "role": role},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                
                event = {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "responder_assign",
                    "timestamp": datetime.now().isoformat() + "Z",
                    "incident_id": incident_id,
                    "responder": data.get('assigned_staff_id', 'STAFF_001'),
                    "responder_position": data['responder_position'],
                    "role": role,
                    "eta_seconds": data['eta_seconds'],
                    "route": data['path'],
                    "distance": data['distance']
                }
                
                self.events.append(event)
                self.mqtt.publish_event(event)
                self.event_count += 1
                return event
        
        except Exception as e:
            print(f"⚠️  Could not assign responder: {e}")
        
        return None
    
    def generate_evacuation_event(self):
        """Evacuation with corridor closure"""
        if len(self.edges) < 2:
            return None
        
        # Pick random edge to close
        edge = random.choice(self.edges)
        
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "evac_update",
            "timestamp": datetime.now().isoformat() + "Z",
            "closure": {
                "edge": f"{edge['from']}-{edge['to']}",
                "from_node": edge['from'],
                "to_node": edge['to'],
                "reason": random.choice(["smoke", "crowd", "structural"]),
                "closed": True
            },
            "metadata": {
                "severity": "critical"
            }
        }
        
        self.events.append(event)
        self.mqtt.publish_event(event)
        self.event_count += 1
        
        # Update Routing Service
        try:
            requests.post(
                f"{ROUTING_SERVICE_URL}/api/hazards/closure",
                params={"from_node": edge['from'], "to_node": edge['to']},
                timeout=5
            )
            print(f"🚧 Closure added: {edge['from']} ↔ {edge['to']}")
        except:
            pass
        
        return event
    
    def generate_crowd_density_event(self, area_node_id):
        """Crowd density update"""
        node = self.get_node_by_id(area_node_id)
        if not node:
            return None
        
        count = random.randint(10, 200)
        capacity = 150
        occupancy = (count / capacity) * 100
        
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "crowd_density",
            "timestamp": datetime.now().isoformat() + "Z",
            "area_id": area_node_id,
            "area_type": node.get('type', 'normal'),
            "current_count": count,
            "capacity": capacity,
            "occupancy_rate": round(occupancy, 1),
            "location": {"x": node['x'], "y": node['y']},
            "heat_level": "red" if occupancy > 80 else "yellow" if occupancy > 50 else "green"
        }
        
        self.events.append(event)
        self.mqtt.publish_event(event)
        self.event_count += 1
        
        # Update crowd penalty in routing
        if occupancy > 60:
            try:
                requests.post(
                    f"{ROUTING_SERVICE_URL}/api/hazards/crowd",
                    params={"node_id": area_node_id, "penalty": occupancy},
                    timeout=5
                )
            except:
                pass
        
        return event

# ========== SIMULATION RUNNER ==========

def run_integrated_simulation(duration_seconds=60):
    """Run integrated simulation"""
    print("\n" + "="*60)
    print("STADIUM EVENT SIMULATOR - INTEGRATED VERSION")
    print("="*60 + "\n")
    
    mqtt_pub = MQTTPublisher(MQTT_BROKER, MQTT_PORT)
    event_gen = IntegratedEventGenerator(mqtt_pub)
    
    if not event_gen.nodes:
        print("❌ No map data loaded. Cannot proceed.")
        return
    
    print(f"\n🎬 Starting {duration_seconds}s simulation...\n")
    
    start_time = time.time()
    
    # Simulation loop
    while time.time() - start_time < duration_seconds:
        elapsed = time.time() - start_time
        
        # Gate events (frequent)
        if random.random() < 0.3:
            gate = random.choice(event_gen.gates)
            person_id = random.randint(1, 10000)
            event_gen.generate_gate_event(gate['id'], person_id, "entry")
        
        # Bin alerts (periodic)
        if elapsed % 10 < 1 and event_gen.bin_fill_levels:
            bin_id = random.choice(list(event_gen.bin_fill_levels.keys()))
            event_gen.generate_bin_alert(bin_id)
        
        # SOS events (rare)
        if random.random() < 0.05:
            node = event_gen.get_random_node()
            if node:
                event_gen.generate_sos_event(node['id'])
        
        # Crowd density updates (periodic)
        if elapsed % 8 < 1:
            node = event_gen.get_random_node()
            if node:
                event_gen.generate_crowd_density_event(node['id'])
        
        # Evacuation (very rare)
        if random.random() < 0.01:
            event_gen.generate_evacuation_event()
        
        time.sleep(1)  # 1 event per second
    
    print(f"\n✅ Simulation complete!")
    print(f"📊 Total events generated: {event_gen.event_count}")
    
    # Save events
    with open("stadium_events_integrated.json", "w") as f:
        json.dump(event_gen.events, f, indent=2)
    print(f"💾 Events saved to: stadium_events_integrated.json")

# ========== MAIN ==========

if __name__ == "__main__":
    import sys
    
    duration = 60
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except:
            pass
    
    run_integrated_simulation(duration)