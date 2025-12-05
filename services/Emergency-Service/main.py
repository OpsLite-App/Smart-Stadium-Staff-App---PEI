"""
EMERGENCY SERVICE - Main Application
Manages emergencies, incidents, evacuations, and responder dispatch
Calls Routing Service for route calculations
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import asyncio

from models import IncidentStatus, IncidentSeverity, IncidentType
from schemas import (
    IncidentCreate, IncidentUpdate, IncidentResponse,
    EvacuationRequest, EvacuationResponse,
    DispatchRequest, DispatchResponse,
    SensorAlertCreate, SensorAlertResponse,
    IncidentStatistics, ActiveIncidentsResponse
)
from database import get_db, init_db
from incident_manager import IncidentManager
from evacuation_coordinator import EvacuationCoordinator

app = FastAPI(
    title="Stadium Emergency Service",
    description="Fire alarms, evacuations, and emergency incident management",
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

ROUTING_SERVICE_URL = "http://localhost:8002"
MAP_SERVICE_URL = "http://localhost:8000"
CONGESTION_SERVICE_URL = "http://localhost:8005"

EMERGENCY_CONTACTS = {
    "fire_brigade": "112",
    "police": "112",
    "ambulance": "112",
    "stadium_control": "+351-000-000-000"
}

# ========== GLOBAL STATE ==========

incident_manager: Optional[IncidentManager] = None
evacuation_coordinator: Optional[EvacuationCoordinator] = None


# ========== STARTUP ==========

@app.on_event("startup")
async def startup():
    """Initialize emergency service"""
    global incident_manager, evacuation_coordinator
    
    print("\n" + "="*60)
    print("🚨 EMERGENCY SERVICE - STARTING")
    print("="*60)
    
    # Initialize database
    init_db()
    print("✅ Database initialized")
    
    # Initialize managers (they will call Routing Service)
    incident_manager = IncidentManager(ROUTING_SERVICE_URL, MAP_SERVICE_URL)
    evacuation_coordinator = EvacuationCoordinator(
        ROUTING_SERVICE_URL,
        MAP_SERVICE_URL,
        CONGESTION_SERVICE_URL
    )
    print("✅ Incident manager initialized")
    print("✅ Evacuation coordinator initialized")
    
    # Start background tasks
    asyncio.create_task(check_incident_escalation())
    asyncio.create_task(update_evacuation_routes())
    print("✅ Background tasks started")
    
    print("\n" + "="*60)
    print("✅ EMERGENCY SERVICE READY")
    print(f"   - Routing Service: {ROUTING_SERVICE_URL}")
    print(f"   - Map Service: {MAP_SERVICE_URL}")
    print(f"   - Congestion Service: {CONGESTION_SERVICE_URL}")
    print("="*60 + "\n")


# ========== BACKGROUND TASKS ==========

async def check_incident_escalation():
    """Check for incidents that need escalation"""
    while True:
        await asyncio.sleep(30)  # Check every 30 seconds
        
        try:
            db = next(get_db())
            active = incident_manager.get_active_incidents(db)
            
            for incident in active:
                if incident_manager.should_escalate(incident):
                    print(f"⚠️  Incident {incident.id} needs escalation!")
                    incident_manager.escalate_incident(db, incident.id)
            
            db.close()
        except Exception as e:
            print(f"❌ Escalation check error: {e}")


async def update_evacuation_routes():
    """Periodically update evacuation routes based on congestion"""
    while True:
        await asyncio.sleep(60)  # Update every minute
        
        try:
            db = next(get_db())
            active_evacs = evacuation_coordinator.get_active_evacuations(db)
            
            for evac in active_evacs:
                await evacuation_coordinator.recalculate_routes(db, evac.id)
            
            db.close()
        except Exception as e:
            print(f"❌ Route update error: {e}")


# ========== HEALTH & STATUS ==========

@app.get("/")
def root():
    """Health check"""
    return {
        "service": "Emergency Service",
        "version": "1.0.0",
        "status": "running",
        "emergency_contacts": EMERGENCY_CONTACTS
    }


@app.get("/api/emergency/status")
def get_service_status(db: Session = Depends(get_db)):
    """Get service status and active incidents summary"""
    stats = incident_manager.get_statistics(db)
    active_incidents = incident_manager.get_active_incidents(db)
    active_evacuations = evacuation_coordinator.get_active_evacuations(db)
    
    return {
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "active_incidents": len(active_incidents),
        "active_evacuations": len(active_evacuations),
        "statistics": stats,
        "emergency_level": _determine_emergency_level(active_incidents)
    }


def _determine_emergency_level(incidents: List) -> str:
    """Determine overall emergency level"""
    if not incidents:
        return "normal"
    
    critical_count = sum(1 for i in incidents if i.severity == IncidentSeverity.CRITICAL)
    high_count = sum(1 for i in incidents if i.severity == IncidentSeverity.HIGH)
    
    if critical_count >= 3:
        return "critical"
    elif critical_count >= 1 or high_count >= 3:
        return "high"
    elif high_count >= 1:
        return "elevated"
    else:
        return "low"


# ========== INCIDENT MANAGEMENT ==========

@app.post("/api/emergency/incidents", response_model=IncidentResponse, status_code=201)
async def create_incident(
    incident: IncidentCreate,
    auto_dispatch: bool = Query(True, description="Automatically dispatch responders"),
    db: Session = Depends(get_db)
):
    """Create new emergency incident"""
    
    created_incident = incident_manager.create_incident(db, incident)
    
    # Auto-dispatch if critical
    if auto_dispatch and created_incident.severity in ["high", "critical"]:
        dispatches = await incident_manager.auto_dispatch_responders(db, created_incident.id)
        if dispatches:
            print(f"✅ Auto-dispatched {len(dispatches)} responders to incident {created_incident.id}")
    
    # Trigger evacuation if critical fire
    if created_incident.incident_type == "fire" and created_incident.severity == "critical":
        evac_request = EvacuationRequest(
            incident_id=created_incident.id,
            affected_zones=[created_incident.affected_area] if created_incident.affected_area else [],
            evacuation_type="partial",
            reason=f"Critical fire at {created_incident.location_node}"
        )
        await evacuation_coordinator.initiate_evacuation(db, evac_request)
        print(f"🚨 Evacuation triggered for incident {created_incident.id}")
    
    return created_incident


@app.get("/api/emergency/incidents", response_model=ActiveIncidentsResponse)
def get_incidents(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    incident_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """Get incidents with filters"""
    filters = {}
    if status:
        filters['status'] = status
    if severity:
        filters['severity'] = severity
    if incident_type:
        filters['incident_type'] = incident_type
    
    incidents = incident_manager.get_incidents(db, **filters)
    incidents = incidents[:limit]
    
    active_count = sum(1 for i in incidents if i.status == "active")
    
    return ActiveIncidentsResponse(
        total=len(incidents),
        active_count=active_count,
        incidents=incidents
    )


@app.get("/api/emergency/incidents/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Get specific incident details"""
    incident = incident_manager.get_incident(db, incident_id)
    
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    
    return incident


