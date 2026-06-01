"""
EMERGENCY SERVICE - Main Application
Manages emergencies, incidents, evacuations, and responder dispatch
Calls Routing Service for route calculations
"""

from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import Callable, List, Optional
from datetime import datetime
import asyncio
import httpx
import os
import uuid

from models import IncidentStatus, IncidentSeverity, IncidentType, EvacuationZone, EvacuationType
from schemas import (
    IncidentCreate, IncidentUpdate, IncidentResponse,
    EvacuationRequest, EvacuationResponse,
    GlobalEvacuationCreate, GlobalEvacuationResponse, EvacuationSafeRequest,
    DispatchRequest, DispatchResponse, ManualDispatchRequest,
    SensorAlertCreate, SensorAlertResponse, normalize_incident_category,
    IncidentStatistics, ActiveIncidentsResponse
)
from database import get_db, init_db
from incident_manager import IncidentManager
from evacuation_coordinator import EvacuationCoordinator
from realtime_events import RealtimeEventBus
from tracing_config import configure_tracing

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
configure_tracing(app)

# ========== CONFIGURATION ==========

ROUTING_SERVICE_URL = os.getenv("ROUTING_SERVICE_URL", "http://routing-service:8002")
CONGESTION_SERVICE_URL = os.getenv("CONGESTION_SERVICE_URL", "http://congestion-service:8003")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8081")
EVACUATION_EXIT_NODE = os.getenv("EVACUATION_EXIT_NODE", "65")

EMERGENCY_CONTACTS = {
    "fire_brigade": "112",
    "police": "112",
    "ambulance": "112",
    "stadium_control": "+351-000-000-000"
}

# ========== GLOBAL STATE ==========

incident_manager: Optional[IncidentManager] = None
evacuation_coordinator: Optional[EvacuationCoordinator] = None
realtime_events = RealtimeEventBus()


# ========== AUTH/RBAC ==========

def normalize_role(value: object) -> str:
    role = str(value or "").strip().lower()
    if role in {"cleaning", "cleaner", "maintenance"}:
        return "cleaning"
    if role in {"medical", "medic", "doctor"}:
        return "medical"
    if role in {"supervisor", "admin"}:
        return "supervisor"
    return "security"


def require_roles(*allowed_roles: str) -> Callable:
    allowed = {normalize_role(role) for role in allowed_roles}

    async def dependency(request: Request) -> dict:
        authorization = request.headers.get("authorization")
        cookie = request.headers.get("cookie")

        headers = {}
        endpoint = f"{AUTH_SERVICE_URL}/auth/me"
        method = "GET"

        if authorization and authorization.lower().startswith("bearer "):
            headers["Authorization"] = authorization
            endpoint = f"{AUTH_SERVICE_URL}/auth/validate"
            method = "POST"
        elif cookie and "AUTH_TOKEN=" in cookie:
            headers["Cookie"] = cookie
        else:
            raise HTTPException(status_code=401, detail="Authentication required")

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                if method == "POST":
                    response = await client.post(endpoint, headers=headers)
                else:
                    response = await client.get(endpoint, headers=headers)
        except httpx.HTTPError:
            raise HTTPException(status_code=503, detail="Authentication service unavailable")

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid authentication")

        claims = response.json()
        role = normalize_role(claims.get("role"))
        if role not in allowed:
            raise HTTPException(status_code=403, detail=f"Required role: {', '.join(sorted(allowed))}")

        return claims

    return dependency


# ========== STARTUP ==========

@app.on_event("startup")
async def startup():
    """Initialize emergency service"""
    global incident_manager, evacuation_coordinator
    
    print("\n" + "="*60)
    print("[INFO] Emergency Service starting")
    print("="*60)
    
    # Initialize database
    init_db()
    print("[INFO] Database initialized")
    
    # Initialize managers (they will call Routing Service)
    incident_manager = IncidentManager(ROUTING_SERVICE_URL)
    evacuation_coordinator = EvacuationCoordinator(
        ROUTING_SERVICE_URL,
        CONGESTION_SERVICE_URL
    )
    print("[INFO] Incident manager initialized")
    print("[INFO] Evacuation coordinator initialized")
    
    # Start background tasks
    asyncio.create_task(check_incident_escalation())
    asyncio.create_task(update_evacuation_routes())
    print("[INFO] Background tasks started")
    
    print("\n" + "="*60)
    print("[INFO] Emergency Service ready")
    print(f"   - Routing Service: {ROUTING_SERVICE_URL}")
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
                    print(f"[WARNING] Incident requires escalation: incident_id={incident.id}")
                    escalated = incident_manager.escalate_incident(db, incident.id)
                    if escalated:
                        publish_operational_event("incident.escalated", escalated)
            
            db.close()
        except Exception as e:
            print(f"[ERROR] Escalation check failed: {e}")


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
            print(f"[ERROR] Route update failed: {e}")


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


