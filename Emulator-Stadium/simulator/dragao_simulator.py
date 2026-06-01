"""
OpsLite stadium emulator.

Generates realistic operational events for the current stack:
MQTT -> event_processor -> FastAPI services -> frontend-web.

The emulator uses routing-service GIS/pgRouting data when available and falls
back to a small numeric-node scenario that mirrors the current seeded flow.
"""

from __future__ import annotations

import json
import os
import random
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

try:
    import paho.mqtt.client as mqtt

    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("paho-mqtt not installed. Events will be stored locally only.")


ROUTING_SERVICE_URL = os.getenv("ROUTING_SERVICE_URL", "http://localhost:8002").rstrip("/")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8081").rstrip("/")
POSITIONING_SERVICE_URL = os.getenv("POSITIONING_SERVICE_URL", "http://localhost:8004").rstrip("/")
MQTT_BROKER = os.getenv("MQTT_HOST", os.getenv("MQTT_BROKER", "localhost"))
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
SIM_SCENARIO = os.getenv("SIM_SCENARIO", "matchday")
SIM_TICK_SECONDS = float(os.getenv("SIM_TICK_SECONDS", "1"))
SIM_OUTPUT_FILE = os.getenv("SIM_OUTPUT_FILE", "stadium_events_integrated.json")
USE_CROWD_MODELS = os.getenv("EMULATOR_USE_MODELS", "false").lower() in {"1", "true", "yes"}
SIM_CLOSURE_TTL_SECONDS = int(os.getenv("SIM_CLOSURE_TTL_SECONDS", "180"))

if os.getenv("SIM_SEED"):
    random.seed(int(os.environ["SIM_SEED"]))

MQTT_TOPICS = {
    "gate_updates": "stadium/crowd/gate-updates",
    "queue_update": "stadium/crowd/gate-updates",
    "bin_alerts": "stadium/maintenance/bin-alerts",
    "sos_events": "stadium/emergency/sos-events",
    "crowd_density": "stadium/crowd/density-updates",
    "evac_update": "stadium/emergency/evacuation-updates",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_optional_counter(module_name: str, factory_name: str = "get_counter"):
    if not USE_CROWD_MODELS:
        return None

    try:
        module = __import__(module_name, fromlist=[factory_name])
        factory = getattr(module, factory_name)
        return factory()
    except Exception as exc:
        print(f"Optional model {module_name} unavailable: {exc}")
        return None


CNN_COUNTER = load_optional_counter("cnn_counter")
ZIP_COUNTER = load_optional_counter("zip_counter")


class MQTTPublisher:
    def __init__(self, broker: str, port: int):
        self.broker = broker
        self.port = port
        self.client = None
        self.connected = False
        self.generator = None

        if not MQTT_AVAILABLE:
            return

        try:
            if hasattr(mqtt, "CallbackAPIVersion"):
                self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, protocol=mqtt.MQTTv5)
            else:
                self.client = mqtt.Client(protocol=mqtt.MQTTv5)
            self.client.on_connect = self._on_connect
            self.client.on_message = self._on_message
            self.client.connect(self.broker, self.port, 60)
            self.client.loop_start()
            time.sleep(0.5)
        except Exception as exc:
            print(f"MQTT broker unavailable at {self.broker}:{self.port}: {exc}")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
            print(f"Connected to MQTT broker at {self.broker}:{self.port}")
            try:
                self.client.subscribe("stadium/maintenance/empty")
                print("Subscribed to stadium/maintenance/empty")
            except Exception as e:
                print(f"Error subscribing: {e}")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            bin_id = payload.get("bin_id")
            if bin_id and self.generator:
                self.generator.bin_fill_levels[bin_id] = 0.0
                print(f"🗑️ SIMULATOR: Reset fill level for bin {bin_id} to 0.0%")
        except Exception as e:
            print(f"Error handling simulator MQTT message: {e}")

    def publish_event(self, event_type: str, event: dict[str, Any]):
        topic = MQTT_TOPICS.get(event_type, "stadium/events")
        if self.connected and self.client:
            self.client.publish(topic, json.dumps(event))
        print(f"published {event.get('event_type', event_type)} -> {topic}")



