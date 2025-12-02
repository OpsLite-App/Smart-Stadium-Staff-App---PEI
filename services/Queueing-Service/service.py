"""
QUEUEING SERVICE - Wait Time Estimation
Provides real-time queue analytics for stadium services
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import asyncio

from models import (
    mm1_queue, mmk_queue, 
    estimate_queue_from_observations,
    smooth_arrival_rate,
    calculate_wait_time_bounds,
    QueueMetrics, QueueStatus
)

app = FastAPI(
    title="Stadium Queueing Service",
    description="Real-time wait time estimation using queueing theory",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== GLOBAL STATE ==========

# Store queue state for each location
# {location_id: {arrivals, service_rate, observations, ...}}
queue_state: Dict[str, Dict] = {}


# ========== REQUEST/RESPONSE MODELS ==========

class QueueStateUpdate(BaseModel):
    """Update queue state with observations"""
    location_id: str
    location_type: str  # "gate", "toilet", "bar", "food"
    current_queue_length: int
    arrivals_last_minute: Optional[int] = None
    departures_last_minute: Optional[int] = None
    num_servers: int = 1


class WaitTimeRequest(BaseModel):
    """Request wait time estimation"""
    location_id: str
    arrival_rate: Optional[float] = None
    service_rate: Optional[float] = None
    num_servers: int = 1


class WaitTimeResponse(BaseModel):
    """Wait time estimation response"""
    location_id: str
    avg_wait_time_minutes: float
    wait_time_range: tuple
    queue_length: float
    status: str
    confidence: str
    utilization: float
    is_stable: bool
    timestamp: str


# ========== HELPER FUNCTIONS ==========

def get_default_service_rate(location_type: str) -> float:
    """
    Get default service rate for location type
    
    Based on typical service times:
    - Gate security: 15 seconds → 4 people/min
    - Toilet: 2 minutes → 0.5 people/min
    - Bar: 1.5 minutes → 0.67 people/min
    - Food stand: 2 minutes → 0.5 people/min
    """
    rates = {
        "gate": 4.0,      # 15 sec per person
        "toilet": 0.5,    # 2 min per person
        "bar": 0.67,      # 1.5 min per person
        "food": 0.5,      # 2 min per person
        "vip": 1.0        # 1 min per person
    }
    return rates.get(location_type.lower(), 0.5)


def initialize_queue_state(location_id: str, location_type: str, num_servers: int = 1):
    """Initialize state for a new location"""
    queue_state[location_id] = {
        "location_type": location_type,
        "num_servers": num_servers,
        "arrival_rate": 0.0,
        "service_rate": get_default_service_rate(location_type),
        "current_queue_length": 0,
        "observations": [],
        "last_update": datetime.now().isoformat()
    }


# ========== ENDPOINTS ==========

@app.get("/")
def root():
    """Health check"""
    return {
        "service": "Stadium Queueing Service",
        "version": "1.0.0",
        "status": "running",
        "tracked_queues": len(queue_state)
    }


@app.post("/api/queue/update")
def update_queue_state(update: QueueStateUpdate):
    """
    Update queue state with new observations
    
    Body: {
        "location_id": "Gate-1",
        "location_type": "gate",
        "current_queue_length": 15,
        "arrivals_last_minute": 12,
        "departures_last_minute": 8,
        "num_servers": 2
    }
    """
    
    # Initialize if new location
    if update.location_id not in queue_state:
        initialize_queue_state(update.location_id, update.location_type, update.num_servers)
    
    state = queue_state[update.location_id]
    
    # Update queue length
    state["current_queue_length"] = update.current_queue_length
    
    # Update arrival rate with smoothing
    if update.arrivals_last_minute is not None:
        new_arrival_rate = update.arrivals_last_minute  # per minute
        state["arrival_rate"] = smooth_arrival_rate(
            state["arrival_rate"],
            new_arrival_rate,
            alpha=0.3
        )
    
    # Update service rate if departures observed
    if update.departures_last_minute is not None and update.departures_last_minute > 0:
        # Service rate per server
        new_service_rate = update.departures_last_minute / update.num_servers
        state["service_rate"] = smooth_arrival_rate(
            state["service_rate"],
            new_service_rate,
            alpha=0.2  # Slower smoothing for service rate
        )
    
    state["num_servers"] = update.num_servers
    state["last_update"] = datetime.now().isoformat()
    
    # Calculate current metrics
    if update.num_servers == 1:
        metrics = mm1_queue(state["arrival_rate"], state["service_rate"])
    else:
        metrics = mmk_queue(state["arrival_rate"], state["service_rate"], update.num_servers)
    
    if not metrics:
        raise HTTPException(status_code=400, detail="Invalid queue parameters")
    
    return {
        "location_id": update.location_id,
        "updated": True,
        "arrival_rate": round(state["arrival_rate"], 2),
        "service_rate": round(state["service_rate"], 2),
        "current_metrics": {
            "wait_time_minutes": metrics.avg_wait_time,
            "status": metrics.status.value,
            "utilization": metrics.utilization
        }
    }


@app.get("/api/queue/waittime/{location_id}")
def get_wait_time(location_id: str):
    """
    Get current wait time estimate for a location
    
    Example: /api/queue/waittime/Gate-1
    """
    
    if location_id not in queue_state:
        raise HTTPException(
            status_code=404,
            detail=f"No data for location {location_id}. Call POST /api/queue/update first."
        )
    
    state = queue_state[location_id]
    
    # Calculate metrics
    if state["num_servers"] == 1:
        metrics = mm1_queue(state["arrival_rate"], state["service_rate"])
    else:
        metrics = mmk_queue(
            state["arrival_rate"],
            state["service_rate"],
            state["num_servers"]
        )
    
    if not metrics:
        raise HTTPException(status_code=500, detail="Failed to calculate metrics")
    
    # Calculate confidence bounds
    wait_time_range = calculate_wait_time_bounds(metrics)
    
    return WaitTimeResponse(
        location_id=location_id,
        avg_wait_time_minutes=metrics.avg_wait_time,
        wait_time_range=wait_time_range,
        queue_length=metrics.avg_queue_length,
        status=metrics.status.value,
        confidence=metrics.confidence,
        utilization=metrics.utilization,
        is_stable=metrics.is_stable,
        timestamp=state["last_update"]
    )


@app.post("/api/queue/calculate")
def calculate_wait_time(request: WaitTimeRequest):
    """
    Calculate wait time for given parameters (no state update)
    
    Body: {
        "location_id": "test",
        "arrival_rate": 10.0,
        "service_rate": 12.0,
        "num_servers": 1
    }
    """
    
    # Use provided rates or defaults
    arrival_rate = request.arrival_rate if request.arrival_rate is not None else 5.0
    service_rate = request.service_rate if request.service_rate is not None else 6.0
    
    # Calculate metrics
    if request.num_servers == 1:
        metrics = mm1_queue(arrival_rate, service_rate)
    else:
        metrics = mmk_queue(arrival_rate, service_rate, request.num_servers)
    
    if not metrics:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    
    wait_time_range = calculate_wait_time_bounds(metrics)
    
    return {
        "location_id": request.location_id,
        "input": {
            "arrival_rate": arrival_rate,
            "service_rate": service_rate,
            "num_servers": request.num_servers
        },
        "output": {
            "avg_wait_time_minutes": metrics.avg_wait_time,
            "wait_time_range": wait_time_range,
            "avg_queue_length": metrics.avg_queue_length,
            "avg_system_time": metrics.avg_system_time,
            "utilization": metrics.utilization,
            "status": metrics.status.value,
            "confidence": metrics.confidence,
            "is_stable": metrics.is_stable
        }
    }


@app.get("/api/queue/status")
def get_all_queues():
    """
    Get status of all tracked queues
    """
    result = []
    
    for location_id, state in queue_state.items():
        # Calculate metrics
        if state["num_servers"] == 1:
            metrics = mm1_queue(state["arrival_rate"], state["service_rate"])
        else:
            metrics = mmk_queue(
                state["arrival_rate"],
                state["service_rate"],
                state["num_servers"]
            )
        
        if metrics:
            result.append({
                "location_id": location_id,
                "location_type": state["location_type"],
                "wait_time_minutes": metrics.avg_wait_time,
                "queue_length": state["current_queue_length"],
                "status": metrics.status.value,
                "utilization": metrics.utilization,
                "last_update": state["last_update"]
            })
    
    # Sort by wait time (descending)
    result.sort(key=lambda x: x["wait_time_minutes"] if x["wait_time_minutes"] != float('inf') else 999, reverse=True)
    
    return {
        "total_queues": len(result),
        "queues": result
    }


@app.get("/api/queue/alerts")
def get_queue_alerts(threshold_minutes: float = Query(10.0, description="Alert threshold in minutes")):
    """
    Get queues with wait times above threshold
    
    Example: /api/queue/alerts?threshold_minutes=5
    """
    alerts = []
    
    for location_id, state in queue_state.items():
        if state["num_servers"] == 1:
            metrics = mm1_queue(state["arrival_rate"], state["service_rate"])
        else:
            metrics = mmk_queue(
                state["arrival_rate"],
                state["service_rate"],
                state["num_servers"]
            )
        
        if metrics and metrics.avg_wait_time > threshold_minutes:
            alerts.append({
                "location_id": location_id,
                "location_type": state["location_type"],
                "wait_time_minutes": metrics.avg_wait_time,
                "utilization": metrics.utilization,
                "status": metrics.status.value,
                "recommended_action": _get_recommendation(metrics, state)
            })
    
    alerts.sort(key=lambda x: x["wait_time_minutes"], reverse=True)
    
    return {
        "threshold_minutes": threshold_minutes,
        "alerts_count": len(alerts),
        "alerts": alerts
    }


def _get_recommendation(metrics: QueueMetrics, state: Dict) -> str:
    """Generate recommendation based on queue metrics"""
    if metrics.utilization >= 1.0:
        return f"CRITICAL: Add more servers (current: {state['num_servers']})"
    elif metrics.utilization >= 0.9:
        return f"HIGH: Consider adding 1 more server (current: {state['num_servers']})"
    elif metrics.utilization >= 0.8:
        return "MEDIUM: Monitor closely, may need additional capacity"
    else:
        return "OK: Queue operating normally"


@app.delete("/api/queue/{location_id}")
def remove_queue(location_id: str):
    """Remove queue from tracking"""
    if location_id in queue_state:
        del queue_state[location_id]
        return {"message": f"Queue {location_id} removed", "status": "success"}
    else:
        raise HTTPException(status_code=404, detail="Queue not found")


@app.get("/api/queue/compare")
def compare_scenarios(
    arrival_rate: float = Query(..., description="Arrival rate (people/min)"),
    service_rate: float = Query(..., description="Service rate (people/min per server)"),
    max_servers: int = Query(5, description="Max servers to simulate")
):
    """
    Compare wait times for different numbers of servers
    
    Example: /api/queue/compare?arrival_rate=10&service_rate=12&max_servers=5
    """
    scenarios = []
    
    for k in range(1, max_servers + 1):
        if k == 1:
            metrics = mm1_queue(arrival_rate, service_rate)
        else:
            metrics = mmk_queue(arrival_rate, service_rate, k)
        
        if metrics:
            scenarios.append({
                "num_servers": k,
                "wait_time_minutes": metrics.avg_wait_time,
                "utilization": metrics.utilization,
                "status": metrics.status.value,
                "is_stable": metrics.is_stable
            })
    
    return {
        "arrival_rate": arrival_rate,
        "service_rate": service_rate,
        "scenarios": scenarios
    }


# ========== RUN SERVER ==========

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)