@app.get("/health")
def health_check():
    """Health check for Docker"""
    return {"status": "ok"}


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


def publish_operational_event(event_type: str, payload) -> None:
    realtime_events.publish(event_type, payload)


@app.get("/api/emergency/events")
async def stream_emergency_events(
    _auth: dict = Depends(require_roles("supervisor", "security", "medical", "cleaning"))
):
    """Stream emergency/dispatch updates to the frontend using Server-Sent Events."""
    return StreamingResponse(
        realtime_events.stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/emergency/audit/status")
def get_operational_audit_status(
    _auth: dict = Depends(require_roles("supervisor"))
):
    """Return Redis Stream and SSE subscriber status for supervisors."""
    return realtime_events.status()


@app.get("/api/emergency/audit/events")
def get_operational_audit_events(
    limit: int = Query(100, ge=1, le=500),
    event_type: Optional[str] = Query(None),
    _auth: dict = Depends(require_roles("supervisor"))
):
    """Return recent operational audit events, newest first."""
    return {
        "stream": realtime_events.status(),
        "events": realtime_events.list_events(limit=limit, event_type=event_type),
    }


# ========== INCIDENT MANAGEMENT ==========

@app.post("/api/emergency/incidents", response_model=IncidentResponse, status_code=201)
async def create_incident(
    incident: IncidentCreate,
    auto_dispatch: bool = Query(True, description="Automatically dispatch responders"),
    _auth: dict = Depends(require_roles("supervisor")),
    db: Session = Depends(get_db)
):
    """Create new emergency incident"""
    
    created_incident = incident_manager.create_incident(db, incident)
    publish_operational_event("incident.created", created_incident)
    
    # Auto-dispatch if critical
    if auto_dispatch and created_incident.severity in ["high", "critical"]:
        dispatches = await incident_manager.auto_dispatch_responders(db, created_incident.id)
        if dispatches:
            print(f"[INFO] Responders auto-dispatched: incident_id={created_incident.id} count={len(dispatches)}")
            publish_operational_event("dispatch.created", {
                "incident_id": created_incident.id,
                "dispatches": dispatches,
            })
    
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
        try:
            filters['incident_type'] = normalize_incident_category(incident_type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    
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
    
    publish_operational_event("incident.updated", incident)
    return incident


@app.patch("/api/emergency/incidents/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: str,
    update: IncidentUpdate,
    _auth: dict = Depends(require_roles("supervisor")),
    db: Session = Depends(get_db)
):
    """Update incident details"""
    try:
        incident = incident_manager.update_incident(db, incident_id, update)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    
    return incident


@app.post("/api/emergency/incidents/{incident_id}/escalate")
def escalate_incident(
    incident_id: str,
    _auth: dict = Depends(require_roles("supervisor")),
    db: Session = Depends(get_db)
):
    """Manually escalate incident severity"""
    incident = incident_manager.escalate_incident(db, incident_id)
    
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    
    publish_operational_event("incident.escalated", incident)
    return {
        "status": "escalated",
        "incident_id": incident_id,
        "new_severity": incident.severity,
        "message": f"Incident escalated to {incident.severity}"
    }


@app.post("/api/emergency/incidents/{incident_id}/resolve")
def resolve_incident(
    incident_id: str,
    notes: Optional[str] = Query(None),
    _auth: dict = Depends(require_roles("supervisor", "medical")),
    db: Session = Depends(get_db)
):
    """Mark incident as resolved"""
    update = IncidentUpdate(status="resolved", notes=notes)
    try:
        incident = incident_manager.update_incident(db, incident_id, update)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    
    publish_operational_event("incident.resolved", incident)
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
    publish_operational_event("sensor.alert", incident)
    
    # Auto-dispatch for high severity
    if incident.severity in ["high", "critical"]:
        try:
            dispatches = await incident_manager.auto_dispatch_responders(db, incident.id)
            if dispatches:
                publish_operational_event("dispatch.created", {
                    "incident_id": incident.id,
                    "dispatches": dispatches,
                })
        except Exception as e:
            # Dispatch failures must not break sensor alert ingestion.
            print(f"[WARNING] Auto-dispatch failed: incident_id={incident.id} error={e}")
    
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
async def dispatch_responders(
    request: DispatchRequest,
    _auth: dict = Depends(require_roles("supervisor")),
    db: Session = Depends(get_db)
):
    """Dispatch responders to incident"""
    
    try:
        dispatches = await incident_manager.dispatch_responders(
            db,
            request.incident_id,
            request.responder_role,
            request.num_responders
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    
    if not dispatches:
        raise HTTPException(status_code=400, detail="No available responders or dispatch failed")
    
    publish_operational_event("dispatch.created", {
        "incident_id": request.incident_id,
        "dispatches": dispatches,
    })
    return dispatches


@app.post("/api/emergency/dispatch/manual", response_model=DispatchResponse)
async def dispatch_specific_responder(
    request: ManualDispatchRequest,
    _auth: dict = Depends(require_roles("supervisor", "medical")),
    db: Session = Depends(get_db)
):
    """Dispatch a specific responder selected manually by a supervisor.

    Medical users may only self-assign medical incidents to themselves.
    """
    auth_role = normalize_role(_auth.get("role"))
    if auth_role == "medical":
        auth_user_id = str(_auth.get("user_id") or _auth.get("id") or "")
        if request.responder_role.lower() != "medic" or request.responder_id != auth_user_id:
            raise HTTPException(status_code=403, detail="Medical users can only self-assign medic dispatches")

    try:
        dispatch = await incident_manager.dispatch_specific_responder(db, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not dispatch:
        raise HTTPException(status_code=400, detail="Manual dispatch failed")

    publish_operational_event("dispatch.created", {
        "incident_id": request.incident_id,
        "dispatches": [dispatch],
    })
    return dispatch


@app.get("/api/emergency/dispatch/active")
def get_active_dispatches(db: Session = Depends(get_db)):
    """Get all active responder dispatches"""
    return incident_manager.get_active_dispatches(db)


@app.get("/api/emergency/dispatch/responder/{responder_id}", response_model=List[DispatchResponse])
def get_responder_dispatches(
    responder_id: str,
    responder_alias: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get the latest dispatch assignments for one responder."""
    responder_ids = [responder_id]
    if responder_alias and responder_alias not in responder_ids:
        responder_ids.append(responder_alias)
    return incident_manager.get_dispatches_for_responder(db, responder_ids, limit)


@app.get("/api/emergency/dispatch/incident/{incident_id}", response_model=List[DispatchResponse])
def get_incident_dispatches(incident_id: str, db: Session = Depends(get_db)):
    """Get dispatch status history for one incident"""
    return incident_manager.get_dispatches_for_incident(db, incident_id)


@app.post("/api/emergency/dispatch/{dispatch_id}/accept")
def accept_responder_dispatch(dispatch_id: str, db: Session = Depends(get_db)):
    """Mark a dispatch as accepted by the assigned responder"""
    dispatch = incident_manager.accept_responder_dispatch(db, dispatch_id)

    if not dispatch:
        raise HTTPException(status_code=404, detail=f"Dispatch {dispatch_id} not found")

    publish_operational_event("dispatch.accepted", dispatch)
    return {
        "status": "en_route",
        "dispatch_id": dispatch_id,
        "en_route_at": dispatch.en_route_at,
    }


@app.post("/api/emergency/dispatch/{dispatch_id}/refuse")
def refuse_responder_dispatch(dispatch_id: str, db: Session = Depends(get_db)):
    """Mark a dispatch as refused by the assigned responder"""
    dispatch = incident_manager.refuse_responder_dispatch(db, dispatch_id)

    if not dispatch:
        raise HTTPException(status_code=404, detail=f"Dispatch {dispatch_id} not found")

    publish_operational_event("dispatch.declined", dispatch)
    return {
        "status": "declined",
        "dispatch_id": dispatch_id,
        "completed_at": dispatch.completed_at,
    }


@app.post("/api/emergency/dispatch/{dispatch_id}/complete")
def complete_responder_dispatch(
    dispatch_id: str,
    notes: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Mark this responder's dispatch as completed"""
    dispatch = incident_manager.complete_responder_dispatch(db, dispatch_id, notes)

    if not dispatch:
        raise HTTPException(status_code=404, detail=f"Dispatch {dispatch_id} not found")

    publish_operational_event("dispatch.completed", dispatch)
    return {
        "status": "completed",
        "dispatch_id": dispatch_id,
        "completed_at": dispatch.completed_at,
    }


@app.post("/api/emergency/dispatch/{dispatch_id}/arrived")
def mark_responder_arrived(dispatch_id: str, db: Session = Depends(get_db)):
    """Mark responder as arrived at incident location"""
    dispatch = incident_manager.mark_responder_arrived(db, dispatch_id)
    
    if not dispatch:
        raise HTTPException(status_code=404, detail=f"Dispatch {dispatch_id} not found")
    
    publish_operational_event("dispatch.arrived", dispatch)
    return {
        "status": "arrived",
        "dispatch_id": dispatch_id,
        "arrived_at": dispatch.arrived_at
    }


# ========== EVACUATION ==========

def _evacuation_metadata(evacuation: EvacuationZone) -> dict:
    return evacuation.incident_metadata or {}


def _evacuation_source(evacuation_id: str) -> str:
    return f"evacuation:{evacuation_id}"


def _get_active_global_evacuation(db: Session) -> Optional[EvacuationZone]:
    evacuations = db.query(EvacuationZone).filter(EvacuationZone.status == "active").all()
    return next(
        (evac for evac in evacuations if _evacuation_metadata(evac).get("kind") == "global_evacuation"),
        None,
    )


def _global_evacuation_to_response(evacuation: EvacuationZone) -> GlobalEvacuationResponse:
    metadata = _evacuation_metadata(evacuation)
    confirmations = metadata.get("confirmations") or {}

    return GlobalEvacuationResponse(
        id=evacuation.id,
        active=evacuation.status == "active",
        status=evacuation.status,
        title=metadata.get("title") or evacuation.reason or "Evacuação ativa",
        description=metadata.get("description"),
        emergency_type=metadata.get("emergency_type") or "other",
        severity=metadata.get("severity") or "critical",
        source_node=str(metadata.get("source_node") or ""),
        floor_id=metadata.get("floor_id"),
        exit_node=str(metadata.get("exit_node") or EVACUATION_EXIT_NODE),
        affected_nodes=[str(node) for node in (evacuation.affected_nodes or [])],
        affected_zones=evacuation.affected_zones or [],
        instructions=metadata.get("instructions"),
        initiated_at=evacuation.initiated_at.isoformat(),
        completed_at=evacuation.completed_at.isoformat() if evacuation.completed_at else None,
        evacuated_count=evacuation.evacuated_count or len(confirmations),
        confirmations=confirmations,
    )


async def _notify_routing_node_closure(node_id: str, source: str, reason: str) -> list:
    if str(node_id) == str(EVACUATION_EXIT_NODE):
        return []

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(
            f"{ROUTING_SERVICE_URL}/api/graph/node-closures",
            json={
                "node_id": int(node_id),
                "reason": reason,
                "source": source,
                "severity": 1.0,
                "is_active": True,
            },
        )

    if response.status_code >= 400:
        print(f"[WARNING] Failed to close routing node: node_id={node_id} response={response.text}")
        return []

    return response.json()


async def _notify_routing_evacuation_event(evacuation: EvacuationZone) -> None:
    metadata = _evacuation_metadata(evacuation)

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{ROUTING_SERVICE_URL}/api/graph/events",
                json={
                    "event_type": "evacuation",
                    "title": metadata.get("title") or "Evacuação ativa",
                    "description": metadata.get("description") or evacuation.reason,
                    "severity": 1.0,
                    "status": "active",
                    "source": _evacuation_source(evacuation.id),
                    "floor_id": metadata.get("floor_id"),
                },
            )
    except Exception as exc:
        print(f"[WARNING] Failed to publish evacuation event: {exc}")


async def _clear_routing_evacuation_closures(evacuation_id: str) -> None:
    try:
        source = _evacuation_source(evacuation_id)
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{ROUTING_SERVICE_URL}/api/graph/edge-overrides/deactivate-by-source",
                params={"source": source},
            )
            await client.post(
                f"{ROUTING_SERVICE_URL}/api/graph/events/deactivate-by-source",
                params={"source": source},
            )
    except Exception as exc:
        print(f"[WARNING] Failed to clear evacuation routing state: {exc}")


@app.post("/api/emergency/evacuation/global", response_model=GlobalEvacuationResponse, status_code=201)
async def create_global_evacuation(
    request: GlobalEvacuationCreate,
    _auth: dict = Depends(require_roles("supervisor")),
    db: Session = Depends(get_db),
):
    """Supervisor declares a building evacuation to the fixed IT entrance node."""
    if _get_active_global_evacuation(db):
        raise HTTPException(status_code=409, detail="There is already an active global evacuation")

    evacuation_id = f"evac-{uuid.uuid4().hex[:8]}"
    affected_nodes = [str(node) for node in dict.fromkeys([request.source_node, *request.affected_nodes])]
    closure_nodes = [str(node) for node in dict.fromkeys(request.affected_nodes)]
    source = _evacuation_source(evacuation_id)

    metadata = {
        "kind": "global_evacuation",
        "title": request.title,
        "description": request.description,
        "emergency_type": request.emergency_type,
        "severity": request.severity,
        "source_node": str(request.source_node),
        "floor_id": request.floor_id,
        "exit_node": EVACUATION_EXIT_NODE,
        "instructions": request.instructions,
        "created_by": _auth.get("email") or _auth.get("username") or _auth.get("sub"),
        "confirmations": {},
    }

    evacuation = EvacuationZone(
        id=evacuation_id,
        incident_id=None,
        evacuation_type=EvacuationType.FULL,
        affected_zones=request.affected_zones,
        affected_nodes=affected_nodes,
        exit_routes={"exit_node": EVACUATION_EXIT_NODE},
        blocked_corridors=[],
        reason=request.title,
        status="active",
        incident_metadata=metadata,
    )

    db.add(evacuation)
    db.commit()
    db.refresh(evacuation)

    created_overrides = []
    for node_id in closure_nodes:
        created_overrides.extend(await _notify_routing_node_closure(node_id, source, request.title))

    metadata["routing_override_ids"] = [override.get("id") for override in created_overrides if isinstance(override, dict)]
    evacuation.blocked_corridors = [str(override.get("edge_id")) for override in created_overrides if isinstance(override, dict)]
    evacuation.incident_metadata = metadata
    db.commit()
    db.refresh(evacuation)

    await _notify_routing_evacuation_event(evacuation)
    response = _global_evacuation_to_response(evacuation)
    publish_operational_event("evacuation.created", response)
    return response


@app.get("/api/emergency/evacuation/global/active")
def get_active_global_evacuation(
    _auth: dict = Depends(require_roles("security", "cleaning", "medical", "supervisor")),
    db: Session = Depends(get_db),
):
    """Return the current global evacuation, if any."""
    evacuation = _get_active_global_evacuation(db)
    if not evacuation:
        return {"active": False}
    return _global_evacuation_to_response(evacuation)


@app.post("/api/emergency/evacuation/global/{evacuation_id}/safe", response_model=GlobalEvacuationResponse)
def mark_staff_safe(
    evacuation_id: str,
    request: EvacuationSafeRequest,
    auth: dict = Depends(require_roles("security", "cleaning", "medical", "supervisor")),
    db: Session = Depends(get_db),
):
    """Mark the authenticated staff member as safe."""

    evacuation = db.query(EvacuationZone).filter(EvacuationZone.id == evacuation_id).first()
    if not evacuation or _evacuation_metadata(evacuation).get("kind") != "global_evacuation":
        raise HTTPException(status_code=404, detail=f"Evacuation {evacuation_id} not found")

    if evacuation.status != "active":
        raise HTTPException(status_code=409, detail="Evacuation is not active")

    metadata = dict(_evacuation_metadata(evacuation))
    confirmations = dict(metadata.get("confirmations") or {})
    user_id = str(auth.get("user_id") or auth.get("id") or auth.get("sub") or auth.get("email") or "unknown")
    confirmations[user_id] = {
        "email": auth.get("email") or auth.get("username"),
        "role": auth.get("role"),
        "current_node": str(request.current_node) if request.current_node is not None else None,
        "notes": request.notes,
        "safe_at": datetime.now().isoformat(),
    }

    metadata["confirmations"] = confirmations
    evacuation.evacuated_count = len(confirmations)
    evacuation.incident_metadata = metadata
    flag_modified(evacuation, "incident_metadata")
    db.commit()
    db.refresh(evacuation)

    response = _global_evacuation_to_response(evacuation)
    publish_operational_event("evacuation.safe", response)
    return response


@app.post("/api/emergency/evacuation/global/{evacuation_id}/complete", response_model=GlobalEvacuationResponse)
async def complete_global_evacuation(
    evacuation_id: str,
    _auth: dict = Depends(require_roles("supervisor")),
    db: Session = Depends(get_db),
):
    """Supervisor closes the evacuation and clears route closures created by it."""
    evacuation = db.query(EvacuationZone).filter(EvacuationZone.id == evacuation_id).first()
    if not evacuation or _evacuation_metadata(evacuation).get("kind") != "global_evacuation":
        raise HTTPException(status_code=404, detail=f"Evacuation {evacuation_id} not found")

    evacuation.status = "completed"
    evacuation.completed_at = datetime.now()
    db.commit()
    db.refresh(evacuation)

    await _clear_routing_evacuation_closures(evacuation_id)
    response = _global_evacuation_to_response(evacuation)
    publish_operational_event("evacuation.completed", response)
    return response

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