@app.patch("/api/emergency/incidents/{incident_id}", response_model=IncidentResponse)
def update_incident(incident_id: str, update: IncidentUpdate, db: Session = Depends(get_db)):
    """Update incident details"""
    incident = incident_manager.update_incident(db, incident_id, update)
    
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    
    return incident


@app.post("/api/emergency/incidents/{incident_id}/escalate")
def escalate_incident(incident_id: str, db: Session = Depends(get_db)):
    """Manually escalate incident severity"""
    incident = incident_manager.escalate_incident(db, incident_id)
    
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    
    return {
        "status": "escalated",
        "incident_id": incident_id,
        "new_severity": incident.severity,
        "message": f"Incident escalated to {incident.severity}"
    }


@app.post("/api/emergency/incidents/{incident_id}/resolve")
def resolve_incident(incident_id: str, notes: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Mark incident as resolved"""
    update = IncidentUpdate(status="resolved", notes=notes)
    incident = incident_manager.update_incident(db, incident_id, update)
    
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    
    return {
        "status": "resolved",
        "incident_id": incident_id,
        "resolved_at": incident.resolved_at
    }


# ========== SENSOR ALERTS ==========

@app.post("/api/emergency/sensors/alert", response_model=IncidentResponse, status_code=201)
async def create_sensor_alert(alert: SensorAlertCreate, db: Session = Depends(get_db)):
    """Create incident from sensor alert (fire, smoke, gas)"""
    incident = incident_manager.create_incident_from_sensor(db, alert)
    
    # Auto-dispatch for high severity
    if incident.severity in ["high", "critical"]:
        await incident_manager.auto_dispatch_responders(db, incident.id)
    
    return incident


@app.get("/api/emergency/sensors/alerts", response_model=List[SensorAlertResponse])
def get_sensor_alerts(
    sensor_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db)
):
    """Get sensor alerts"""
    return incident_manager.get_sensor_alerts(db, sensor_type=sensor_type, status=status, limit=limit)


# ========== RESPONDER DISPATCH ==========

@app.post("/api/emergency/dispatch", response_model=List[DispatchResponse])
async def dispatch_responders(request: DispatchRequest, db: Session = Depends(get_db)):
    """Dispatch responders to incident"""
    
    dispatches = await incident_manager.dispatch_responders(
        db,
        request.incident_id,
        request.responder_role,
        request.num_responders
    )
    
    if not dispatches:
        raise HTTPException(status_code=400, detail="No available responders or dispatch failed")
    
    return dispatches


@app.get("/api/emergency/dispatch/active")
def get_active_dispatches(db: Session = Depends(get_db)):
    """Get all active responder dispatches"""
    return incident_manager.get_active_dispatches(db)


@app.post("/api/emergency/dispatch/{dispatch_id}/arrived")
def mark_responder_arrived(dispatch_id: str, db: Session = Depends(get_db)):
    """Mark responder as arrived at incident location"""
    dispatch = incident_manager.mark_responder_arrived(db, dispatch_id)
    
    if not dispatch:
        raise HTTPException(status_code=404, detail=f"Dispatch {dispatch_id} not found")
    
    return {
        "status": "arrived",
        "dispatch_id": dispatch_id,
        "arrived_at": dispatch.arrived_at
    }


# ========== EVACUATION ==========

@app.post("/api/emergency/evacuation", response_model=EvacuationResponse, status_code=201)
async def initiate_evacuation(request: EvacuationRequest, db: Session = Depends(get_db)):
    """Initiate evacuation (partial or full)"""
    evacuation = await evacuation_coordinator.initiate_evacuation(db, request)
    return evacuation


@app.get("/api/emergency/evacuation/active")
def get_active_evacuations(db: Session = Depends(get_db)):
    """Get all active evacuations"""
    return evacuation_coordinator.get_active_evacuations(db)


@app.get("/api/emergency/evacuation/{evacuation_id}")
def get_evacuation_details(evacuation_id: str, db: Session = Depends(get_db)):
    """Get evacuation details including routes"""
    evac = evacuation_coordinator.get_evacuation(db, evacuation_id)
    
    if not evac:
        raise HTTPException(status_code=404, detail=f"Evacuation {evacuation_id} not found")
    
    return evac


@app.post("/api/emergency/evacuation/{evacuation_id}/complete")
def complete_evacuation(evacuation_id: str, db: Session = Depends(get_db)):
    """Mark evacuation as completed"""
    evac = evacuation_coordinator.complete_evacuation(db, evacuation_id)
    
    if not evac:
        raise HTTPException(status_code=404, detail=f"Evacuation {evacuation_id} not found")
    
    return {
        "status": "completed",
        "evacuation_id": evacuation_id,
        "completed_at": evac.completed_at
    }


# ========== STATISTICS ==========

@app.get("/api/emergency/stats", response_model=IncidentStatistics)
def get_statistics(db: Session = Depends(get_db)):
    """Get emergency incident statistics"""
    return incident_manager.get_statistics(db)


@app.get("/api/emergency/stats/timeline")
def get_incident_timeline(hours: int = Query(24), db: Session = Depends(get_db)):
    """Get incident timeline for last N hours"""
    return incident_manager.get_incident_timeline(db, hours)


# ========== RUN SERVER ==========

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007, log_level="info")