class OpsLiteEventGenerator:
    def __init__(self, mqtt_publisher: MQTTPublisher):
        self.mqtt = mqtt_publisher
        self.events: list[dict[str, Any]] = []
        self.event_count = 0
        self.gate_counters: defaultdict[str, int] = defaultdict(int)
        self.zone_counters: defaultdict[int, int] = defaultdict(int)
        self.bin_fill_levels: dict[str, float] = {}
        self.active_closures: set[int] = set()

        self.nodes: list[dict[str, Any]] = []
        self.nodes_by_id: dict[int, dict[str, Any]] = {}
        self.pois: list[dict[str, Any]] = []
        self.gates: list[dict[str, Any]] = []
        self.bins: list[dict[str, Any]] = []
        self.crowd_areas: list[dict[str, Any]] = []
        self.staff_list: list[dict[str, Any]] = []
        self.staff_positions: dict[str, dict[str, Any]] = {}

        self.load_operational_data()

    def load_operational_data(self):
        if self._load_from_routing_service():
            print(
                f"Loaded GIS data from routing-service: {len(self.nodes)} nodes, "
                f"{len(self.pois)} POIs"
            )
        else:
            self._load_fallback_data()
            print("Loaded local OpsLite fallback scenario")

        self._derive_operational_assets()

    def _load_from_routing_service(self) -> bool:
        try:
            nodes_resp = requests.get(f"{ROUTING_SERVICE_URL}/api/gis/nodes", timeout=5)
            pois_resp = requests.get(f"{ROUTING_SERVICE_URL}/api/pois", timeout=5)
            if nodes_resp.status_code != 200:
                return False

            features = nodes_resp.json().get("features", [])
            nodes = []
            for feature in features:
                props = feature.get("properties") or {}
                coords = (feature.get("geometry") or {}).get("coordinates") or [0, 0]
                node_id = props.get("node_id") or props.get("id")
                if node_id is None:
                    continue
                try:
                    numeric_id = int(str(node_id).removeprefix("N"))
                except ValueError:
                    continue

                nodes.append(
                    {
                        "id": numeric_id,
                        "floor_id": props.get("floor_id") or props.get("floor") or 1,
                        "type": props.get("type") or props.get("node_type") or "corridor",
                        "x": float(coords[0]),
                        "y": float(coords[1]),
                        "name": props.get("name") or f"Node {numeric_id}",
                    }
                )

            pois = []
            if pois_resp.status_code == 200:
                for poi in pois_resp.json():
                    node_id = poi.get("node_id")
                    if node_id is None:
                        continue
                    try:
                        numeric_node = int(str(node_id).removeprefix("N"))
                    except ValueError:
                        continue
                    pois.append(
                        {
                            "id": str(poi.get("id") or poi.get("name") or f"POI-{numeric_node}"),
                            "name": poi.get("name") or f"POI {numeric_node}",
                            "category": (poi.get("category") or "service").lower(),
                            "node_id": numeric_node,
                            "floor_id": poi.get("floor_id") or 1,
                        }
                    )

            if len(nodes) < 4:
                return False

            self.nodes = nodes
            self.nodes_by_id = {node["id"]: node for node in nodes}
            self.pois = pois
            return True
        except Exception as exc:
            print(f"Could not load routing-service GIS data: {exc}")
            return False

    def _load_fallback_data(self):
        self.nodes = [
            {"id": 62, "name": "Corredor principal F1", "floor_id": 1, "type": "corridor", "x": -8.58341, "y": 41.16138},
            {"id": 63, "name": "Bancada Norte F1", "floor_id": 1, "type": "stand", "x": -8.58325, "y": 41.16152},
            {"id": 64, "name": "Bar nascente F1", "floor_id": 1, "type": "service", "x": -8.58305, "y": 41.16133},
            {"id": 65, "name": "Entrada IT", "floor_id": 1, "type": "exit", "x": -8.58285, "y": 41.16124},
            {"id": 66, "name": "Posto operacional F1", "floor_id": 1, "type": "corridor", "x": -8.58356, "y": 41.16111},
            {"id": 70, "name": "Escadas Piso 2", "floor_id": 2, "type": "vertical_transition", "x": -8.58361, "y": 41.16166},
            {"id": 71, "name": "Galeria Piso 2", "floor_id": 2, "type": "corridor", "x": -8.58321, "y": 41.16178},
            {"id": 72, "name": "WC Piso 2", "floor_id": 2, "type": "service", "x": -8.58296, "y": 41.16172},
            {"id": 80, "name": "Sala medica", "floor_id": 1, "type": "medical", "x": -8.58372, "y": 41.16105},
        ]
        self.nodes_by_id = {node["id"]: node for node in self.nodes}
        self.pois = [
            {"id": "poi-exit-it", "name": "Entrada IT", "category": "exit", "node_id": 65, "floor_id": 1},
            {"id": "poi-bar-f1", "name": "Bar nascente", "category": "bar", "node_id": 64, "floor_id": 1},
            {"id": "poi-wc-f2", "name": "WC Piso 2", "category": "restroom", "node_id": 72, "floor_id": 2},
            {"id": "poi-medical", "name": "Sala medica", "category": "medical", "node_id": 80, "floor_id": 1},
        ]

    def _derive_operational_assets(self):
        exit_pois = [poi for poi in self.pois if poi["category"] in {"exit", "gate", "entrance"}]
        service_pois = [poi for poi in self.pois if poi["category"] in {"bar", "restroom", "toilet", "food", "service"}]

        self.gates = [
            self._asset_from_node("GATE-IT", "Entrada IT", 65),
            self._asset_from_node("GATE-F1-NORTH", "Entrada Norte F1", exit_pois[0]["node_id"] if exit_pois else 62),
            self._asset_from_node("GATE-F2-GALLERY", "Galeria Piso 2", 70 if 70 in self.nodes_by_id else self.nodes[0]["id"]),
        ]

        self.bins = []
        for index, poi in enumerate(service_pois[:5], start=1):
            node = self.nodes_by_id.get(poi["node_id"])
            if not node:
                continue
            bin_id = f"BIN-{poi['floor_id']}-{index:02d}"
            self.bins.append(
                {
                    "id": bin_id,
                    "name": f"Ecoponto {poi['name']}",
                    "node_id": poi["node_id"],
                    "floor_id": poi["floor_id"],
                    "x": node["x"],
                    "y": node["y"],
                }
            )

        if not self.bins:
            self.bins = [self._asset_from_node("BIN-F1-01", "Ecoponto corredor F1", 64)]

        self.bin_fill_levels = {bin_asset["id"]: random.uniform(25, 65) for bin_asset in self.bins}
        self.crowd_areas = [node for node in self.nodes if node["type"] in {"corridor", "stand", "service", "vertical_transition"}]
        if not self.crowd_areas:
            self.crowd_areas = self.nodes

    def _asset_from_node(self, asset_id: str, name: str, node_id: int) -> dict[str, Any]:
        node = self.nodes_by_id.get(node_id) or self.nodes[0]
        return {
            "id": asset_id,
            "name": name,
            "node_id": node["id"],
            "floor_id": node.get("floor_id", 1),
            "x": node["x"],
            "y": node["y"],
        }

    def _record(self, topic_key: str, event: dict[str, Any]) -> dict[str, Any]:
        self.events.append(event)
        self.event_count += 1
        self.mqtt.publish_event(topic_key, event)
        return event

    def _random_node(self, preferred_types: set[str] | None = None) -> dict[str, Any]:
        if preferred_types:
            candidates = [node for node in self.nodes if node.get("type") in preferred_types]
            if candidates:
                return random.choice(candidates)
        return random.choice(self.nodes)

    def generate_gate_event(self):
        gate = random.choice(self.gates)
        direction = random.choices(["entry", "exit"], weights=[0.75, 0.25])[0]
        delta = 1 if direction == "entry" else -1
        self.gate_counters[gate["id"]] = max(0, self.gate_counters[gate["id"]] + delta)

        model_count = CNN_COUNTER.get_count(gate["id"]) if CNN_COUNTER else None
        current_count = int(model_count if model_count is not None else self.gate_counters[gate["id"]])
        throughput = random.uniform(18, 42) if SIM_SCENARIO == "matchday" else random.uniform(4, 12)

        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "gate_passage",
            "timestamp": utc_now(),
            "gate_id": gate["id"],
            "gate_name": gate["name"],
            "person_id": f"P-{random.randint(1000, 999999)}",
            "direction": direction,
            "current_count": current_count,
            "throughput_per_min": round(throughput, 1),
            "location_node": gate["node_id"],
            "floor_id": gate["floor_id"],
            "location": {"x": gate["x"], "y": gate["y"]},
            "metadata": {
                "scenario": SIM_SCENARIO,
                "heat_level": "red" if current_count > 140 else "yellow" if current_count > 70 else "green",
            },
        }
        return self._record("gate_updates", event)

    def generate_queue_update(self):
        location = random.choice(self.bins + self.gates)
        is_gate = location["id"].startswith("GATE")
        queue_length = random.randint(0, 12 if is_gate else 18)
        wait_min = round(queue_length / (4.0 if is_gate else 1.7), 1)
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "queue_update",
            "timestamp": utc_now(),
            "location_id": location["id"],
            "location_name": location["name"],
            "location_type": "gate" if is_gate else "toilet",
            "queue_length": queue_length,
            "estimated_wait_min": wait_min,
            "location_node": location["node_id"],
            "floor_id": location["floor_id"],
            "location": {"x": location["x"], "y": location["y"]},
        }
        return self._record("queue_update", event)

    def generate_bin_alert(self):
        bin_asset = random.choice(self.bins)
        current_fill = self.bin_fill_levels.get(bin_asset["id"], 35)
        fill_pct = min(100, current_fill + random.uniform(4, 18))
        self.bin_fill_levels[bin_asset["id"]] = fill_pct

        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "bin_alert",
            "timestamp": utc_now(),
            "bin_id": bin_asset["id"],
            "fill_percentage": int(round(fill_pct)),
            "priority": "critical" if fill_pct >= 95 else "high" if fill_pct >= 85 else "medium",
            "poi_node": bin_asset["node_id"],
            "location_node": bin_asset["node_id"],
            "floor_id": bin_asset["floor_id"],
            "location": {"x": bin_asset["x"], "y": bin_asset["y"]},
            "assigned_role": "cleaning",
            "metadata": {
                "action_required": "empty_bin",
                "needs_service": fill_pct >= 85,
                "source": "emulator-stadium",
            },
        }
        return self._record("bin_alerts", event)

    def generate_sos_event(self):
        node = self._random_node({"corridor", "stand", "service", "vertical_transition"})
        emergency = random.choice(
            [
                ("medical", "high", "Queda de adepto com dor no tornozelo"),
                ("medical", "critical", "Possivel desmaio junto a zona de circulacao"),
                ("security", "high", "Discussao entre adeptos a bloquear passagem"),
                ("security", "medium", "Objeto suspeito reportado por assistente"),
            ]
        )
        assigned_role, severity, details = emergency

        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "sos_event",
            "timestamp": utc_now(),
            "sos_id": f"SOS-{uuid.uuid4().hex[:6].upper()}",
            "priority": severity,
            "severity": severity,
            "location_node": node["id"],
            "floor_id": node.get("floor_id", 1),
            "location": {"x": node["x"], "y": node["y"]},
            "details": details,
            "assigned_role": assigned_role,
            "status": "active",
            "metadata": {
                "source": "emulator-stadium",
                "recommended_route_target": 65,
            },
        }
        return self._record("sos_events", event)

    def generate_crowd_density_event(self):
        node = random.choice(self.crowd_areas)
        base = ZIP_COUNTER.get_count(node["id"]) if ZIP_COUNTER else None
        count = int(base if base is not None else random.randint(20, 190))
        capacity = 120 if node.get("type") == "corridor" else 180
        occupancy = min(100.0, (count / capacity) * 100)

        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "crowd_density",
            "timestamp": utc_now(),
            "area_id": str(node["id"]),
            "area_type": node.get("type", "corridor"),
            "current_count": count,
            "capacity": capacity,
            "occupancy_rate": round(occupancy, 1),
            "location_node": node["id"],
            "floor_id": node.get("floor_id", 1),
            "location": {"x": node["x"], "y": node["y"]},
            "heat_level": "red" if occupancy > 82 else "yellow" if occupancy > 55 else "green",
            "metadata": {"source": "emulator-stadium"},
        }

        if occupancy > 60:
            self._post_routing_crowd_penalty(node["id"], occupancy)
        return self._record("crowd_density", event)

    def generate_evacuation_update(self):
        node = self._random_node({"corridor", "vertical_transition", "service"})
        reason = random.choice(["smoke_detected", "crowd_pressure", "maintenance_blockage"])
        severity = random.choice([0.6, 0.8, 1.0])
        self.active_closures.add(node["id"])

        self._post_node_closure(node["id"], reason, severity)

        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "evac_update",
            "timestamp": utc_now(),
            "closure": {
                "node_id": node["id"],
                "from_node": node["id"],
                "to_node": node["id"],
                "reason": reason,
                "closed": True,
            },
            "floor_id": node.get("floor_id", 1),
            "location": {"x": node["x"], "y": node["y"]},
            "metadata": {
                "severity": severity,
                "source": "emulator-stadium",
                "routing_endpoint": "/api/graph/node-closures",
            },
        }
        return self._record("evac_update", event)

    def _post_routing_crowd_penalty(self, node_id: int, occupancy: float):
        try:
            requests.post(
                f"{ROUTING_SERVICE_URL}/api/hazards/crowd",
                params={"node_id": node_id, "occupancy_rate": round(occupancy, 1)},
                timeout=2,
            )
        except Exception:
            pass

    def _post_node_closure(self, node_id: int, reason: str, severity: float):
        ends_at = (datetime.now(timezone.utc) + timedelta(seconds=SIM_CLOSURE_TTL_SECONDS)).isoformat()

        try:
            response = requests.post(
                f"{ROUTING_SERVICE_URL}/api/graph/node-closures",
                json={
                    "node_id": node_id,
                    "reason": reason,
                    "source": "emulator-stadium",
                    "severity": severity,
                    "ends_at": ends_at,
                    "is_active": True,
                },
                timeout=3,
            )
            if response.status_code >= 400:
                print(f"routing-service rejected node closure {node_id}: {response.status_code}")
        except Exception as exc:
            print(f"could not update routing-service closure for node {node_id}: {exc}")

    def simulate_staff_movement(self):
        if not self.staff_list:
            try:
                resp = requests.get(f"{AUTH_SERVICE_URL}/auth/staff", timeout=3)
                if resp.status_code == 200:
                    self.staff_list = resp.json()
                    self.staff_positions = {}
                    for s in self.staff_list:
                        staff_id = str(s.get("id"))
                        loc = s.get("location")
                        start_node = None
                        if loc and loc.isdigit():
                            start_node = self.nodes_by_id.get(int(loc))
                        if not start_node:
                            start_node = random.choice(self.nodes) if self.nodes else None
                        if start_node:
                            self.staff_positions[staff_id] = start_node
                    print(f"Loaded {len(self.staff_list)} staff members for simulation.")
            except Exception as e:
                print(f"Could not load staff list in simulator: {e}")
                return

        for s in self.staff_list:
            staff_id = str(s.get("id"))
            current_node = self.staff_positions.get(staff_id)
            if not current_node:
                continue

            floor_nodes = [n for n in self.nodes if n.get("floor_id") == current_node.get("floor_id")]
            if not floor_nodes:
                continue

            curr_x, curr_y = current_node.get("x", 0), current_node.get("y", 0)
            candidates = [
                n for n in floor_nodes
                if abs(n.get("x", 0) - curr_x) + abs(n.get("y", 0) - curr_y) < 60
            ]
            if not candidates:
                candidates = floor_nodes

            next_node = random.choice(candidates)
            self.staff_positions[staff_id] = next_node

            payload = {
                "staff_id": staff_id,
                "x": next_node.get("x"),
                "y": next_node.get("y"),
                "zone": f"Floor {next_node.get('floor_id')}",
                "location_id": str(next_node.get("id"))
            }
            try:
                requests.put(
                    f"{POSITIONING_SERVICE_URL}/position/simulate",
                    json=payload,
                    timeout=2
                )
            except Exception as e:
                pass


