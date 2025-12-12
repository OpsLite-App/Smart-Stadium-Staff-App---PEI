"""
CONGESTION SERVICE
Real-time crowd density monitoring and heatmap generation
Listens to MQTT crowd_density events and provides heatmap API
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import asyncio

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False

app = FastAPI(
    title="Congestion Service",
    description="Real-time crowd density monitoring and heatmap",
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

MQTT_BROKER = "localhost"
MQTT_PORT = 1883

# Subscribe to crowd-specific topics
MQTT_TOPICS = [
    "stadium/crowd/gate-updates"
]

# Thresholds for heat levels
THRESHOLD_GREEN = 50    # 0-50% occupancy
THRESHOLD_YELLOW = 80   # 50-80% occupancy
THRESHOLD_RED = 80      # 80-100% occupancy

# ========== STATE ==========

crowd_data: Dict[str, Dict] = {}
# {area_id: {count, capacity, occupancy_rate, heat_level, last_update, ...}}

historical_data: Dict[str, List] = defaultdict(list)
# {area_id: [{timestamp, occupancy_rate}, ...]}

MAX_HISTORY = 100  # Keep last 100 readings per area


# ========== MODELS ==========

class CrowdDensity(BaseModel):
    area_id: str
    area_type: str  # seating, corridor, service, gate
    current_count: int
    capacity: int
    occupancy_rate: float
    heat_level: str  # green, yellow, red
    status: str  # empty, normal, busy, crowded, critical
    last_update: str


class HeatmapResponse(BaseModel):
    timestamp: str
    total_areas: int
    areas: List[CrowdDensity]
    summary: Dict[str, int]  # {green: 10, yellow: 5, red: 2}


# ========== MQTT LISTENER ==========

def on_mqtt_message(client, userdata, msg):
    """Process crowd density events from MQTT"""
    try:
        import json
        event = json.loads(msg.payload.decode())
        event_type = event.get("event_type")
        
        if event_type == "crowd_density":
            area_id = event.get("area_id")
            area_type = event.get("area_type", "normal")
            current_count = event.get("current_count", 0)
            capacity = event.get("capacity", 100)
            occupancy_rate = event.get("occupancy_rate", 0)
            heat_level = event.get("heat_level", "green")
            
            # Determine status
            if occupancy_rate < 20:
                status = "empty"
            elif occupancy_rate < 50:
                status = "normal"
            elif occupancy_rate < 80:
                status = "busy"
            elif occupancy_rate < 95:
                status = "crowded"
            else:
                status = "critical"
            
            # Update current data
            crowd_data[area_id] = {
                "area_id": area_id,
                "area_type": area_type,
                "current_count": current_count,
                "capacity": capacity,
                "occupancy_rate": round(occupancy_rate, 2),
                "heat_level": heat_level,
                "status": status,
                "last_update": datetime.now().isoformat()
            }
            
            # Add to historical data
            historical_data[area_id].append({
                "timestamp": datetime.now().isoformat(),
                "occupancy_rate": occupancy_rate
            })
            
            # Trim history
            if len(historical_data[area_id]) > MAX_HISTORY:
                historical_data[area_id] = historical_data[area_id][-MAX_HISTORY:]
    
    except Exception as e:
        pass  # Silently fail


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


# ========== CLEANUP TASK ==========

async def cleanup_stale_data():
    """Remove stale data (no updates for 5+ minutes)"""
    while True:
        now = datetime.now()
        stale_threshold = timedelta(minutes=5)
        
        to_remove = []
        for area_id, data in crowd_data.items():
            last_update = datetime.fromisoformat(data["last_update"])
            if now - last_update > stale_threshold:
                to_remove.append(area_id)
        
        for area_id in to_remove:
            del crowd_data[area_id]
        
        await asyncio.sleep(60)  # Run every minute


# ========== STARTUP ==========

@app.on_event("startup")
async def startup():
    """Initialize service"""
    print("\n📊 Congestion Service starting...")
    
    # Start MQTT listener
    start_mqtt_listener()
    print("✓ MQTT listener started")
    
    # Start cleanup task
    asyncio.create_task(cleanup_stale_data())
    print("✓ Cleanup task started")
    
    print("✅ Congestion Service ready\n")


# ========== ENDPOINTS ==========

@app.get("/")
def root():
    """Health check"""
    return {
        "service": "Congestion Service",
        "version": "1.0.0",
        "status": "running",
        "tracked_areas": len(crowd_data),
        "mqtt_broker": f"{MQTT_BROKER}:{MQTT_PORT}"
    }


@app.get("/api/heatmap", response_model=HeatmapResponse)
def get_heatmap():
    """
    Get complete stadium heatmap
    
    Returns all areas with current crowd density
    """
    areas = [CrowdDensity(**data) for data in crowd_data.values()]
    
    # Calculate summary
    summary = {"green": 0, "yellow": 0, "red": 0}
    for area in areas:
        summary[area.heat_level] += 1
    
    return HeatmapResponse(
        timestamp=datetime.now().isoformat(),
        total_areas=len(areas),
        areas=areas,
        summary=summary
    )


@app.get("/api/heatmap/{area_id}", response_model=CrowdDensity)
def get_area_density(area_id: str):
    """
    Get crowd density for specific area
    
    Example: /api/heatmap/SECTOR_44
    """
    if area_id not in crowd_data:
        raise HTTPException(status_code=404, detail=f"No data for area {area_id}")
    
    return CrowdDensity(**crowd_data[area_id])


@app.get("/api/heatmap/by-type/{area_type}")
def get_density_by_type(area_type: str):
    """
    Get crowd density filtered by area type
    
    Example: /api/heatmap/by-type/seating
    """
    filtered = [
        CrowdDensity(**data)
        for data in crowd_data.values()
        if data["area_type"] == area_type
    ]
    
    if not filtered:
        raise HTTPException(status_code=404, detail=f"No {area_type} areas found")
    
    return {
        "area_type": area_type,
        "count": len(filtered),
        "areas": filtered
    }


@app.get("/api/congestion/alerts")
def get_congestion_alerts(threshold: float = Query(80.0, description="Alert if occupancy > threshold%")):
    """
    Get areas with high congestion
    
    Example: /api/congestion/alerts?threshold=80
    """
    alerts = []
    
    for data in crowd_data.values():
        if data["occupancy_rate"] >= threshold:
            alerts.append({
                **data,
                "severity": "critical" if data["occupancy_rate"] >= 95 else "high"
            })
    
    alerts.sort(key=lambda x: x["occupancy_rate"], reverse=True)
    
    return {
        "threshold": threshold,
        "alert_count": len(alerts),
        "alerts": alerts
    }


@app.get("/api/congestion/summary")
def get_congestion_summary():
    """
    Get overall stadium congestion summary
    """
    if not crowd_data:
        return {
            "total_areas": 0,
            "avg_occupancy": 0,
            "total_people": 0,
            "total_capacity": 0,
            "overall_status": "unknown"
        }
    
    total_count = sum(d["current_count"] for d in crowd_data.values())
    total_capacity = sum(d["capacity"] for d in crowd_data.values())
    avg_occupancy = (total_count / total_capacity * 100) if total_capacity > 0 else 0
    
    # Determine overall status
    if avg_occupancy < 40:
        overall_status = "low"
    elif avg_occupancy < 70:
        overall_status = "moderate"
    elif avg_occupancy < 85:
        overall_status = "high"
    else:
        overall_status = "critical"
    
    # Count by heat level
    heat_counts = {"green": 0, "yellow": 0, "red": 0}
    for data in crowd_data.values():
        heat_counts[data["heat_level"]] += 1
    
    return {
        "total_areas": len(crowd_data),
        "avg_occupancy": round(avg_occupancy, 2),
        "total_people": total_count,
        "total_capacity": total_capacity,
        "overall_status": overall_status,
        "by_heat_level": heat_counts
    }


@app.get("/api/congestion/history/{area_id}")
def get_area_history(
    area_id: str,
    limit: int = Query(20, description="Number of historical readings")
):
    """
    Get historical occupancy data for an area
    
    Example: /api/congestion/history/SECTOR_44?limit=50
    """
    if area_id not in historical_data:
        raise HTTPException(status_code=404, detail=f"No historical data for {area_id}")
    
    history = historical_data[area_id][-limit:]
    
    return {
        "area_id": area_id,
        "readings": len(history),
        "history": history
    }


@app.get("/api/congestion/hotspots")
def get_hotspots(top_n: int = Query(5, description="Number of top hotspots")):
    """
    Get most crowded areas (hotspots)
    
    Example: /api/congestion/hotspots?top_n=10
    """
    sorted_areas = sorted(
        crowd_data.values(),
        key=lambda x: x["occupancy_rate"],
        reverse=True
    )
    
    hotspots = sorted_areas[:top_n]
    
    return {
        "top_n": top_n,
        "hotspots": [CrowdDensity(**area) for area in hotspots]
    }


@app.get("/api/congestion/safest-areas")
def get_safest_areas(top_n: int = Query(5, description="Number of safest areas")):
    """
    Get least crowded areas
    
    Example: /api/congestion/safest-areas?top_n=5
    """
    sorted_areas = sorted(
        crowd_data.values(),
        key=lambda x: x["occupancy_rate"]
    )
    
    safest = sorted_areas[:top_n]
    
    return {
        "top_n": top_n,
        "safest_areas": [CrowdDensity(**area) for area in safest]
    }


@app.get("/api/congestion/trends")
def get_trends():
    """
    Get congestion trends (increasing/decreasing)
    """
    trends = {}
    
    for area_id, history in historical_data.items():
        if len(history) < 2:
            continue
        
        # Compare last 2 readings
        recent = history[-2:]
        trend = recent[1]["occupancy_rate"] - recent[0]["occupancy_rate"]
        
        if trend > 5:
            trend_status = "increasing"
        elif trend < -5:
            trend_status = "decreasing"
        else:
            trend_status = "stable"
        
        trends[area_id] = {
            "current": recent[1]["occupancy_rate"],
            "previous": recent[0]["occupancy_rate"],
            "change": round(trend, 2),
            "trend": trend_status
        }
    
    return trends


# ========== RUN ==========

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)