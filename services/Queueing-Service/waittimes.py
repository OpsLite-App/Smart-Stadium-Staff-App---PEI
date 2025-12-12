"""
WAIT TIMES SERVICE
User-friendly API for wait times across all stadium locations
Aggregates data from Queueing Service + MQTT events
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import asyncio
import requests

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False

app = FastAPI(
    title="Wait Times Service",
    description="Real-time wait times for gates, toilets, bars, food stands",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== CONFIGURATION ==========

QUEUEING_SERVICE_URL = "http://localhost:8003"
MQTT_BROKER = "localhost"
MQTT_PORT = 1883

# Subscribe to crowd and gate topics for wait time estimation
MQTT_TOPICS = [
    "stadium/crowd/gate-updates"
]

# ========== STATE ==========

wait_times_cache: Dict[str, Dict] = {}
# {location_id: {wait_time, status, last_update, location_type, ...}}


# ========== MODELS ==========

class WaitTimeInfo(BaseModel):
    location_id: str
    location_name: str
    location_type: str  # gate, toilet, bar, food
    wait_time_minutes: float
    status: str  # empty, normal, busy, crowded, closed
    queue_length: int
    confidence: str  # high, medium, low
    last_update: str


# ========== MQTT LISTENER ==========

def on_mqtt_message(client, userdata, msg):
    """Process MQTT messages and update cache"""
    try:
        import json
        event = json.loads(msg.payload.decode())
        event_type = event.get("event_type")
        
        if event_type == "queue_update":
            location_id = event.get("location_id")
            location_type = event.get("location_type", "service")
            queue_length = event.get("queue_length", 0)
            wait_time = event.get("estimated_wait_min", 0)
            
            # Determine status
            if wait_time == 0:
                status = "empty"
            elif wait_time < 3:
                status = "normal"
            elif wait_time < 8:
                status = "busy"
            else:
                status = "crowded"
            
            wait_times_cache[location_id] = {
                "location_id": location_id,
                "location_name": _get_friendly_name(location_id),
                "location_type": location_type.lower(),
                "wait_time_minutes": wait_time,
                "status": status,
                "queue_length": queue_length,
                "confidence": "high" if wait_time < 10 else "medium",
                "last_update": datetime.now().isoformat()
            }
        
        elif event_type == "gate_passage":
            gate_id = event.get("gate_id")
            
            # Try to get wait time from Queueing Service
            try:
                response = requests.get(
                    f"{QUEUEING_SERVICE_URL}/api/queue/waittime/{gate_id}",
                    timeout=1
                )
                if response.status_code == 200:
                    data = response.json()
                    
                    wait_times_cache[gate_id] = {
                        "location_id": gate_id,
                        "location_name": _get_friendly_name(gate_id),
                        "location_type": "gate",
                        "wait_time_minutes": data["avg_wait_time_minutes"],
                        "status": data["status"],
                        "queue_length": int(data.get("queue_length", 0)),
                        "confidence": data["confidence"],
                        "last_update": datetime.now().isoformat()
                    }
            except:
                pass  # Silently fail
    
    except Exception as e:
        pass  # Don't log every error


def start_mqtt_listener():
    """Start MQTT listener in background"""
    if not MQTT_AVAILABLE:
        return
    
    def mqtt_thread():
        client = mqtt.Client(protocol=mqtt.MQTTv5)
        client.on_message = on_mqtt_message
        
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            for topic in MQTT_TOPICS:
                client.subscribe(topic)
            client.loop_forever()
        except:
            pass
    
    import threading
    thread = threading.Thread(target=mqtt_thread, daemon=True)
    thread.start()


# ========== HELPER FUNCTIONS ==========

def _get_friendly_name(location_id: str) -> str:
    """Convert location ID to friendly name"""
    name_map = {
        "Gate-1": "Gate 1 (Main Entrance)",
        "Gate-2": "Gate 2 (North)",
        "Gate-3": "Gate 3 (East)",
        "Gate-14": "Gate 14 (VIP)",
        "WC_NORTH_1": "Restroom North 1",
        "WC_NORTH_2": "Restroom North 2",
        "WC_SOUTH_1": "Restroom South 1",
        "WC_SOUTH_2": "Restroom South 2",
        "WC_EAST": "Restroom East",
        "WC_WEST": "Restroom West",
        "BAR_NORTH": "Bar North",
        "BAR_SOUTH": "Bar South",
        "BAR_EAST": "Bar East",
        "BAR_WEST": "Bar West",
    }
    return name_map.get(location_id, location_id)


def _categorize_location(location_id: str) -> str:
    """Infer location type from ID"""
    lid = location_id.upper()
    if "GATE" in lid:
        return "gate"
    elif "WC" in lid or "TOILET" in lid or "RESTROOM" in lid:
        return "toilet"
    elif "BAR" in lid:
        return "bar"
    elif "FOOD" in lid or "STORE" in lid:
        return "food"
    else:
        return "service"


async def sync_with_queueing_service():
    """Periodically sync with Queueing Service"""
    while True:
        try:
            response = requests.get(f"{QUEUEING_SERVICE_URL}/api/queue/status", timeout=2)
            if response.status_code == 200:
                data = response.json()
                
                for queue in data.get("queues", []):
                    location_id = queue["location_id"]
                    
                    wait_times_cache[location_id] = {
                        "location_id": location_id,
                        "location_name": _get_friendly_name(location_id),
                        "location_type": queue["location_type"],
                        "wait_time_minutes": queue["wait_time_minutes"],
                        "status": queue["status"],
                        "queue_length": queue["queue_length"],
                        "confidence": "high" if queue["wait_time_minutes"] < 10 else "medium",
                        "last_update": queue["last_update"]
                    }
        
        except Exception as e:
            pass
        
        await asyncio.sleep(10)  # Sync every 10 seconds


# ========== STARTUP ==========

@app.on_event("startup")
async def startup():
    """Initialize service"""
    print("\n🕐 Wait Times Service starting...")
    
    # Start MQTT listener
    start_mqtt_listener()
    print("✓ MQTT listener started")
    
    # Start background sync
    asyncio.create_task(sync_with_queueing_service())
    print("✓ Queueing Service sync started")
    
    print("✅ Wait Times Service ready\n")


# ========== ENDPOINTS ==========

@app.get("/")
def root():
    """Health check"""
    return {
        "service": "Wait Times Service",
        "version": "1.0.0",
        "status": "running",
        "tracked_locations": len(wait_times_cache),
        "queueing_service": QUEUEING_SERVICE_URL
    }


@app.get("/api/waittimes", response_model=List[WaitTimeInfo])
def get_all_wait_times(
    location_type: Optional[str] = Query(None, description="Filter by type: gate, toilet, bar, food")
):
    """
    Get wait times for all locations
    
    Example: /api/waittimes?location_type=toilet
    """
    results = []
    
    for location_id, data in wait_times_cache.items():
        # Filter by type if specified
        if location_type and data["location_type"] != location_type.lower():
            continue
        
        results.append(WaitTimeInfo(**data))
    
    # Sort by wait time (descending)
    results.sort(key=lambda x: x.wait_time_minutes, reverse=True)
    
    return results


@app.get("/api/waittimes/{location_id}", response_model=WaitTimeInfo)
def get_wait_time(location_id: str):
    """
    Get wait time for specific location
    
    Example: /api/waittimes/Gate-1
    """
    if location_id not in wait_times_cache:
        # Try to fetch from Queueing Service
        try:
            response = requests.get(
                f"{QUEUEING_SERVICE_URL}/api/queue/waittime/{location_id}",
                timeout=2
            )
            if response.status_code == 200:
                data = response.json()
                
                info = {
                    "location_id": location_id,
                    "location_name": _get_friendly_name(location_id),
                    "location_type": _categorize_location(location_id),
                    "wait_time_minutes": data["avg_wait_time_minutes"],
                    "status": data["status"],
                    "queue_length": int(data.get("queue_length", 0)),
                    "confidence": data["confidence"],
                    "last_update": data["timestamp"]
                }
                
                wait_times_cache[location_id] = info
                return WaitTimeInfo(**info)
        
        except:
            pass
        
        raise HTTPException(status_code=404, detail=f"No data for location {location_id}")
    
    return WaitTimeInfo(**wait_times_cache[location_id])


@app.get("/api/waittimes/summary/by-type")
def get_summary_by_type():
    """
    Get average wait times by location type
    
    Returns: {gate: 2.5, toilet: 4.2, bar: 3.1, food: 3.5}
    """
    by_type = {}
    counts = {}
    
    for data in wait_times_cache.values():
        loc_type = data["location_type"]
        wait_time = data["wait_time_minutes"]
        
        if loc_type not in by_type:
            by_type[loc_type] = 0
            counts[loc_type] = 0
        
        by_type[loc_type] += wait_time
        counts[loc_type] += 1
    
    # Calculate averages
    averages = {}
    for loc_type, total in by_type.items():
        averages[loc_type] = round(total / counts[loc_type], 2) if counts[loc_type] > 0 else 0
    
    return averages


@app.get("/api/waittimes/fastest/{location_type}")
def get_fastest_location(location_type: str):
    """
    Get location with shortest wait time
    
    Example: /api/waittimes/fastest/toilet
    """
    candidates = [
        data for data in wait_times_cache.values()
        if data["location_type"] == location_type.lower()
    ]
    
    if not candidates:
        raise HTTPException(status_code=404, detail=f"No {location_type} locations found")
    
    fastest = min(candidates, key=lambda x: x["wait_time_minutes"])
    
    return WaitTimeInfo(**fastest)


@app.get("/api/waittimes/alerts")
def get_alerts(threshold_minutes: float = Query(5.0, description="Alert if wait > threshold")):
    """
    Get locations with excessive wait times
    
    Example: /api/waittimes/alerts?threshold_minutes=5
    """
    alerts = []
    
    for data in wait_times_cache.values():
        if data["wait_time_minutes"] > threshold_minutes:
            alerts.append({
                **data,
                "severity": "critical" if data["wait_time_minutes"] > 10 else "high"
            })
    
    alerts.sort(key=lambda x: x["wait_time_minutes"], reverse=True)
    
    return {
        "threshold_minutes": threshold_minutes,
        "alert_count": len(alerts),
        "alerts": alerts
    }


# ========== RUN ==========

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)