def clear_previous_emulator_closures():
    try:
        response = requests.post(
            f"{ROUTING_SERVICE_URL}/api/graph/edge-overrides/deactivate-by-source",
            params={"source": "emulator-stadium"},
            timeout=3,
        )
        if response.status_code == 200:
            print(f"Cleared previous emulator closures: {response.json().get('deactivated', 0)}")
        elif response.status_code >= 400:
            print(f"Could not clear previous emulator closures: {response.status_code}")
    except Exception as exc:
        print(f"Could not clear previous emulator closures: {exc}")


def run_integrated_simulation(duration_seconds: int):
    print("=" * 68)
    print("OpsLite Stadium Emulator")
    print("=" * 68)
    print(f"routing-service: {ROUTING_SERVICE_URL}")
    print(f"mqtt: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"scenario: {SIM_SCENARIO}, duration: {duration_seconds}s")
    print(f"simulated closure TTL: {SIM_CLOSURE_TTL_SECONDS}s")
    print("=" * 68)

    clear_previous_emulator_closures()

    mqtt_pub = MQTTPublisher(MQTT_BROKER, MQTT_PORT)
    generator = OpsLiteEventGenerator(mqtt_pub)
    mqtt_pub.generator = generator

    start_time = time.time()
    last_bin = -14.0
    last_queue = -6.0
    last_density = -8.0
    last_evac = 0.0
    last_staff_move = -5.0

    while time.time() - start_time < duration_seconds:
        elapsed = time.time() - start_time

        if random.random() < 0.35:
            generator.generate_gate_event()

        if elapsed - last_queue >= 6:
            generator.generate_queue_update()
            last_queue = elapsed

        if elapsed - last_density >= 8:
            generator.generate_crowd_density_event()
            last_density = elapsed

        if elapsed - last_bin >= 14:
            generator.generate_bin_alert()
            last_bin = elapsed

        if elapsed - last_staff_move >= 5:
            generator.simulate_staff_movement()
            last_staff_move = elapsed

        if random.random() < 0.035:
            generator.generate_sos_event()

        if elapsed > 30 and elapsed - last_evac >= 75 and random.random() < 0.25:
            generator.generate_evacuation_update()
            last_evac = elapsed

        time.sleep(SIM_TICK_SECONDS)

    output_path = Path(SIM_OUTPUT_FILE)
    output_path.write_text(json.dumps(generator.events, indent=2), encoding="utf-8")
    print("=" * 68)
    print(f"Simulation complete: {generator.event_count} events")
    print(f"Events saved to {output_path}")


if __name__ == "__main__":
    import sys

    duration = int(os.getenv("SIM_DURATION_SECONDS", "3600"))
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except ValueError:
            pass

    run_integrated_simulation(duration)
